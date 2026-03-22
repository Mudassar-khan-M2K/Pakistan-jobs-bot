const cron = require("node-cron");
const { fetchAllJobs } = require("./scraper");
const { formatChannelPost } = require("./formatter");

let sock = null;
const CHANNEL_ID = "0029Vb7fEeo59PwPuRwAae2J"; // Your WhatsApp channel

function setSocket(socket) {
  sock = socket;
}

// ─── Send to channel ──────────────────────────────────────────────────────────
async function sendToChannel(message) {
  if (!sock) {
    console.log("❌ Socket not ready, skipping channel post");
    return;
  }

  try {
    // WhatsApp channel JID format
    const channelJid = `${CHANNEL_ID}@newsletter`;
    await sock.sendMessage(channelJid, { text: message });
    console.log("✅ Posted to channel successfully");
  } catch (err) {
    console.error("❌ Failed to post to channel:", err.message);
  }
}

// ─── Main job posting function ────────────────────────────────────────────────
async function postJobsToChannel() {
  console.log("⏰ Cron triggered — fetching & posting jobs...");
  try {
    const jobs = await fetchAllJobs();
    if (!jobs || jobs.length === 0) {
      console.log("⚠️ No jobs found this cycle, skipping post");
      return;
    }

    const message = formatChannelPost(jobs);
    if (message) {
      await sendToChannel(message);
    }
  } catch (err) {
    console.error("❌ Scheduler error:", err.message);
  }
}

// ─── Start scheduler ──────────────────────────────────────────────────────────
function startScheduler() {
  console.log("🕐 Scheduler started — posting every 20 minutes");

  // Every 20 minutes
  cron.schedule("*/20 * * * *", async () => {
    await postJobsToChannel();
  });

  // Post immediately on first start (after 30 sec delay for socket to connect)
  setTimeout(async () => {
    console.log("🚀 First post on startup...");
    await postJobsToChannel();
  }, 30000);
}

module.exports = { startScheduler, setSocket, sendToChannel };
