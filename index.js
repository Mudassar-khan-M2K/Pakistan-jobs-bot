require("dotenv").config();
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { restoreSession, backupSession } = require("./session");
const { handleMessage } = require("./formatter");
const { startScheduler, stopScheduler } = require("./scheduler");

const AUTH_DIR = "/tmp/auth_info";
const PHONE_NUMBER = process.env.PHONE_NUMBER || "923216046022";

// ─── Express Keep-Alive ───────────────────────────────────────────────────────
const app = express();
app.get("/", (req, res) => res.send("🤖 Pakistan Jobs Bot is running!"));
app.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: process.uptime(), pid: process.pid })
);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Keep-alive listening on port ${PORT}`));

// ─── Bot State ────────────────────────────────────────────────────────────────
let botSocket = null;
let isConnected = false;
let startTime = Date.now();
let reconnectAttempts = 0;

function getUptime() {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Main Bot Function ────────────────────────────────────────────────────────
async function startBot() {
  try {
    console.log("[Bot] Starting Pakistan Jobs Bot...");

    // Ensure auth dir exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // Restore session from DB if no local creds
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (!fs.existsSync(credsPath)) {
      console.log("[Session] No local creds found. Attempting DB restore...");
      await restoreSession(AUTH_DIR);
    } else {
      console.log("[Session] Local creds found. Using existing session.");
    }

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[Baileys] Using WA version: ${version.join(".")}, isLatest: ${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["Ubuntu", "Chrome", "120.0.0.0"],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,
    });

    botSocket = sock;

    // ─── Pairing Code ─────────────────────────────────────────────────────────
    if (!state.creds.registered) {
      console.log("[Auth] Not registered. Waiting for WebSocket to open...");

      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (sock.ws && sock.ws.readyState === 1) {
            clearInterval(interval);
            resolve();
          }
        }, 300);
        // Timeout after 10 seconds regardless
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });

      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log("╔══════════════════════════════════════╗");
        console.log("║                                      ║");
        console.log(`║   PAIRING CODE: ${code.padEnd(20)} ║`);
        console.log("║                                      ║");
        console.log("╚══════════════════════════════════════╝");
        console.log("[Auth] Enter this code in WhatsApp > Linked Devices > Link a Device");
      } catch (err) {
        console.error("[Auth] Failed to get pairing code:", err.message);
      }
    }

    // ─── Connection Events ────────────────────────────────────────────────────
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === "connecting") {
        console.log("[Connection] Connecting to WhatsApp...");
      }

      if (connection === "open") {
        console.log("[Connection] ✅ Connected to WhatsApp!");
        isConnected = true;
        reconnectAttempts = 0;

        // Backup session to DB
        await backupSession(AUTH_DIR);

        // Start job scheduler after 30 seconds
        setTimeout(() => {
          startScheduler(sock);
          console.log("[Scheduler] Job scheduler started!");
        }, 30000);
      }

      if (connection === "close") {
        isConnected = false;
        stopScheduler();

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = Object.keys(DisconnectReason).find(
          (k) => DisconnectReason[k] === statusCode
        );

        console.log(`[Connection] Disconnected. Reason: ${reason || statusCode}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("[Connection] Logged out! Clearing session...");
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {
            console.error("[Session] Failed to clear session:", e.message);
          }
          console.log("[Connection] Session cleared. Please restart the bot to re-pair.");
          process.exit(1);
        } else {
          reconnectAttempts++;
          const delay = Math.min(5000 * reconnectAttempts, 30000);
          console.log(`[Connection] Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts})`);
          setTimeout(startBot, delay);
        }
      }
    });

    // ─── Credentials Update ───────────────────────────────────────────────────
    sock.ev.on("creds.update", async () => {
      await saveCreds();
      await backupSession(AUTH_DIR);
    });

    // ─── Messages ─────────────────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        try {
          // Skip group messages
          if (msg.key.remoteJid?.endsWith("@g.us")) continue;
          // Skip messages from self
          if (msg.key.fromMe) continue;
          // Skip status updates
          if (msg.key.remoteJid === "status@broadcast") continue;
          // Skip newsletter messages
          if (msg.key.remoteJid?.endsWith("@newsletter")) continue;

          await handleMessage(sock, msg, getUptime);
        } catch (err) {
          console.error("[Messages] Error handling message:", err.message);
        }
      }
    });

    return sock;
  } catch (err) {
    console.error("[Bot] Fatal error:", err.message);
    reconnectAttempts++;
    const delay = Math.min(5000 * reconnectAttempts, 30000);
    console.log(`[Bot] Retrying in ${delay / 1000}s...`);
    setTimeout(startBot, delay);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log("🇵🇰 Pakistan Jobs Bot — Starting up...");
startBot();

// Export for other modules
module.exports = { getSocket: () => botSocket, isConnected: () => isConnected, getUptime };
