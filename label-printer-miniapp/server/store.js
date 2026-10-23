import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const DEFAULT_DATABASE_PATH = fileURLToPath(new URL('./data/auth.sqlite', import.meta.url));

export function createStore({ db, databasePath = DEFAULT_DATABASE_PATH } = {}) {
  const owned = !db;
  if (!db) {
    const location = databasePath === ':memory:' ? databasePath : resolve(databasePath);
    if (location !== ':memory:') mkdirSync(dirname(location), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(location, { timeout: 3000, enableForeignKeyConstraints: true });
    if (location !== ':memory:') chmodSync(location, 0o600);
  }
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      openid TEXT NOT NULL,
      phone_masked TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      consent_accepted_at INTEGER NOT NULL,
      UNIQUE(app_id, openid)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  const cleanup = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const upsert = db.prepare(`INSERT INTO users (id, app_id, openid, phone_masked, consent_version, consent_accepted_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(app_id, openid) DO UPDATE SET
    phone_masked = excluded.phone_masked, consent_version = excluded.consent_version,
    -- The row keeps when the owner FIRST agreed; a later login must not replace
    -- the evidence with today's date.
    consent_accepted_at = MIN(users.consent_accepted_at, excluded.consent_accepted_at)`);
  const findUser = db.prepare('SELECT id, phone_masked FROM users WHERE app_id = ? AND openid = ?');
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const findSession = db.prepare(`SELECT users.id, users.phone_masked, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.app_id = ?`);
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const publicUser = (row) => ({ id: row.id, phoneMasked: row.phone_masked, nickName: '商跃用户' });
  let closed = false;
  return {
    issue({ appId, openid, phoneMasked, consentVersion, now, expiresAt, tokenHash }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        cleanup.run(now);
        upsert.run(`syu_${randomUUID()}`, appId, openid, phoneMasked, consentVersion, now);
        const user = findUser.get(appId, openid);
        insertSession.run(tokenHash, user.id, expiresAt);
        db.exec('COMMIT');
        return publicUser(user);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    session(tokenHash, now, appId) {
      cleanup.run(now);
      const row = findSession.get(tokenHash, now, appId);
      return row ? { user: publicUser(row), expiresAt: row.expires_at } : null;
    },
    revoke(tokenHash, now) { cleanup.run(now); deleteSession.run(tokenHash); },
    /**
     * Deletes one account and, by the cascade on sessions, every session it
     * holds. Run from the host when the owner asks for their data to be removed
     * (see scripts/delete-account.mjs); returns how many accounts matched.
     */
    deleteAccount({ appId, openid, userId }) {
      if (!appId || (!openid && !userId)) throw new Error('需要 appId 与 openid 或 userId');
      const statement = userId
        ? db.prepare('DELETE FROM users WHERE id = ? AND app_id = ?')
        : db.prepare('DELETE FROM users WHERE app_id = ? AND openid = ?');
      const result = userId ? statement.run(userId, appId) : statement.run(appId, openid);
      return Number(result.changes) || 0;
    },
    cleanup(now) { cleanup.run(now); },
    close() {
      if (closed) return;
      closed = true;
      if (owned) db.close();
    }
  };
}
