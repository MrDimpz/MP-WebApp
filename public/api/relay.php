<?php
/**
 * Lightweight HTML/PHP Live Chat & Socket.IO v4 Long-Polling Relay for Hostinger / Apache Hosting
 * 
 * Supports:
 * - Native Socket.IO v4 / Engine.IO v4 HTTP Long-Polling (/socket.io/?EIO=4&transport=polling)
 * - Tikfinity, BetterTok, and TikTok Live webhooks (/api/tikfinity/event, /api/bettertok/event, /api/tiktok/event)
 * - REST connect/disconnect/status/events endpoints (/api/tiktok/*)
 * - Diagnostic endpoint (/api/tiktok/diagnostic)
 * - Works on standard HTML/PHP shared hosting without requiring a Node.js server.
 */

// Allow cross-origin requests and disable all caching
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true]);
    exit;
}

// Store data in a persistent local directory rather than sys_get_temp_dir()
// to prevent PHP-FPM PrivateTmp partition loss across requests.
$dataDir = __DIR__ . '/.relay_data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}
$storeFile = $dataDir . '/store_v4.json';

// Fallback to sys_get_temp_dir() only if local directory is not writable
if (!is_writable($dataDir) && !file_exists($storeFile)) {
    $storeFile = sys_get_temp_dir() . '/the_missing_piece_live_relay_v4.json';
}

function loadRelayState($file) {
    $default = [
        'connected' => false,
        'username' => '',
        'roomId' => '',
        'provider' => 'tikfinity',
        'seq' => 0,
        'events' => [],
        'sessions' => [],
        'lastWebhookTime' => 0,
        'lastWebhookProvider' => '',
        'totalWebhooksReceived' => 0
    ];
    if (!file_exists($file)) {
        return $default;
    }
    $raw = @file_get_contents($file);
    if (!$raw) {
        return $default;
    }
    $decoded = @json_decode($raw, true);
    if (!is_array($decoded)) {
        return $default;
    }
    return array_merge($default, $decoded);
}

function saveRelayState($file, $state) {
    if (isset($state['events']) && is_array($state['events']) && count($state['events']) > 150) {
        $state['events'] = array_slice($state['events'], -150);
    }
    $nowSec = time();
    if (isset($state['sessions']) && is_array($state['sessions'])) {
        foreach ($state['sessions'] as $sid => $sess) {
            if (($nowSec - ($sess['updated'] ?? 0)) > 180) {
                unset($state['sessions'][$sid]);
            }
        }
    }
    @file_put_contents($file, json_encode($state), LOCK_EX);
}

function isPlaceholder($val) {
    if (!is_string($val)) return true;
    $t = trim($val);
    if ($t === '' || $t === 'undefined' || $t === 'null') return true;
    if (preg_match('/^\{.*\}$/', $t) || preg_match('/^\$\{.*\}$/', $t) || preg_match('/^%.*%$/', $t)) {
        return true;
    }
    return false;
}

function normalizeUrl($url) {
    if (!is_string($url)) return '';
    $t = trim($url);
    if (isPlaceholder($t)) return '';
    if (strpos($t, '//') === 0) return 'https:' . $t;
    if (strpos($t, 'http://') === 0 || strpos($t, 'https://') === 0) return $t;
    return '';
}

function extractImage($field) {
    if (!$field) return '';
    if (is_string($field)) return normalizeUrl($field);
    if (is_array($field)) {
        $listKeys = ['urlList', 'urls', 'url_list', 'mUrls', 'url'];
        foreach ($listKeys as $k) {
            if (isset($field[$k])) {
                $found = extractImage($field[$k]);
                if ($found !== '') return $found;
            }
        }
        foreach ($field as $item) {
            $found = extractImage($item);
            if ($found !== '') return $found;
        }
    }
    return '';
}

