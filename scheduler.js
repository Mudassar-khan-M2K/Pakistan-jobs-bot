const cron = require("node-cron");
const { fetchAllJobs } = require("./scraper");
const { formatChannelPost, updateStats, getPakistanTime } = require("./formatter");

const CHANNEL_JID = "0029Vb7fEeo59PwPuRwAae2J@newsletter";

let schedulerTask = null;
let isSchedulerRunning = false;

// ─── Post Jobs to Channel ─────────────────────────────────────────────────────
async function postJobsToChannel(sock) {
  try {
    console.log(`[Scheduler] Fetching jobs at ${getPakistanTime()}...`);
    const jobs = await fetchAllJobs();

    if (!jobs || jobs.length === 0) {
      console.log("[Scheduler] No jobs to post.");
      return;
    }

    updateStats(jobs);

    const message = formatChannelPost(jobs);

    await sock.sendMessage(CHANNEL_JID, { text: message });

    console.log(`[Scheduler] ✅ Posted ${jobs.length} jobs to channel at ${getPakistanTime()}`);
  } catch (err) {
    console.error("[Scheduler] Error posting to channel:", err.message);
  }
}

// ─── Start Scheduler ──────────────────────────────────────────────────────────
function startScheduler(sock) {
  if (isSchedulerRunning) {
    console.log("[Scheduler] Already running. Skipping duplicate start.");
    return;
  }

  isSchedulerRunning = true;

  // Post immediately after 30s (called from index.js via setTimeout)
  postJobsToChannel(sock).catch(console.error);

  // Schedule every 20 minutes
  schedulerTask = cron.schedule(
    "*/20 * * * *",
    async () => {
      await postJobsToChannel(sock);
    },
    {
      timezone: "Asia/Karachi",
    }
  );

  console.log(`[Scheduler] Cron started — posting every 20 minutes. Channel: ${CHANNEL_JID}`);
}

// ─── Stop Scheduler ───────────────────────────────────────────────────────────
function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    isSchedulerRunning = false;
    console.log("[Scheduler] Stopped.");
  }
}

module.exports = { startScheduler, stopScheduler, postJobsToChannel };
