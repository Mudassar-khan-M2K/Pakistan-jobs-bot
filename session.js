const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Initialize DB table
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_session (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✅ Database initialized");
}

// Save session key
async function saveSession(key, value) {
  const data = JSON.stringify(value);
  await pool.query(
    `INSERT INTO whatsapp_session (id, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
    [key, data]
  );
}

// Get session key
async function getSession(key) {
  const res = await pool.query(
    `SELECT data FROM whatsapp_session WHERE id = $1`,
    [key]
  );
  if (res.rows.length > 0) {
    return JSON.parse(res.rows[0].data);
  }
  return null;
}

// Delete session key
async function deleteSession(key) {
  await pool.query(`DELETE FROM whatsapp_session WHERE id = $1`, [key]);
}

// Get all session keys with prefix
async function getAllSessionKeys(prefix) {
  const res = await pool.query(
    `SELECT id FROM whatsapp_session WHERE id LIKE $1`,
    [`${prefix}%`]
  );
  return res.rows.map((r) => r.id);
}

// PostgreSQL auth state for Baileys
async function usePostgreSQLAuthState() {
  await initDB();

  const authState = {
    creds: (await getSession("creds")) || {},
    keys: {
      get: async (type, ids) => {
        const data = {};
        for (const id of ids) {
          const val = await getSession(`${type}:${id}`);
          if (val) data[id] = val;
        }
        return data;
      },
      set: async (data) => {
        for (const [type, ids] of Object.entries(data)) {
          for (const [id, value] of Object.entries(ids)) {
            if (value) {
              await saveSession(`${type}:${id}`, value);
            } else {
              await deleteSession(`${type}:${id}`);
            }
          }
        }
      },
    },
  };

  const saveCreds = async (creds) => {
    await saveSession("creds", creds);
  };

  return { state: authState, saveCreds };
}

module.exports = { usePostgreSQLAuthState, initDB };