function normalizeIncomingEventPayload($payload, $nowMs) {
    // 1. If payload contains a stringified 'data' field, parse it
    if (isset($payload['data']) && is_string($payload['data'])) {
        $parsedData = @json_decode($payload['data'], true);
        if (is_array($parsedData)) {
            $payload = array_merge($payload, $parsedData);
        }
    } elseif (isset($payload['data']) && is_array($payload['data'])) {
        $payload = array_merge($payload, $payload['data']);
    }

    // 2. If payload contains nested 'event' object
    if (isset($payload['event']) && is_array($payload['event'])) {
        $payload = array_merge($payload, $payload['event']);
    }

    $user = isset($payload['user']) && is_array($payload['user']) ? $payload['user'] : (
        isset($payload['sender']) && is_array($payload['sender']) ? $payload['sender'] : (
            isset($payload['author']) && is_array($payload['author']) ? $payload['author'] : (
                isset($payload['common']['user']) && is_array($payload['common']['user']) ? $payload['common']['user'] : []
            )
        )
    );

    $uniqueCandidates = [
        $user['uniqueId'] ?? null,
        $user['displayId'] ?? null,
        $user['username'] ?? null,
        $user['handle'] ?? null,
        $user['user_name'] ?? null,
        $payload['uniqueId'] ?? null,
        $payload['displayId'] ?? null,
        $payload['username'] ?? null,
        $payload['handle'] ?? null,
        $payload['user_name'] ?? null,
        $payload['userId'] ?? null,
    ];
    $uniqueId = '';
    foreach ($uniqueCandidates as $c) {
        if (is_string($c) && !isPlaceholder($c)) {
            $uniqueId = ltrim(trim($c), '@');
            if ($uniqueId !== '') break;
        }
    }

    $nickCandidates = [
        $user['nickname'] ?? null,
        $user['nickName'] ?? null,
        $user['displayName'] ?? null,
        $user['display_name'] ?? null,
        $user['name'] ?? null,
        $payload['nickname'] ?? null,
        $payload['nickName'] ?? null,
        $payload['displayName'] ?? null,
        $payload['display_name'] ?? null,
        $payload['name'] ?? null,
    ];
    $nickname = '';
    foreach ($nickCandidates as $c) {
        if (is_string($c) && !isPlaceholder($c)) {
            $nickname = ltrim(trim($c), '@');
            if ($nickname !== '') break;
        }
    }
    if ($nickname === '' && $uniqueId !== '') $nickname = $uniqueId;
    if ($uniqueId === '' && $nickname !== '') $uniqueId = preg_replace('/[^a-z0-9_.-]/i', '_', strtolower($nickname));
    if ($uniqueId === '') $uniqueId = 'viewer';
    if ($nickname === '') $nickname = 'TikTok Viewer';

    $imgCandidates = [
        $payload['profilePictureUrl'] ?? null,
        $payload['profilePicture'] ?? null,
        $payload['avatarUrl'] ?? null,
        $payload['avatar'] ?? null,
        $payload['profileImage'] ?? null,
        $payload['pfp'] ?? null,
        $user['profilePictureUrl'] ?? null,
        $user['profilePicture'] ?? null,
        $user['avatarLarge'] ?? null,
        $user['avatarMedium'] ?? null,
        $user['avatarThumb'] ?? null,
        $user['avatarUrl'] ?? null,
        $user['avatar'] ?? null,
        $user['profileImage'] ?? null,
        $user['pfp'] ?? null,
    ];
    $profilePictureUrl = '';
    foreach ($imgCandidates as $cand) {
        $extracted = extractImage($cand);
        if ($extracted !== '') {
            $profilePictureUrl = $extracted;
            break;
        }
    }
    if ($profilePictureUrl === '') {
        $profilePictureUrl = 'https://i.pravatar.cc/150?u=' . rawurlencode($uniqueId ?: $nickname);
    }

    $eventType = strtolower((string)($payload['type'] ?? $payload['event'] ?? $payload['eventType'] ?? $payload['event_type'] ?? ''));
    $eventId = isset($payload['eventId']) && is_string($payload['eventId'])
        ? $payload['eventId']
        : ('php_' . $nowMs . '_' . substr(md5(uniqid('', true)), 0, 6));

    // Gift Event Detection
    if ($eventType === 'gift' || $eventType === 'gift-event' || isset($payload['giftName']) || isset($payload['gift_name']) || isset($payload['diamondCount'])) {
        return [
            'id' => $eventId,
            'timestamp' => $nowMs,
            'type' => 'gift-event',
            'shortType' => 'gift',
            'payload' => [
                'eventId' => $eventId,
                'timestamp' => $nowMs,
                'uniqueId' => $uniqueId,
                'nickname' => $nickname,
                'giftName' => (string)($payload['giftName'] ?? $payload['gift_name'] ?? $payload['gift']['name'] ?? 'Gift'),
                'diamondCount' => (int)($payload['diamondCount'] ?? $payload['diamonds'] ?? $payload['gift']['diamondCount'] ?? 1),
                'repeatCount' => (int)($payload['repeatCount'] ?? $payload['repeat_count'] ?? $payload['count'] ?? 1),
                'repeatEnd' => true,
                'profilePictureUrl' => $profilePictureUrl
            ]
        ];
    }

    // Like Event Detection
    if ($eventType === 'like' || $eventType === 'like-event' || isset($payload['likeCount']) || isset($payload['like_count'])) {
        $likeCount = (int)($payload['likeCount'] ?? $payload['like_count'] ?? $payload['count'] ?? 1);
        return [
            'id' => $eventId,
            'timestamp' => $nowMs,
            'type' => 'like-event',
            'shortType' => 'like',
            'payload' => [
                'eventId' => $eventId,
                'timestamp' => $nowMs,
                'uniqueId' => $uniqueId,
                'nickname' => $nickname,
                'likeCount' => max(1, $likeCount),
                'totalLikeCount' => (int)($payload['totalLikeCount'] ?? $payload['total'] ?? $likeCount),
                'profilePictureUrl' => $profilePictureUrl
            ]
        ];
    }

    // Chat Comment Detection
    $commentCandidates = [
        $payload['comment'] ?? null,
        $payload['content'] ?? null,
        $payload['message'] ?? null,
        $payload['text'] ?? null,
        $payload['word'] ?? null,
        $payload['msg'] ?? null,
        $payload['chatMessage'] ?? null,
        $payload['chat'] ?? null,
    ];
    $comment = '';
    foreach ($commentCandidates as $c) {
        if (is_string($c) && !isPlaceholder($c)) {
            $trimmed = trim($c);
            if ($trimmed !== '') {
                $comment = $trimmed;
                break;
            }
        }
    }

    if ($comment !== '') {
        return [
            'id' => $eventId,
            'timestamp' => $nowMs,
            'type' => 'chat-message',
            'shortType' => 'chat',
            'payload' => [
                'eventId' => $eventId,
                'timestamp' => $nowMs,
                'uniqueId' => $uniqueId,
                'nickname' => $nickname,
                'comment' => $comment,
                'profilePictureUrl' => $profilePictureUrl
            ]
        ];
    }

    return null;
}

