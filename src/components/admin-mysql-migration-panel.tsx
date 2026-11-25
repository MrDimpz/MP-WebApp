import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCode2,
  FileJson,
  Loader2,
  LogIn,
  RefreshCw,
  Server,
  UploadCloud,
} from 'lucide-react';
import { auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { signInWithGooglePopup } from '@/lib/unified-game-auth';
import {
  fetchDatabaseBackendStatus,
  mysqlAdminImportSnapshot,
  type DatabaseBackendStatus,
} from '@/lib/mysql-client';
import {
  buildHostingerMigrationSql,
  exportFirestoreSnapshot,
  getHostingerBlankSchemaSql,
  isSignedInAsFirebaseAdmin,
  triggerTextFileDownload,
  type FirestoreExportSnapshot,
} from '@/lib/firestore-mysql-export';

export function AdminMysqlMigrationPanel({ enabled = true }: { enabled?: boolean }) {
  const [dbStatus, setDbStatus] = useState<DatabaseBackendStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [fbAdminEmail, setFbAdminEmail] = useState<string | null>(
    () => (isSignedInAsFirebaseAdmin() ? auth.currentUser?.email || null : null),
  );
  const [fbSigningIn, setFbSigningIn] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FirestoreExportSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [importingToMysql, setImportingToMysql] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const next = await fetchDatabaseBackendStatus({ force: true, includeCounts: true });
      setDbStatus(next);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refreshStatus();
  }, [enabled, refreshStatus]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setFbAdminEmail(isSignedInAsFirebaseAdmin() ? auth.currentUser?.email || null : null);
    });
    return () => unsub();
  }, []);

  const handleAdminGoogleSignIn = async () => {
    setErrorMsg(null);
    setFbSigningIn(true);
    try {
      await signInWithGooglePopup();
      if (isSignedInAsFirebaseAdmin()) {
        setFbAdminEmail(auth.currentUser?.email || null);
        setSuccessMsg('Signed in as verified Firebase Admin. Full private profile & progress export unlocked.');
      } else {
        setErrorMsg(
          `Signed in as ${auth.currentUser?.email || 'user'}, which is not the verified Firebase Admin account (Phreakfrog@gmail.com).`,
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setFbSigningIn(false);
    }
  };

  const runExport = async (autoAction: 'sql' | 'json' | 'mysql') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setExporting(true);
    setProgressText('Starting Firestore read...');
    try {
      const data = await exportFirestoreSnapshot((msg) => setProgressText(msg));
      setSnapshot(data);

      const dateTag = new Date().toISOString().slice(0, 10);

      if (autoAction === 'sql') {
        const sql = buildHostingerMigrationSql(data);
        triggerTextFileDownload(
          `missingpiece-hostinger-mysql-${dateTag}.sql`,
          sql,
          'application/sql;charset=utf-8',
        );
        setSuccessMsg(
          `Downloaded Hostinger SQL dump (${data.users.length} users, ${data.userProgress.length} progress buckets, ${data.registeredUsers.length} directory rows, ${data.leaderboard.length} leaderboard entries, ${data.highscores.length} high scores).`,
        );
      } else if (autoAction === 'json') {
        triggerTextFileDownload(
          `missingpiece-firestore-backup-${dateTag}.json`,
          JSON.stringify(data, null, 2),
          'application/json;charset=utf-8',
        );
        setSuccessMsg('Downloaded full JSON backup of your Firestore database.');
      } else if (autoAction === 'mysql') {
        setImportingToMysql(true);
        setProgressText('Importing snapshot into Hostinger MySQL...');
        const res = await mysqlAdminImportSnapshot({
          users: data.users,
          userProgress: data.userProgress,
          registeredUsers: data.registeredUsers,
          leaderboard: data.leaderboard,
          highscores: data.highscores,
        });
        setImportingToMysql(false);
        if (!res.ok) {
          setErrorMsg(res.error || 'MySQL import failed.');
        } else {
          setSuccessMsg(
            `Synced directly to Hostinger MySQL: ${res.imported?.users || 0} users, ${res.imported?.userProgress || 0} progress buckets, ${res.imported?.registeredUsers || 0} registered users, ${res.imported?.leaderboard || 0} leaderboard rows, ${res.imported?.highscores || 0} high scores.`,
          );
          await refreshStatus();
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
      setImportingToMysql(false);
      setProgressText(null);
    }
  };

  const handleDownloadBlankSchema = () => {
    triggerTextFileDownload(
      'missingpiece-hostinger-schema.sql',
      getHostingerBlankSchemaSql(),
      'application/sql;charset=utf-8',
    );
    setSuccessMsg('Downloaded blank Hostinger MySQL schema (.sql).');
  };

  const isMysqlConnected = Boolean(dbStatus?.connected && dbStatus.mode === 'mysql');
  const isBusy = exporting || importingToMysql;

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      {/* Database Connection Status Banner */}
      <div className="rounded-xl border border-white/10 bg-[#0b0c12] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                isMysqlConnected
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-400/15 text-amber-300'
              }`}
            >
              <Database size={18} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Database Layer (Firebase Auth Kept for Logins)
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-extrabold text-white">
                {isMysqlConnected ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Hostinger MySQL Connected</span>
                  </>
                ) : dbStatus?.configured ? (
                  <>
                    <AlertTriangle size={15} className="text-rose-400" />
                    <span>MySQL Configured — Connection Failed (Firestore Fallback)</span>
                  </>
                ) : (
                  <>
                    <Server size={15} className="text-amber-300" />
                    <span>Firestore Active · Ready for Hostinger MySQL Env Vars</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={loadingStatus}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingStatus ? 'animate-spin' : ''} />
            Check Status
          </button>
        </div>

        {dbStatus?.error && (
          <div className="mt-3 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
            MySQL error: {dbStatus.error}
          </div>
        )}

        {isMysqlConnected && dbStatus?.tables && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Users', count: dbStatus.tables.users },
              { label: 'Progress', count: dbStatus.tables.user_progress },
              { label: 'Directory', count: dbStatus.tables.registered_users },
              { label: 'Leaderboard', count: dbStatus.tables.leaderboard },
              { label: 'High Scores', count: dbStatus.tables.highscores },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                  {item.label}
                </div>
                <div className="mt-0.5 text-base font-extrabold text-white">{item.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Firebase Admin Auth Check */}
      <div className="rounded-xl border border-white/10 bg-[#0b0c12] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Step 1 · Verify Firebase Admin Access
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {fbAdminEmail ? (
                <>
                  Signed in as <strong className="text-emerald-300">{fbAdminEmail}</strong>. All
                  private user profiles, daily streaks, and all 13 game progress buckets will be
                  included in your SQL export.
                </>
              ) : (
                <>
                  Sign in with your verified Firebase Admin Google account (
                  <strong className="text-slate-200">Phreakfrog@gmail.com</strong>) so the exporter
                  can include private player profiles and saved game progress alongside public
                  leaderboards.
                </>
              )}
            </p>
          </div>

          {fbAdminEmail ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-extrabold text-emerald-300">
              <CheckCircle2 size={14} />
              Admin Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleAdminGoogleSignIn()}
              disabled={fbSigningIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:brightness-105 disabled:opacity-60"
            >
              {fbSigningIn ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Sign In as Firebase Admin
            </button>
          )}
        </div>
      </div>

      {/* One-Click Export & Import Actions */}
      <div className="rounded-xl border border-amber-400/25 bg-[#0b0c12] p-4">
        <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
          Step 2 · One-Click Firestore → Hostinger MySQL Export
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Generates a ready-to-import <code className="text-amber-200">.sql</code> file with all
          table definitions and safe <code className="text-amber-200">ON DUPLICATE KEY UPDATE</code>{' '}
          inserts (zero data loss, safe to re-run).
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runExport('sql')}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:brightness-105 disabled:opacity-50"
          >
            {exporting && !importingToMysql ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export Firestore → Hostinger .sql
          </button>

          <button
            type="button"
            onClick={() => void runExport('json')}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            <FileJson size={14} />
            Backup JSON
          </button>

          <button
            type="button"
            onClick={handleDownloadBlankSchema}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            <FileCode2 size={14} />
            Blank Schema .sql
          </button>

          <button
            type="button"
            onClick={() => void runExport('mysql')}
            disabled={isBusy || !isMysqlConnected || !fbAdminEmail}
            title={
              !isMysqlConnected
                ? 'Connect Hostinger MySQL environment variables first'
                : !fbAdminEmail
                  ? 'Sign in as Firebase Admin first'
                  : 'Copy all Firestore data straight into connected MySQL database'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importingToMysql ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UploadCloud size={14} />
            )}
            Sync Directly to Connected MySQL
          </button>
        </div>

        {progressText && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200">
            <Loader2 size={13} className="animate-spin" />
            <span>{progressText}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            {successMsg}
          </div>
        )}

        {snapshot && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Last Export Snapshot</span>
              <span className="text-slate-500">
                {snapshot.includedPrivateUserData ? 'Full Export (Public + Private)' : 'Public Tables Only'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: 'Users', count: snapshot.users.length },
                { label: 'Progress', count: snapshot.userProgress.length },
                { label: 'Directory', count: snapshot.registeredUsers.length },
                { label: 'Leaderboard', count: snapshot.leaderboard.length },
                { label: 'High Scores', count: snapshot.highscores.length },
              ].map((row) => (
                <div key={row.label} className="rounded border border-white/10 bg-[#12131a] px-2.5 py-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400">{row.label}</div>
                  <div className="text-sm font-extrabold text-amber-300">{row.count}</div>
                </div>
              ))}
            </div>
            {snapshot.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-amber-200/90">
                {snapshot.warnings.slice(0, 4).map((w, idx) => (
                  <li key={idx}>• {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Hostinger Setup Instructions */}
      <div className="rounded-xl border border-white/10 bg-[#0b0c12] p-4">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
          Step 3 · Connect Hostinger MySQL
        </div>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-400">
          <li>
            In Hostinger (<strong className="text-slate-200">Websites → Manage → Databases → Management</strong>),
            create your MySQL database and click <strong className="text-slate-200">Import</strong> to upload the{' '}
            <code className="text-amber-200">.sql</code> file downloaded above.
          </li>
          <li>
            Add these server environment variables in Hostinger (or your Node.js host):{' '}
            <code className="text-amber-200">MYSQL_HOST</code>,{' '}
            <code className="text-amber-200">MYSQL_PORT</code> (3306),{' '}
            <code className="text-amber-200">MYSQL_DATABASE</code>,{' '}
            <code className="text-amber-200">MYSQL_USER</code>, and{' '}
            <code className="text-amber-200">MYSQL_PASSWORD</code>.
          </li>
          <li>
            Restart the Node.js app. It automatically detects Hostinger MySQL, routes all
            leaderboards, profiles, streaks, and game progress to MySQL, and keeps Firebase Auth
            for logins with zero disruption.
          </li>
        </ol>
      </div>
    </div>
  );
}
