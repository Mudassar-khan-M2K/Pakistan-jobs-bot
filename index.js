require("dotenv").config();
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { usePostgreSQLAuthState } = require("./session");
const { startScheduler, setSocket } = require("./scheduler");
const {
  fetchAllJobs,
  fetchGovtJobs,
  fetchPrivateJobs,
  fetchNJPJobs,
  fetchPunjabJobs,
} = require("./scraper");
const {
  formatJobList,
  getMenuMessage,
  getAboutMessage,
  getErrorMessage,
} = require("./formatter");

// ─── Keep-alive Express server for Heroku ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("🤖 Pakistan Jobs Bot is running!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.listen(PORT, () => console.log(`🌐 Keep-alive server on port ${PORT}`));

// ─── Phone number ──────────────────────────────────────────────────────────────
const PHONE_NUMBER = process.env.PHONE_NUMBER || "923216046022";

// ─── Main bot function ─────────────────────────────────────────────────────────
async function startBot() {
  console.log("🚀 Starting Pakistan Jobs Bot...");

  const { state, saveCreds } = await usePostgreSQLAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }), // Keep logs clean
    printQRInTerminal: false,           // We use pairing code, not QR
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    browser: ["Pakistan Jobs Bot", "Chrome", "120.0.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 2000,
  });

  // ─── Pairing Code (if not registered) ────────────────────────────────────
  if (!sock.authState.creds.registered) {
    console.log("\n📱 Requesting pairing code for:", PHONE_NUMBER);
    await new Promise((r) => setTimeout(r, 3000)); // small delay

    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log("\n╔══════════════════════════════════╗");
      console.log(`║  🔑 PAIRING CODE: ${code}   ║`);
      console.log("╚══════════════════════════════════╝");
      console.log("\n📲 Steps to connect:");
      console.log("   1. Open WhatsApp on your phone");
      console.log("   2. Go to Settings → Linked Devices");
      console.log("   3. Tap 'Link with Phone Number'");
      console.log(`   4. Enter code: ${code}`);
      console.log("   5. Done! Bot will connect automatically ✅\n");
    } catch (err) {
      console.error("❌ Failed to get pairing code:", err.message);
      console.log("🔄 Retrying in 10 seconds...");
      setTimeout(startBot, 10000);
      return;
    }
  }

  // ─── Connection update handler ────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully! Bot is live 🚀");
      setSocket(sock);
      startScheduler();
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`⚠️ Connection closed (code: ${statusCode})`);

      if (shouldReconnect) {
        console.log("🔄 Reconnecting in 5 seconds...");
        setTimeout(startBot, 5000);
      } else {
        console.log("🚫 Logged out. Please restart and re-pair.");
      }
    }
  });

  // ─── Save credentials on update ───────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── Message handler (interactive menu) ──────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        // Skip if no message or if it's from us
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        const from = msg.key.remoteJid;

        // Skip group messages (only handle DMs and channel)
        if (from.endsWith("@g.us")) continue;

        // Get message text
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        const input = text.trim().toLowerCase();

        console.log(`📨 Message from ${from}: "${input}"`);

        // ─── Menu routing ───────────────────────────────────────────────
        if (input === "menu" || input === "hi" || input === "hello" || input === "start" || input === "salam") {
          await sock.sendMessage(from, { text: getMenuMessage() });

        } else if (input === "1") {
          await sock.sendMessage(from, { text: "⏳ Fetching latest Govt jobs..." });
          const jobs = await fetchGovtJobs();
          await sock.sendMessage(from, {
            text: formatJobList(jobs, "Latest Government Jobs 🏛️"),
          });

        } else if (input === "2") {
          await sock.sendMessage(from, { text: "⏳ Fetching latest Private jobs..." });
          const jobs = await fetchPrivateJobs();
          await sock.sendMessage(from, {
            text: formatJobList(jobs, "Latest Private Jobs 🏢"),
          });

        } else if (input === "3") {
          await sock.sendMessage(from, { text: "⏳ Fetching Punjab Jobs Portal..." });
          const jobs = await fetchPunjabJobs();
          await sock.sendMessage(from, {
            text: formatJobList(jobs, "Punjab Government Jobs 🌿"),
          });

        } else if (input === "4") {
          await sock.sendMessage(from, { text: "⏳ Fetching National Job Portal (NJP)..." });
          const jobs = await fetchNJPJobs();
          await sock.sendMessage(from, {
            text: formatJobList(jobs, "National Job Portal Jobs 📌"),
          });

        } else if (input === "5") {
          await sock.sendMessage(from, { text: "⏳ Fetching ALL jobs today..." });
          const jobs = await fetchAllJobs();
          await sock.sendMessage(from, {
            text: formatJobList(jobs, "All Pakistan Jobs Today 🇵🇰"),
          });

        } else if (input === "6") {
          await sock.sendMessage(from, { text: getAboutMessage() });

        } else {
          // Unknown input — show menu
          await sock.sendMessage(from, { text: getMenuMessage() });
        }
      } catch (err) {
        console.error("❌ Message handler error:", err.message);
      }
    }
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────────
startBot().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