function broadcastPacketToSessions(&$state, $sioPacket) {
    if (!isset($state['sessions']) || !is_array($state['sessions'])) {
        $state['sessions'] = [];
        return;
    }
    foreach ($state['sessions'] as $k => $_sess) {
        $state['sessions'][$k]['queue'][] = $sioPacket;
    }
}

function sanitizeOverlayGame($raw) {
    return preg_replace('/[^a-z0-9_-]/', '', strtolower(trim((string)$raw)));
}

function sanitizeOverlayChannel($raw) {
    return substr(preg_replace('/[^a-z0-9_-]/', '', strtolower(trim((string)$raw))), 0, 64);
}

function sanitizeOverlayStreamer($raw) {
    return substr(ltrim(strtolower(trim((string)$raw)), '@'), 0, 80);
}

function overlayFileForRoom($dataDir, $roomKey) {
    return rtrim($dataDir, '/') . '/overlay_' . sha1($roomKey) . '.json';
}

function readOverlayFile($file) {
    if (!file_exists($file)) return null;
    $raw = @file_get_contents($file);
    if (!$raw) return null;
    $decoded = @json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function nextOverlayServerVersion($dataDir) {
    $verFile = rtrim($dataDir, '/') . '/overlay_ver.txt';
    $fp = @fopen($verFile, 'c+');
    if (!$fp) {
        return (int)round(microtime(true) * 1000);
    }
    $ver = 1;
    if (@flock($fp, LOCK_EX)) {
        $contents = trim((string)stream_get_contents($fp));
        $ver = $contents !== '' ? ((int)$contents + 1) : 1;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string)$ver);
        fflush($fp);
        @flock($fp, LOCK_UN);
    }
    @fclose($fp);
    return $ver;
}

function upsertOverlaySnapshotPhp($dataDir, $params, $nowMs) {
    $gameId = sanitizeOverlayGame($params['gameId'] ?? '');
    if ($gameId === '' || !array_key_exists('state', $params)) {
        return null;
    }
    $channel = sanitizeOverlayChannel($params['channel'] ?? '');
    $streamer = sanitizeOverlayStreamer($params['streamer'] ?? '');
    $hostSessionId = isset($params['hostSessionId']) && is_string($params['hostSessionId']) ? $params['hostSessionId'] : null;
    $seq = isset($params['seq']) && is_numeric($params['seq']) ? (int)$params['seq'] : null;
    $stateHash = isset($params['stateHash']) && is_string($params['stateHash']) ? $params['stateHash'] : null;

    $primaryKey = $channel !== ''
        ? "overlay:{$gameId}:ch:{$channel}"
        : ($streamer !== '' ? "overlay:{$gameId}:s:{$streamer}" : "overlay:{$gameId}:default");

    $primaryFile = overlayFileForRoom($dataDir, $primaryKey);
    $existing = readOverlayFile($primaryFile);
    if (
        $existing &&
        $hostSessionId !== null &&
        ($existing['hostSessionId'] ?? null) === $hostSessionId &&
        $seq !== null &&
        isset($existing['seq']) &&
        $seq <= (int)$existing['seq']
    ) {
        return $existing;
    }

    $record = [
        'gameId' => $gameId,
        'streamer' => $streamer,
        'channel' => $channel,
        'state' => $params['state'],
        'updatedAt' => $nowMs,
        'hostSessionId' => $hostSessionId,
        'seq' => $seq,
        'stateHash' => $stateHash,
        'serverVersion' => nextOverlayServerVersion($dataDir),
        'bootId' => 'php_relay',
    ];

    $encoded = json_encode($record);
    @file_put_contents($primaryFile, $encoded, LOCK_EX);
    if ($channel !== '' && $streamer !== '') {
        @file_put_contents(overlayFileForRoom($dataDir, "overlay:{$gameId}:s:{$streamer}"), $encoded, LOCK_EX);
    }
    @file_put_contents(overlayFileForRoom($dataDir, "overlay_latest:{$gameId}"), $encoded, LOCK_EX);
    return $record;
}

