require("dotenv").config();
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const { saveSessionToDB, loadSessionFromDB, decodeLevanter } = require("./session");
const { startScheduler, setSocket } = require("./scheduler");
const { fetchAllJobs, fetchGovtJobs, fetchPrivateJobs, fetchNJPJobs, fetchPunjabJobs } = require("./scraper");
const { formatJobList, getMenuMessage, getAboutMessage } = require("./formatter");

// Keep-alive server
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🤖 Pakistan Jobs Bot is running!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.listen(PORT, () => console.log("Server on port " + PORT));

const PHONE_NUMBER = (process.env.PHONE_NUMBER || "923216046022").replace(/[^0-9]/g, "");
const SESSION_ID = process.env.SESSION_ID || "levanter_224192240326c64b71a91a7f15d95d7efa";
const AUTH_FOLDER = "/tmp/auth_info";

// Step 1: Try to restore session from DB, then Levanter
async function prepareSession() {
  if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

  // Check if creds.json already exists
  if (fs.existsSync(`${AUTH_FOLDER}/creds.json`)) {
    console.log("✅ Session already on disk");
    return true;
  }

  // Try restore from PostgreSQL DB
  try {
    const data = await loadSessionFromDB();
    if (data && Object.keys(data).length > 0) {
      for (const [filename, content] of Object.entries(data)) {
        const fname = filename.includes(".json") ? filename : `${filename}.json`;
        fs.writeFileSync(`${AUTH_FOLDER}/${fname}`, JSON.stringify(content));
      }
      console.log("✅ Session restored from DB");
      return true;
    }
  } catch (e) {
    console.log("DB restore skipped:", e.message);
  }

  // Try Levanter session ID
  if (SESSION_ID && SESSION_ID.startsWith("levanter_")) {
    console.log("🔑 Trying to decode Levanter session...");
    const ok = await decodeLevanter(SESSION_ID);
    if (ok) return true;
  }

  console.log("⚠️ No existing session found, will need pairing code");
  return false;
}

// Backup session files to DB after connect
async function backupSession() {
  try {
    if (!fs.existsSync(AUTH_FOLDER)) return;
    const files = fs.readdirSync(AUTH_FOLDER);
    const data = {};
    for (const file of files) {
      try {
        data[file] = JSON.parse(fs.readFileSync(`${AUTH_FOLDER}/${file}`, "utf8"));
      } catch (e) {}
    }
    if (Object.keys(data).length > 0) {
      await saveSessionToDB(data);
      console.log("✅ Session backed up to DB");
    }
  } catch (err) {
    console.error("Session backup failed:", err.message);
  }
}

async function startBot() {
  console.log("🚀 Starting Pakistan Jobs Bot...");

  await prepareSession();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();
  console.log("Baileys version:", version.join("."));

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "120.0.0.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
  });

  // Only request pairing if not registered via session
  if (!state.creds.registered) {
    console.log("📱 No session found. Requesting pairing code for:", PHONE_NUMBER);
    await new Promise(r => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log("================================================");
      console.log("   🔑 PAIRING CODE: " + code);
      console.log("================================================");
      console.log("WhatsApp > Settings > Linked Devices > Link with Phone Number");
      console.log("Enter: " + code);
    } catch (err) {
      console.error("Pairing code error:", err.message);
      setTimeout(startBot, 20000);
      return;
    }
  } else {
    console.log("✅ Session loaded! Connecting without pairing...");
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp connected! Bot is live 🚀");
      setSocket(sock);
      startScheduler();
      await backupSession();
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("Connection closed, code:", code);
      if (code === DisconnectReason.loggedOut) {
        console.log("Logged out! Clearing session...");
        try { fs.rmSync(AUTH_FOLDER, { recursive: true }); } catch(e) {}
      } else {
        console.log("Reconnecting in 5s...");
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await backupSession();
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const from = msg.key.remoteJid;
        if (from.endsWith("@g.us")) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text || "";
        const input = text.trim().toLowerCase();
        console.log("Msg from " + from + ": " + input);

        if (["menu","hi","hello","start","salam",""].includes(input)) {
          await sock.sendMessage(from, { text: getMenuMessage() });
        } else if (input === "1") {
          await sock.sendMessage(from, { text: "⏳ Fetching Govt jobs..." });
          await sock.sendMessage(from, { text: formatJobList(await fetchGovtJobs(), "Government Jobs 🏛️") });
        } else if (input === "2") {
          await sock.sendMessage(from, { text: "⏳ Fetching Private jobs..." });
          await sock.sendMessage(from, { text: formatJobList(await fetchPrivateJobs(), "Private Jobs 🏢") });
        } else if (input === "3") {
          await sock.sendMessage(from, { text: "⏳ Fetching Punjab jobs..." });
          await sock.sendMessage(from, { text: formatJobList(await fetchPunjabJobs(), "Punjab Jobs 🌿") });
        } else if (input === "4") {
          await sock.sendMessage(from, { text: "⏳ Fetching NJP jobs..." });
          await sock.sendMessage(from, { text: formatJobList(await fetchNJPJobs(), "NJP Jobs 📌") });
        } else if (input === "5") {
          await sock.sendMessage(from, { text: "⏳ Fetching all jobs..." });
          await sock.sendMessage(from, { text: formatJobList(await fetchAllJobs(), "All Pakistan Jobs 🇵🇰") });
        } else if (input === "6") {
          await sock.sendMessage(from, { text: getAboutMessage() });
        } else {
          await sock.sendMessage(from, { text: getMenuMessage() });
        }
      } catch (err) {
        console.error("Message error:", err.message);
      }
    }
  });
}

startBot().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
