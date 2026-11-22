# Firestore Security Specification

## 1. Access Control Matrix

| Collection Path | `get` | `list` | `create` | `update` | `delete` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/leaderboard/{entryId}` | Public (visitors & signed-in players; no PII stored) | Public (visitors & signed-in players; no PII stored) | Signed-in owner (`incoming().userId == request.auth.uid`) | Signed-in owner (`existing().userId == request.auth.uid`) | Signed-in owner (`existing().userId == request.auth.uid`) |
| `/highscores/{scoreId}` | Public (visitors & signed-in players; no PII stored) | Public (visitors & signed-in players; no PII stored) | Signed-in owner (`incoming().userId == request.auth.uid`) | Signed-in owner (`existing().userId == request.auth.uid`) | Signed-in owner (`existing().userId == request.auth.uid`) |
| `/registeredUsers/{userId}` | Public (non-PII display name & TikTok link state) | Public (Admin directory view) | Signed-in owner (`isOwner(userId)`) | Signed-in owner (`isOwner(userId)`) | Signed-in owner or Admin |
| `/users/{userId}` | Owner or Admin (`isOwner(userId) \|\| isAdmin()`) | Signed-in owner (`existing().userId == request.auth.uid`) | Signed-in owner (`isOwner(userId)`) | Signed-in owner (`affectedKeys().hasOnly(...)`) | Signed-in owner or Admin |
| `/users/{userId}/progress/{bucketId}` | Owner or Admin + Master Gate (`exists(/users/$(userId))`) | Signed-in owner (`isOwner(userId) && existing().userId == request.auth.uid`) | Signed-in owner + Master Gate | Signed-in owner + Master Gate (`affectedKeys().hasOnly(['payload', 'updatedAt'])`) | Signed-in owner + Master Gate or Admin |
| `/overlaySessions/{sessionKey}` | Public `get` only for valid IDs (no PII; CEF browser sources have no auth) | Denied (`false`) — prevents collection enumeration/scraping | Schema-validated host write (`isValidOverlaySyncShape`) | Schema-validated host update (`affectedKeys().hasOnly(...)`, `gameId` immutable, monotonic `seq` per host session) | Admin only (`isAdmin()`) |

## 2. Schema & Validation Constraints

### `/leaderboard/{entryId}`
- **Document ID (`entryId`)**: `size() >= 1 && size() <= 128 && matches('^[a-zA-Z0-9_-]+$')`
- **Allowed Keys**: `['userId', 'displayName', 'gameId', 'puzzleId', 'puzzleTitle', 'score', 'metricLabel', 'subMetricLabel', 'createdAt', 'updatedAt']` (exact 10 required keys)
- **`userId`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9_-]+$`, must equal `request.auth.uid` on create and `existing().userId` on update.
- **`displayName`**: `string`, `1..60` chars (public nickname, no PII).
- **`gameId`**: `string`, in `['crossword', 'rebus', 'squared', 'thematix', 'destack', 'unolingo', 'wikirec', 'wikicon', 'mpsearch', 'mpdifference', 'mpcolossal', 'tekscodle']`, immutable on update.
- **`puzzleId`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9_-]+$`, immutable on update.
- **`puzzleTitle`**: `string`, `1..100` chars.
- **`score`**: `int`, `0..1000000`, must be `>= existing().score` on update.
- **`metricLabel`**: `string`, `1..60` chars.
- **`subMetricLabel`**: `string`, `1..80` chars.
- **`createdAt`**: `timestamp`, `== request.time` on create, `== existing().createdAt` on update.
- **`updatedAt`**: `timestamp`, `== request.time` on create and update.

### `/highscores/{scoreId}`
- **Document ID (`scoreId`)**: `size() >= 1 && size() <= 128 && matches('^[a-zA-Z0-9_-]+$')`
- **Allowed Keys**: `['userId', 'displayName', 'puzzleId', 'mode', 'score', 'wordsFound', 'totalWords', 'bonusWordsCount', 'foundFeatured', 'createdAt', 'updatedAt']` (exact 11 required keys)
- **`userId`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9_-]+$`, must equal `request.auth.uid` on create and `existing().userId` on update.
- **`displayName`**: `string`, `1..60` chars.
- **`puzzleId`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9_-]+$`, immutable on update.
- **`mode`**: `string`, in `['express-3x3', 'daily-4x4', 'royal-5x5']`, immutable on update.
- **`score`**: `int`, `0..100000`, must be `>= existing().score` on update.
- **`wordsFound`**: `int`, `0..500`, must be `<= incoming().totalWords`.
- **`totalWords`**: `int`, `1..500`, immutable on update.
- **`bonusWordsCount`**: `int`, `0..500`.
- **`foundFeatured`**: `bool`.
- **`createdAt`**: `timestamp`, `== request.time` on create, `== existing().createdAt` on update.
- **`updatedAt`**: `timestamp`, `== request.time` on create and update.

### `/users/{userId}`
- **Document ID (`userId`)**: `size() >= 1 && size() <= 128 && matches('^[a-zA-Z0-9_-]+$')`, must equal `request.auth.uid`.
- **Allowed Keys**: `['userId', 'displayName', 'linkedTikTokHandle', 'preferredLanguage', 'darkMode', 'createdAt', 'updatedAt']`.
- **`preferredLanguage`**: `string` in `['en', 'es', 'fr', 'de', 'it', 'pt', 'tl']`.
- **`darkMode`**: `bool`.
- **`userId` & `createdAt`**: Immutable after create.

### `/users/{userId}/progress/{bucketId}`
- **Master Gate**: Parent `/users/{userId}` must exist with `userId == request.auth.uid`.
- **Allowed `bucketId`**: `['daily_streaks', 'interactive_scores', 'crossword', 'rebus', 'squared', 'thematix', 'destack', 'unolingo', 'mpsearch', 'mpdifference', 'mpcolossal', 'tekscodle']`.
- **Allowed Keys**: `['userId', 'bucketId', 'payload', 'createdAt', 'updatedAt']`.
- **`payload`**: Native Firestore `map` with `keys().size() <= 200`.

### `/overlaySessions/{sessionKey}`
- **Document ID (`sessionKey`)**: `size() >= 1 && size() <= 128 && matches('^[a-zA-Z0-9_-]+$')`
- **Allowed Keys**: `['gameId', 'channel', 'streamer', 'hostSessionId', 'seq', 'stateHash', 'state', 'updatedAt']` (exact 8 required keys)
- **`gameId`**: `string`, in `['crowdle', 'destackint', 'mpsearchint', 'squaredint', 'wikicon', 'wikirec', 'lexi', 'inkstream', 'mpwh']`, immutable on update.
- **`channel`**: `string`, `0..64` chars, matches `^[a-z0-9_-]*$`.
- **`streamer`**: `string`, `0..80` chars, matches `^[a-z0-9_.-]*$`.
- **`hostSessionId`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9_-]+$`.
- **`seq`**: `int`, `1..100000000`, monotonic (`>= existing().seq`) when `hostSessionId` matches existing host.
- **`stateHash`**: `string`, `1..64` chars, matches `^[a-zA-Z0-9:_-]+$`.
- **`state`**: `map` (`size() >= 1 && size() <= 100`).
- **`updatedAt`**: `timestamp`, `== request.time` on create and update.

## 3. Business Logic Invariants
- Ownership (`userId`), game identity (`gameId`), and puzzle identity (`puzzleId`) are immutable after creation.
- Cross-session progress buckets are strictly private to their owner UID via Master Gate parent check + owner-only read/list rules.
- High scores are monotonic (`incoming().score >= existing().score`).
- Timestamps (`createdAt`, `updatedAt`) are strictly bound to `request.time`.
- Overlay sessions cannot be listed (`allow list: if false`) and cannot swap `gameId` or inject shadow keys (`hasOnly`).

## 4. Abuse & Denial-of-Wallet Resistance
- Zero `get()` calls inside `allow list` rules (`resource.data.userId == request.auth.uid` enforced directly).
- Strict string length bounds and key whitelisting (`keys().hasOnly(...)`) prevent document bloat and shadow fields.
- Client-side volumetric guard drops/trims oversized payloads prior to Firestore writes.

