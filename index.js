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
} = require("./formatter");

// Keep-alive Express server for Heroku
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Pakistan Jobs Bot is running!"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.listen(PORT, () => console.log("Keep-alive server on port " + PORT));

const PHONE_NUMBER = (process.env.PHONE_NUMBER || "923216046022").replace(/[^0-9]/g, "");

function waitForWS(sock, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  return new Promise(function(resolve) {
    if (sock.ws && sock.ws.readyState === 1) return resolve();
    var interval = setInterval(function() {
      if (sock.ws && sock.ws.readyState === 1) {
        clearInterval(interval);
        resolve();
      }
    }, 300);
    setTimeout(function() {
      clearInterval(interval);
      resolve();
    }, timeoutMs);
  });
}

async function startBot() {
  console.log("Starting Pakistan Jobs Bot...");

  var state, saveCreds;
  try {
    var result = await usePostgreSQLAuthState();
    state = result.state;
    saveCreds = result.saveCreds;
  } catch (err) {
    console.error("DB error:", err.message);
    state = { creds: {}, keys: { get: async function() { return {}; }, set: async function() {} } };
    saveCreds = async function() {};
  }

  var versionResult = await fetchLatestBaileysVersion();
  console.log("Baileys version:", versionResult.version.join("."));

  var sock = makeWASocket({
    version: versionResult.version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    browser: ["Pakistan Jobs Bot", "Chrome", "120.0.0"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  if (!sock.authState.creds.registered) {
    console.log("Requesting pairing code for: " + PHONE_NUMBER);
    await waitForWS(sock, 10000);
    console.log("WebSocket ready, requesting pairing code...");

    try {
      var code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log("╔══════════════════════════════════╗");
      console.log("║   PAIRING CODE: " + code + "    ║");
      console.log("╚══════════════════════════════════╝");
      console.log("Open WhatsApp > Settings > Linked Devices > Link with Phone Number");
      console.log("Enter this code: " + code);
    } catch (err) {
      console.error("Pairing code error:", err.message);
      console.log("Will retry in 15 seconds...");
      setTimeout(startBot, 15000);
      return;
    }
  }

  sock.ev.on("connection.update", async function(update) {
    var connection = update.connection;
    var lastDisconnect = update.lastDisconnect;

    if (connection === "open") {
      console.log("WhatsApp connected! Bot is live.");
      setSocket(sock);
      startScheduler();
    }

    if (connection === "close") {
      var statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode : 0;
      var shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed, code: " + statusCode);
      if (shouldReconnect) {
        console.log("Reconnecting in 5 seconds...");
        setTimeout(startBot, 5000);
      } else {
        console.log("Logged out. Restart and re-pair.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async function(data) {
    var messages = data.messages;
    var type = data.type;
    if (type !== "notify") return;

    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        var from = msg.key.remoteJid;
        if (from.endsWith("@g.us")) continue;

        var text = (msg.message && msg.message.conversation)
          || (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.text)
          || "";

        var input = text.trim().toLowerCase();
        console.log("Message from " + from + ": " + input);

        if (["menu","hi","hello","start","salam",""].indexOf(input) !== -1) {
          await sock.sendMessage(from, { text: getMenuMessage() });
        } else if (input === "1") {
          await sock.sendMessage(from, { text: "Fetching latest Govt jobs..." });
          var jobs = await fetchGovtJobs();
          await sock.sendMessage(from, { text: formatJobList(jobs, "Latest Government Jobs") });
        } else if (input === "2") {
          await sock.sendMessage(from, { text: "Fetching latest Private jobs..." });
          var jobs = await fetchPrivateJobs();
          await sock.sendMessage(from, { text: formatJobList(jobs, "Latest Private Jobs") });
        } else if (input === "3") {
          await sock.sendMessage(from, { text: "Fetching Punjab Jobs..." });
          var jobs = await fetchPunjabJobs();
          await sock.sendMessage(from, { text: formatJobList(jobs, "Punjab Government Jobs") });
        } else if (input === "4") {
          await sock.sendMessage(from, { text: "Fetching NJP jobs..." });
          var jobs = await fetchNJPJobs();
          await sock.sendMessage(from, { text: formatJobList(jobs, "National Job Portal") });
        } else if (input === "5") {
          await sock.sendMessage(from, { text: "Fetching ALL jobs today..." });
          var jobs = await fetchAllJobs();
          await sock.sendMessage(from, { text: formatJobList(jobs, "All Pakistan Jobs Today") });
        } else if (input === "6") {
          await sock.sendMessage(from, { text: getAboutMessage() });
        } else {
          await sock.sendMessage(from, { text: getMenuMessage() });
        }
      } catch (err) {
        console.error("Message handler error:", err.message);
      }
    }
  });
}

startBot().catch(function(err) {
  console.error("Fatal error:", err);
  process.exit(1);
});
