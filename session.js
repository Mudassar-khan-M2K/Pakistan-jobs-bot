const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

let pool = null;
const memoryStore = {};
const AUTH_FOLDER = "/tmp/auth_info";

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function initDB() {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_session (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Database initialized");
  } catch (err) {
    console.error("❌ DB init failed:", err.message);
  }
}

async function saveSession(key, value) {
  memoryStore[key] = value;
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO whatsapp_session (id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  } catch (err) {
    console.error("❌ saveSession error:", err.message);
  }
}

async function getSession(key) {
  if (memoryStore[key]) return memoryStore[key];
  const p = getPool();
  if (!p) return null;
  try {
    const res = await p.query(`SELECT data FROM whatsapp_session WHERE id = $1`, [key]);
    if (res.rows.length > 0) {
      const val = JSON.parse(res.rows[0].data);
      memoryStore[key] = val;
      return val;
    }
  } catch (err) {
    console.error("❌ getSession error:", err.message);
  }
  return null;
}

async function deleteSession(key) {
  delete memoryStore[key];
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`DELETE FROM whatsapp_session WHERE id = $1`, [key]);
  } catch (err) {}
}

// Save all local auth files to DB
async function saveSessionToDB(data) {
  await saveSession("session_files", data);
}

// Load all auth files from DB
async function loadSessionFromDB() {
  return await getSession("session_files");
}

// Decode Levanter session ID and write creds to disk
async function decodeLevanter(sessionId) {
  try {
    const axios = require("axios");
    const encoded = sessionId.replace("levanter_", "");

    if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

    // Try Levanter API endpoints
    const urls = [
      `https://session.levanter.biz.id/${encoded}`,
      `https://api.levanter.biz.id/session/${encoded}`,
    ];

    for (const url of urls) {
      try {
        console.log("Trying Levanter API:", url);
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data) {
          const data = res.data;
          if (typeof data === "object") {
            // Write each key as a file
            for (const [key, val] of Object.entries(data)) {
              const filename = key.includes(".json") ? key : `${key}.json`;
              fs.writeFileSync(path.join(AUTH_FOLDER, filename), JSON.stringify(val));
            }
            console.log("✅ Levanter session decoded and saved!");
            return true;
          }
        }
      } catch (e) {
        console.log("API failed:", e.message);
      }
    }

    // Try base64 decode
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const data = JSON.parse(decoded);
      fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), JSON.stringify(data));
      console.log("✅ Session decoded from base64!");
      return true;
    } catch (e) {}

    return false;
  } catch (err) {
    console.error("Levanter decode error:", err.message);
    return false;
  }
}

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
          for (const [id, value] of Object.entries(ids || {})) {
            if (value) await saveSession(`${type}:${id}`, value);
            else await deleteSession(`${type}:${id}`);
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

module.exports = {
  usePostgreSQLAuthState,
  saveSessionToDB,
  loadSessionFromDB,
  decodeLevanter,
  initDB,
};