function getOverlaySnapshotPhp($dataDir, $gameId, $streamer, $channel) {
    $gameId = sanitizeOverlayGame($gameId);
    if ($gameId === '') return null;
    $channel = sanitizeOverlayChannel($channel);
    $streamer = sanitizeOverlayStreamer($streamer);

    if ($channel !== '') {
        $chSnap = readOverlayFile(overlayFileForRoom($dataDir, "overlay:{$gameId}:ch:{$channel}"));
        if ($chSnap) return $chSnap;
        if ($streamer !== '') {
            return readOverlayFile(overlayFileForRoom($dataDir, "overlay:{$gameId}:s:{$streamer}"));
        }
        return null;
    }
    if ($streamer !== '') {
        return readOverlayFile(overlayFileForRoom($dataDir, "overlay:{$gameId}:s:{$streamer}"));
    }
    $def = readOverlayFile(overlayFileForRoom($dataDir, "overlay:{$gameId}:default"));
    if ($def) return $def;
    return readOverlayFile(overlayFileForRoom($dataDir, "overlay_latest:{$gameId}"));
}

$rawBody = file_get_contents('php://input');
$uri = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
$route = isset($_GET['route']) ? trim($_GET['route'], '/') : '';
$nowMs = round(microtime(true) * 1000);
$state = loadRelayState($storeFile);

