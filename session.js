const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

let pool = null;

// ─── DB Connection ────────────────────────────────────────────────────────────
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });
  }
  return pool;
}

// ─── Ensure Table Exists ──────────────────────────────────────────────────────
async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_session (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ─── Backup Session Files to DB ───────────────────────────────────────────────
async function backupSession(authDir) {
  const db = getPool();
  if (!db) {
    console.log("[Session] No DATABASE_URL set. Skipping backup.");
    return;
  }

  const client = await db.connect().catch((err) => {
    console.error("[Session] DB connect failed:", err.message);
    return null;
  });

  if (!client) return;

  try {
    await ensureTable(client);

    if (!fs.existsSync(authDir)) {
      console.log("[Session] Auth dir not found. Nothing to backup.");
      return;
    }

    const files = fs.readdirSync(authDir);
    const sessionData = {};

    for (const file of files) {
      const filePath = path.join(authDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        sessionData[file] = content;
      } catch (e) {
        // Skip unreadable files
      }
    }

    if (Object.keys(sessionData).length === 0) {
      console.log("[Session] No session files to backup.");
      return;
    }

    await client.query(
      `INSERT INTO whatsapp_session (id, data, updated_at)
       VALUES ('main_session', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(sessionData)]
    );

    console.log(`[Session] ✅ Backed up ${Object.keys(sessionData).length} file(s) to DB.`);
  } catch (err) {
    console.error("[Session] Backup error:", err.message);
  } finally {
    client.release();
  }
}

// ─── Restore Session Files from DB ───────────────────────────────────────────
async function restoreSession(authDir) {
  const db = getPool();
  if (!db) {
    console.log("[Session] No DATABASE_URL set. Skipping restore.");
    return false;
  }

  const client = await db.connect().catch((err) => {
    console.error("[Session] DB connect failed:", err.message);
    return null;
  });

  if (!client) return false;

  try {
    await ensureTable(client);

    const result = await client.query(
      "SELECT data FROM whatsapp_session WHERE id = 'main_session' LIMIT 1"
    );

    if (result.rows.length === 0) {
      console.log("[Session] No session found in DB.");
      return false;
    }

    const sessionData = JSON.parse(result.rows[0].data);
    const files = Object.keys(sessionData);

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    for (const [filename, content] of Object.entries(sessionData)) {
      const filePath = path.join(authDir, filename);
      fs.writeFileSync(filePath, content, "utf-8");
    }

    console.log(`[Session] ✅ Restored ${files.length} session file(s) from DB.`);
    return true;
  } catch (err) {
    console.error("[Session] Restore error:", err.message);
    return false;
  } finally {
    client.release();
  }
}

// ─── Clear Session from DB ────────────────────────────────────────────────────
async function clearSession() {
  const db = getPool();
  if (!db) return;

  const client = await db.connect().catch(() => null);
  if (!client) return;

  try {
    await client.query("DELETE FROM whatsapp_session WHERE id = 'main_session'");
    console.log("[Session] Session cleared from DB.");
  } catch (err) {
    console.error("[Session] Clear error:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { backupSession, restoreSession, clearSession };