// ============================================================================
// 0. Native Engine.IO v4 / Socket.IO v4 HTTP Long-Polling Handler (/socket.io/)
// ============================================================================
if (strpos($uri, '/socket.io') !== false || $route === 'socket.io' || isset($_GET['EIO'])) {
    header('Content-Type: text/plain; charset=UTF-8');
    $sid = isset($_GET['sid']) ? trim((string)$_GET['sid']) : '';

    // Step 1: Engine.IO v4 Handshake (GET without sid)
    if ($sid === '' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $newSid = 'eio_' . substr(md5(uniqid((string)mt_rand(), true)), 0, 16);
        $state['sessions'][$newSid] = [
            'queue' => [],
            'cursor' => $nowMs,
            'updated' => time()
        ];
        saveRelayState($storeFile, $state);
        echo '0' . json_encode([
            'sid' => $newSid,
            'upgrades' => [],
            'pingInterval' => 25000,
            'pingTimeout' => 20000,
            'maxPayload' => 1000000
        ]);
        exit;
    }

    if ($sid === '') {
        $sid = 'eio_default';
    }
    if (!isset($state['sessions'][$sid])) {
        $sioSid = 'sio_' . substr(md5($sid), 0, 12);
        $state['sessions'][$sid] = [
            'queue' => ['40' . json_encode(['sid' => $sioSid])],
            'cursor' => $nowMs,
            'updated' => time()
        ];
    }
    $state['sessions'][$sid]['updated'] = time();

    // Step 2: Client POSTing Engine.IO / Socket.IO packets
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $packets = explode("\x1e", (string)$rawBody);
        foreach ($packets as $pkt) {
            $pkt = trim($pkt);
            if ($pkt === '') continue;

            if ($pkt === '2') {
                // Engine.IO PING -> PONG
                $state['sessions'][$sid]['queue'][] = '3';
            } elseif (strpos($pkt, '40') === 0) {
                // Socket.IO Namespace CONNECT
                $sioSid = 'sio_' . substr(md5($sid), 0, 12);
                $state['sessions'][$sid]['queue'][] = '40' . json_encode(['sid' => $sioSid]);
                if (!empty($state['connected']) && !empty($state['username'])) {
                    $state['sessions'][$sid]['queue'][] = '42' . json_encode([
                        'tiktok-status',
                        [
                            'connected' => true,
                            'username' => $state['username'],
                            'roomId' => $state['roomId'] ?: 'LIVE_RELAY',
                            'provider' => $state['provider'] ?? 'tikfinity'
                        ]
                    ]);
                }
            } elseif (preg_match('/^42(\d*)(\[.*\])/s', $pkt, $m)) {
                $ackId = $m[1];
                $arr = @json_decode($m[2], true);
                if (is_array($arr) && count($arr) >= 1) {
                    $evName = (string)$arr[0];
                    $evData = $arr[1] ?? [];

                    if ($evName === 'connect-tiktok') {
                        $rawUname = is_string($evData) ? $evData : ($evData['username'] ?? 'streamer');
                        $cleanUname = ltrim(trim((string)$rawUname), '@') ?: 'streamer';
                        $isTest = is_array($evData) && !empty($evData['isTestMode']);
                        $prov = (is_array($evData) && isset($evData['provider']) && in_array($evData['provider'], ['tikfinity', 'bettertok']))
                            ? $evData['provider']
                            : ($state['provider'] ?? 'tikfinity');
                        $roomId = $isTest ? 'TEST_SIMULATION_ROOM' : 'LIVE_RELAY';

                        $state['connected'] = true;
                        $state['username'] = $cleanUname;
                        $state['roomId'] = $roomId;
                        $state['provider'] = $prov;

                        $connPayload = [
                            'username' => $cleanUname,
                            'roomId' => $roomId,
                            'isTestMode' => $isTest,
                            'provider' => $prov
                        ];
                        $statusPayload = [
                            'connected' => true,
                            'username' => $cleanUname,
                            'roomId' => $roomId,
                            'isTestMode' => $isTest,
                            'provider' => $prov
                        ];

                        if ($ackId !== '') {
                            $state['sessions'][$sid]['queue'][] = '43' . $ackId . json_encode([['ok' => true] + $statusPayload]);
                        }
                        broadcastPacketToSessions($state, '42' . json_encode(['tiktok-connected', $connPayload]));
                        broadcastPacketToSessions($state, '42' . json_encode(['tiktok-status', $statusPayload]));
                    } elseif ($evName === 'disconnect-tiktok') {
                        $state['connected'] = false;
                        $state['username'] = '';
                        $state['roomId'] = '';
                        broadcastPacketToSessions($state, '42' . json_encode(['tiktok-disconnected']));
                        broadcastPacketToSessions($state, '42' . json_encode([
                            'tiktok-status',
                            ['connected' => false, 'username' => '', 'roomId' => '']
                        ]));
                    } elseif ($evName === 'register-streamer' || $evName === 'streamer-auth-login') {
                        $uname = is_array($evData) ? ($evData['username'] ?? '') : '';
                        if ($ackId !== '') {
                            $state['sessions'][$sid]['queue'][] = '43' . $ackId . json_encode([['ok' => true, 'username' => $uname]]);
                        }
                        $state['sessions'][$sid]['queue'][] = '42' . json_encode(['streamer-registered', ['ok' => true, 'username' => $uname]]);
                    } elseif ($evName === 'register-overlay-host' && is_array($evData)) {
                        $state['sessions'][$sid]['overlayHost'] = [
                            'gameId' => sanitizeOverlayGame($evData['gameId'] ?? ''),
                            'streamer' => sanitizeOverlayStreamer($evData['streamer'] ?? ''),
                            'channel' => sanitizeOverlayChannel($evData['channel'] ?? ''),
                        ];
                    } elseif ($evName === 'overlay-host-leave') {
                        unset($state['sessions'][$sid]['overlayHost']);
                    } elseif ($evName === 'join-overlay' && is_array($evData)) {
                        $gId = sanitizeOverlayGame($evData['gameId'] ?? '');
                        $str = sanitizeOverlayStreamer($evData['streamer'] ?? '');
                        $ch = sanitizeOverlayChannel($evData['channel'] ?? '');
                        $state['sessions'][$sid]['overlaySub'] = [
                            'gameId' => $gId,
                            'streamer' => $str,
                            'channel' => $ch,
                        ];
                        $snap = getOverlaySnapshotPhp($dataDir, $gId, $str, $ch);
                        if ($snap) {
                            $state['sessions'][$sid]['queue'][] = '42' . json_encode(['overlay-state-sync', $snap]);
                        }
                        foreach ($state['sessions'] as $sk => $sess) {
                            if (!empty($sess['overlayHost']) && ($sess['overlayHost']['gameId'] ?? '') === $gId) {
                                $hCh = $sess['overlayHost']['channel'] ?? '';
                                $hStr = $sess['overlayHost']['streamer'] ?? '';
                                if (($ch !== '' && $hCh === $ch) || ($ch === '' && $str !== '' && $hStr === $str) || ($ch === '' && $str === '')) {
                                    $state['sessions'][$sk]['queue'][] = '42' . json_encode(['overlay-request-state', ['gameId' => $gId, 'streamer' => $str, 'channel' => $ch]]);
                                }
                            }
                        }
                    } elseif ($evName === 'overlay-state-update' && is_array($evData)) {
                        $snap = upsertOverlaySnapshotPhp($dataDir, $evData, $nowMs);
                        if ($snap) {
                            $pkt = '42' . json_encode(['overlay-state-sync', $snap]);
                            foreach ($state['sessions'] as $sk => $sess) {
                                if ($sk === $sid || empty($sess['overlaySub'])) continue;
                                if (($sess['overlaySub']['gameId'] ?? '') !== $snap['gameId']) continue;
                                $sCh = $sess['overlaySub']['channel'] ?? '';
                                $sStr = $sess['overlaySub']['streamer'] ?? '';
                                if ($sCh !== '' && $snap['channel'] !== '' && $sCh !== $snap['channel']) continue;
                                if ($sCh === '' && $sStr !== '' && $snap['streamer'] !== '' && $sStr !== $snap['streamer']) continue;
                                $state['sessions'][$sk]['queue'][] = $pkt;
                            }
                        }
                    } elseif (in_array($evName, ['chat-message', 'like-event', 'gift-event']) && is_array($evData)) {
                        $evData['type'] = $evName;
                        $normEv = normalizeIncomingEventPayload($evData, $nowMs);
                        if ($normEv) {
                            $state['seq'] = (int)($state['seq'] ?? 0) + 1;
                            $normEv['payload']['_seq'] = $state['seq'];
                            $state['events'][] = [
                                'id' => $normEv['id'],
                                'seq' => $state['seq'],
                                'timestamp' => $normEv['timestamp'],
                                'type' => $normEv['type'],
                                'payload' => $normEv['payload']
                            ];
                            broadcastPacketToSessions($state, '42' . json_encode([$normEv['type'], $normEv['payload']]));
                        }
                    }
                }
            }
        }
        saveRelayState($storeFile, $state);
        echo 'ok';
        exit;
    }

    // Step 3: Client GET polling for queued packets & live events
    $collectForSession = function (&$st, $sessionId) {
        $out = $st['sessions'][$sessionId]['queue'] ?? [];
        $st['sessions'][$sessionId]['queue'] = [];
        $cursor = $st['sessions'][$sessionId]['cursor'] ?? 0;
        if (!empty($st['events']) && is_array($st['events'])) {
            foreach ($st['events'] as $ev) {
                if (isset($ev['timestamp']) && $ev['timestamp'] > $cursor) {
                    $cursor = $ev['timestamp'];
                    $out[] = '42' . json_encode([$ev['type'], $ev['payload']]);
                }
            }
        }
        $st['sessions'][$sessionId]['cursor'] = $cursor;
        return $out;
    };

    $outPackets = $collectForSession($state, $sid);
    if (empty($outPackets)) {
        saveRelayState($storeFile, $state);
        usleep(350000); // 350ms non-blocking poll interval
        $state = loadRelayState($storeFile);
        if (!isset($state['sessions'][$sid])) {
            $state['sessions'][$sid] = ['queue' => [], 'cursor' => $nowMs, 'updated' => time()];
        }
        $outPackets = $collectForSession($state, $sid);
        if (empty($outPackets)) {
            $outPackets[] = '2'; // Engine.IO heartbeat PING
        }
    }

    saveRelayState($storeFile, $state);
    echo implode("\x1e", $outPackets);
    exit;
}

// ============================================================================
// REST JSON Endpoints (/api/*)
// ============================================================================
header('Content-Type: application/json; charset=utf-8');

$jsonBody = $rawBody ? @json_decode($rawBody, true) : [];
if (!is_array($jsonBody)) $jsonBody = [];
$payload = array_merge($_GET, $_POST, $jsonBody);

// 0.5 Overlay State REST Sync (/api/overlay/state)
if (strpos($uri, '/api/overlay/state') !== false || $route === 'overlay/state') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $snap = upsertOverlaySnapshotPhp($dataDir, $payload, $nowMs);
        if (!$snap) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Missing gameId or state']);
            exit;
        }
        echo json_encode([
            'ok' => true,
            'updatedAt' => $snap['updatedAt'],
            'hostSessionId' => $snap['hostSessionId'],
            'seq' => $snap['seq'],
            'serverVersion' => $snap['serverVersion'],
        ]);
        exit;
    }

    $gId = sanitizeOverlayGame($_GET['gameId'] ?? '');
    $str = sanitizeOverlayStreamer($_GET['streamer'] ?? '');
    $ch = sanitizeOverlayChannel($_GET['channel'] ?? '');
    $afterVersion = isset($_GET['afterVersion']) && is_numeric($_GET['afterVersion']) ? (int)$_GET['afterVersion'] : 0;
    if ($gId === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing gameId']);
        exit;
    }
    $snap = getOverlaySnapshotPhp($dataDir, $gId, $str, $ch);
    if (!$snap) {
        echo json_encode(['ok' => true, 'hasSnapshot' => false, 'bootId' => 'php_relay', 'serverTime' => $nowMs]);
        exit;
    }
    if ($afterVersion > 0 && isset($snap['serverVersion']) && (int)$snap['serverVersion'] <= $afterVersion) {
        echo json_encode([
            'ok' => true,
            'hasSnapshot' => true,
            'unchanged' => true,
            'hostSessionId' => $snap['hostSessionId'] ?? null,
            'seq' => $snap['seq'] ?? null,
            'stateHash' => $snap['stateHash'] ?? null,
            'serverVersion' => $snap['serverVersion'],
            'bootId' => $snap['bootId'] ?? 'php_relay',
            'serverTime' => $nowMs,
        ]);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'hasSnapshot' => true,
        'gameId' => $snap['gameId'],
        'streamer' => $snap['streamer'],
        'channel' => $snap['channel'],
        'state' => $snap['state'],
        'updatedAt' => $snap['updatedAt'],
        'hostSessionId' => $snap['hostSessionId'],
        'seq' => $snap['seq'],
        'stateHash' => $snap['stateHash'] ?? null,
        'serverVersion' => $snap['serverVersion'],
        'bootId' => $snap['bootId'] ?? 'php_relay',
        'serverTime' => $nowMs,
    ]);
    exit;
}

// 1. Connect endpoint
if (strpos($uri, '/api/tiktok/connect') !== false || $route === 'tiktok/connect') {
    $uname = isset($payload['username']) ? ltrim(trim((string)$payload['username']), '@') : 'streamer';
    if ($uname === '') $uname = 'streamer';
    $isTest = !empty($payload['isTestMode']);
    $gameId = isset($payload['gameId']) ? trim((string)$payload['gameId']) : '';
    $prov = isset($payload['provider']) && in_array($payload['provider'], ['tikfinity', 'bettertok'])
        ? $payload['provider']
        : ($state['provider'] ?? 'tikfinity');
    $roomId = $isTest ? 'TEST_SIMULATION_ROOM' : 'LIVE_RELAY';

    $state['connected'] = true;
    $state['username'] = $uname;
    $state['roomId'] = $roomId;
    $state['provider'] = $prov;

    $connPayload = [
        'username' => $uname,
        'roomId' => $roomId,
        'isTestMode' => $isTest,
        'provider' => $prov,
        'gameId' => $gameId !== '' ? $gameId : null
    ];
    broadcastPacketToSessions($state, '42' . json_encode(['tiktok-connected', $connPayload]));
    broadcastPacketToSessions($state, '42' . json_encode(['tiktok-status', ['connected' => true] + $connPayload]));
    saveRelayState($storeFile, $state);

    echo json_encode([
        'ok' => true,
        'connected' => true,
        'username' => $state['username'],
        'roomId' => $state['roomId'],
        'provider' => $state['provider'],
        'gameId' => $gameId !== '' ? $gameId : null
    ]);
    exit;
}

// 2. Disconnect endpoint
if (strpos($uri, '/api/tiktok/disconnect') !== false || $route === 'tiktok/disconnect') {
    $gameId = isset($payload['gameId']) ? trim((string)$payload['gameId']) : '';
    $state['connected'] = false;
    $state['username'] = '';
    $state['roomId'] = '';
    broadcastPacketToSessions($state, '42' . json_encode(['tiktok-disconnected', ['gameId' => $gameId !== '' ? $gameId : null]]));
    broadcastPacketToSessions($state, '42' . json_encode(['tiktok-status', ['connected' => false, 'username' => '', 'roomId' => '', 'gameId' => $gameId !== '' ? $gameId : null]]));
    saveRelayState($storeFile, $state);
    echo json_encode(['ok' => true, 'connected' => false]);
    exit;
}

// 3. Status endpoint
if (strpos($uri, '/api/tiktok/status') !== false || $route === 'tiktok/status') {
    echo json_encode([
        'ok' => true,
        'connected' => !empty($state['connected']),
        'username' => $state['username'] ?? '',
        'roomId' => $state['roomId'] ?? '',
        'provider' => $state['provider'] ?? 'tikfinity',
        'seq' => (int)($state['seq'] ?? 0),
        'lastWebhookTime' => $state['lastWebhookTime'] ?? 0,
        'lastWebhookProvider' => $state['lastWebhookProvider'] ?? '',
        'totalWebhooksReceived' => $state['totalWebhooksReceived'] ?? 0,
        'eventCount' => count($state['events'] ?? [])
    ]);
    exit;
}

// 4. Poll events endpoint
if (strpos($uri, '/api/tiktok/events') !== false || $route === 'tiktok/events') {
    $since = isset($_GET['since']) ? (float)$_GET['since'] : 0;
    $events = isset($state['events']) && is_array($state['events']) ? $state['events'] : [];
    $filtered = [];
    foreach ($events as $idx => $ev) {
        $evSeq = isset($ev['seq']) ? (int)$ev['seq'] : ($idx + 1);
        $evTs = isset($ev['timestamp']) ? (float)$ev['timestamp'] : 0;
        $isNew = ($since < 1000000000) ? ($evSeq > $since) : ($evTs > $since);
        if ($isNew) {
            if (!isset($ev['seq'])) {
                $ev['seq'] = $evSeq;
            }
            if (isset($ev['payload']) && is_array($ev['payload']) && !isset($ev['payload']['_seq'])) {
                $ev['payload']['_seq'] = $evSeq;
            }
            $filtered[] = $ev;
        }
    }
    echo json_encode([
        'ok' => true,
        'connected' => !empty($state['connected']),
        'username' => $state['username'] ?? '',
        'roomId' => $state['roomId'] ?? '',
        'seq' => (int)($state['seq'] ?? count($events)),
        'events' => $filtered
    ]);
    exit;
}

// 5. Simulate Endpoint (/api/tiktok/simulate)
if (strpos($uri, '/api/tiktok/simulate') !== false || $route === 'tiktok/simulate') {
    $simType = isset($payload['type']) ? (string)$payload['type'] : 'chat-message';
    $simPayload = isset($payload['payload']) && is_array($payload['payload']) ? $payload['payload'] : $payload;
    $simPayload['type'] = $simType;
    $normEv = normalizeIncomingEventPayload($simPayload, $nowMs);
    if ($normEv) {
        $state['seq'] = (int)($state['seq'] ?? 0) + 1;
        $normEv['payload']['_seq'] = $state['seq'];
        $state['events'][] = [
            'id' => $normEv['id'],
            'seq' => $state['seq'],
            'timestamp' => $normEv['timestamp'],
            'type' => $normEv['type'],
            'payload' => $normEv['payload']
        ];
        broadcastPacketToSessions($state, '42' . json_encode([$normEv['type'], $normEv['payload']]));
        saveRelayState($storeFile, $state);
        echo json_encode(['ok' => true, 'seq' => $state['seq'], 'event' => $normEv['payload']]);
        exit;
    }
    echo json_encode(['ok' => false, 'error' => 'Invalid simulation payload']);
    exit;
}

// 6. Diagnostic Endpoint (/api/tiktok/diagnostic)
if (strpos($uri, '/api/tiktok/diagnostic') !== false || $route === 'tiktok/diagnostic') {
    $recent = array_slice($state['events'] ?? [], -10);
    echo json_encode([
        'ok' => true,
        'connected' => !empty($state['connected']),
        'username' => $state['username'] ?? '',
        'provider' => $state['provider'] ?? 'tikfinity',
        'seq' => (int)($state['seq'] ?? 0),
        'lastWebhookTime' => $state['lastWebhookTime'] ?? 0,
        'lastWebhookProvider' => $state['lastWebhookProvider'] ?? '',
        'totalWebhooksReceived' => $state['totalWebhooksReceived'] ?? 0,
        'activeSessions' => count($state['sessions'] ?? []),
        'recentEvents' => $recent,
        'serverTime' => $nowMs,
        'storageFile' => basename($storeFile)
    ]);
    exit;
}

// 7. Webhook Event Ingestion (/api/tikfinity/event, /api/bettertok/event, /api/tiktok/event)
$webhookProvider = 'tiktok';
if (strpos($uri, 'tikfinity') !== false || strpos($route, 'tikfinity') !== false) {
    $webhookProvider = 'tikfinity';
} elseif (strpos($uri, 'bettertok') !== false || strpos($route, 'bettertok') !== false) {
    $webhookProvider = 'bettertok';
}

$normEv = normalizeIncomingEventPayload($payload, $nowMs);
if ($normEv) {
    $state['seq'] = (int)($state['seq'] ?? 0) + 1;
    $normEv['payload']['_seq'] = $state['seq'];
    $state['events'][] = [
        'id' => $normEv['id'],
        'seq' => $state['seq'],
        'timestamp' => $normEv['timestamp'],
        'type' => $normEv['type'],
        'payload' => $normEv['payload']
    ];
    $state['lastWebhookTime'] = $nowMs;
    $state['lastWebhookProvider'] = $webhookProvider;
    $state['totalWebhooksReceived'] = ($state['totalWebhooksReceived'] ?? 0) + 1;

    // Broadcast immediately to all active Socket.IO HTTP long-polling sessions!
    broadcastPacketToSessions($state, '42' . json_encode([$normEv['type'], $normEv['payload']]));

    saveRelayState($storeFile, $state);
    echo json_encode(['ok' => true, 'seq' => $state['seq'], 'type' => $normEv['shortType'], 'event' => $normEv['payload'], 'provider' => $webhookProvider]);
    exit;
}

echo json_encode([
    'ok' => true,
    'status' => 'ready',
    'notice' => 'Webhook received but comment or event payload was empty. Ensure your webhook sends a comment or message string.'
]);
