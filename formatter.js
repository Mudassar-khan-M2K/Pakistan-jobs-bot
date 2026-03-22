const {
  fetchAllJobs,
  fetchGovtJobs,
  fetchPrivateJobs,
  fetchNJPJobs,
  fetchPunjabJobs,
} = require("./scraper");

// ─── Stats Tracking ───────────────────────────────────────────────────────────
const stats = {
  jobsFetchedToday: 0,
  totalMessages: 0,
  lastFetch: null,
  sourceCounts: { NJP: 0, "Punjab Portal": 0, "Rozee.pk": 0 },
};

function updateStats(jobs) {
  stats.jobsFetchedToday += jobs.length;
  stats.lastFetch = getPakistanTime();
  jobs.forEach((j) => {
    if (stats.sourceCounts[j.source] !== undefined) stats.sourceCounts[j.source]++;
  });
}

// ─── Time Helper ──────────────────────────────────────────────────────────────
function getPakistanTime() {
  return new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇵🇰  *PAKISTAN JOBS BOT v2.0*  🤖
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assalam o Alaikum! 👋
Pakistan ka #1 Job Alert Bot!

📋 *JOBS MENU*
━━━━━━━━━━━━━━━
1️⃣  🏛️  Govt Jobs (Latest)
2️⃣  🏢  Private Jobs (Latest)
3️⃣  🌿  Punjab Govt Jobs
4️⃣  📌  NJP — National Portal
5️⃣  🇵🇰  All Jobs Today
━━━━━━━━━━━━━━━
⚙️  *BOT COMMANDS*
━━━━━━━━━━━━━━━
!ping    — Check bot status
!time    — Pakistan time
!stats   — Bot statistics
!about   — About this bot
!help    — Show this menu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Reply with number (1-5) or command
📢 Auto updates every 20 minutes!
⏰ ${getPakistanTime()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── Format a Single Job ──────────────────────────────────────────────────────
function formatSingleJob(job, index) {
  const icon = job.type === "Govt" ? "🏛️" : "🏢";
  const typeLabel = job.type === "Govt" ? "GOVT JOB" : "PRIVATE JOB";

  return `${index ? index + ". " : ""}${icon} *${typeLabel}*
━━━━━━━━━━━━━━━━━━━━━
💼 *Position:* ${job.title}
🏢 *Organization:* ${job.organization}
📍 *Location:* ${job.location}
📅 *Last Date:* ${job.deadline}
📌 *Source:* ${job.source}
🔗 *Apply Here:* ${job.link}
━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── Format a List of Jobs ────────────────────────────────────────────────────
function formatJobList(jobs, title, emoji) {
  if (!jobs || jobs.length === 0) {
    return `${emoji} *${title}*\n\n❌ No jobs found right now. Try again in a few minutes!\n📢 Jobs auto-update every 20 minutes.`;
  }

  let msg = `${emoji} *${title}*\n`;
  msg += `🕐 ${getPakistanTime()}\n`;
  msg += `📊 Showing ${jobs.length} job(s)\n`;
  msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  jobs.forEach((job, i) => {
    msg += formatSingleJob(job, i + 1) + "\n\n";
  });

  msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  msg += "🤖 Pakistan Jobs Bot\n";
  msg += "📢 Share with family & friends!";

  return msg;
}

// ─── Channel Broadcast Format ─────────────────────────────────────────────────
function formatChannelPost(allJobs) {
  const govtJobs = allJobs.filter((j) => j.type === "Govt");
  const privateJobs = allJobs.filter((j) => j.type === "Private");

  let msg = `🇵🇰 *PAKISTAN JOBS UPDATE* 🔔\n`;
  msg += `🕐 ${getPakistanTime()}\n`;
  msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  if (govtJobs.length > 0) {
    msg += `🏛️ *GOVERNMENT JOBS (${govtJobs.length})*\n\n`;
    govtJobs.slice(0, 5).forEach((job, i) => {
      msg += `*${i + 1}. ${job.title}*\n`;
      msg += `   🏢 ${job.organization}\n`;
      msg += `   📍 ${job.location}\n`;
      msg += `   📅 Last Date: ${job.deadline}\n`;
      msg += `   🔗 ${job.link}\n\n`;
    });
  }

  if (privateJobs.length > 0) {
    msg += `🏢 *PRIVATE JOBS (${privateJobs.length})*\n\n`;
    privateJobs.slice(0, 5).forEach((job, i) => {
      msg += `*${i + 1}. ${job.title}*\n`;
      msg += `   🏢 ${job.organization}\n`;
      msg += `   📍 ${job.location}\n`;
      msg += `   📅 Last Date: ${job.deadline}\n`;
      msg += `   🔗 ${job.link}\n\n`;
    });
  }

  msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  msg += "🤖 Pakistan Jobs Bot\n";
  msg += "📢 Share with family & friends!\n";
  msg += "🔔 Updates every 20 minutes";

  return msg;
}

// ─── Command Responses ────────────────────────────────────────────────────────
function buildPingResponse(getUptime) {
  const uptime = typeof getUptime === "function" ? getUptime() : "N/A";
  return `🏓 *Pong!* Bot is alive ✅\n\n⏱️ *Uptime:* ${uptime}\n🕐 *Time:* ${getPakistanTime()}\n\n🤖 Pakistan Jobs Bot is running smoothly!`;
}

function buildTimeResponse() {
  return `🕐 *Pakistan Standard Time (PKT)*\n\n📅 ${getPakistanTime()}\n\n🇵🇰 UTC+5:00 — Karachi / Islamabad`;
}

function buildStatsResponse() {
  return `📊 *BOT STATISTICS*
━━━━━━━━━━━━━━━━━━━━━
📌 *Jobs Fetched Today:* ${stats.jobsFetchedToday}
💬 *Total Messages:* ${stats.totalMessages}
🕐 *Last Fetch:* ${stats.lastFetch || "Not yet"}
━━━━━━━━━━━━━━━━━━━━━
📂 *By Source:*
   🏛️ NJP: ${stats.sourceCounts["NJP"]}
   🌿 Punjab: ${stats.sourceCounts["Punjab Portal"]}
   🏢 Rozee.pk: ${stats.sourceCounts["Rozee.pk"]}
━━━━━━━━━━━━━━━━━━━━━
🤖 Pakistan Jobs Bot v2.0`;
}

function buildAboutResponse() {
  return `🤖 *ABOUT PAKISTAN JOBS BOT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇵🇰 Pakistan ka #1 Job Alert Bot!

📋 *What I Do:*
• Scrape jobs every 20 minutes
• Post Govt & Private jobs
• Cover NJP, Punjab & Rozee.pk
• 24/7 automatic updates

📢 *Our Channel:*
https://whatsapp.com/channel/0029Vb7fEeo59PwPuRwAae2J

🔗 *Job Sources:*
   📌 NJP — njp.gov.pk
   🌿 Punjab — punjab.gov.pk
   🏢 Rozee — rozee.pk

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Type *menu* or *!help* for commands
📢 Share with family & friends! 🇵🇰`;
}

// ─── Message Handler ──────────────────────────────────────────────────────────
async function handleMessage(sock, msg, getUptime) {
  stats.totalMessages++;

  const jid = msg.key.remoteJid;
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";

  if (!text) return;

  const input = text.trim().toLowerCase();

  // Send typing indicator
  await sock.sendPresenceUpdate("composing", jid);

  try {
    // ── Menu triggers ──────────────────────────────────────────────────────────
    if (["hi", "hello", "menu", "start", "salam", "/start", "/menu", "!help", "!menu", "help"].includes(input)) {
      await sock.sendMessage(jid, { text: buildMenu() });
      return;
    }

    // ── Numbered replies ───────────────────────────────────────────────────────
    if (input === "1") {
      await sock.sendMessage(jid, { text: "⏳ Fetching Govt Jobs, please wait..." });
      const jobs = await fetchGovtJobs();
      updateStats(jobs);
      await sock.sendMessage(jid, { text: formatJobList(jobs, "GOVERNMENT JOBS", "🏛️") });
      return;
    }

    if (input === "2") {
      await sock.sendMessage(jid, { text: "⏳ Fetching Private Jobs, please wait..." });
      const jobs = await fetchPrivateJobs();
      updateStats(jobs);
      await sock.sendMessage(jid, { text: formatJobList(jobs, "PRIVATE JOBS", "🏢") });
      return;
    }

    if (input === "3") {
      await sock.sendMessage(jid, { text: "⏳ Fetching Punjab Govt Jobs, please wait..." });
      const jobs = await fetchPunjabJobs();
      updateStats(jobs);
      await sock.sendMessage(jid, { text: formatJobList(jobs, "PUNJAB GOVERNMENT JOBS", "🌿") });
      return;
    }

    if (input === "4") {
      await sock.sendMessage(jid, { text: "⏳ Fetching NJP Jobs, please wait..." });
      const jobs = await fetchNJPJobs();
      updateStats(jobs);
      await sock.sendMessage(jid, { text: formatJobList(jobs, "NJP — NATIONAL JOB PORTAL", "📌") });
      return;
    }

    if (input === "5") {
      await sock.sendMessage(jid, { text: "⏳ Fetching All Jobs, please wait..." });
      const jobs = await fetchAllJobs();
      updateStats(jobs);
      await sock.sendMessage(jid, { text: formatJobList(jobs, "ALL PAKISTAN JOBS TODAY", "🇵🇰") });
      return;
    }

    // ── Commands ───────────────────────────────────────────────────────────────
    if (input === "!ping" || input === "ping") {
      await sock.sendMessage(jid, { text: buildPingResponse(getUptime) });
      return;
    }

    if (input === "!time" || input === "time") {
      await sock.sendMessage(jid, { text: buildTimeResponse() });
      return;
    }

    if (input === "!stats" || input === "stats") {
      await sock.sendMessage(jid, { text: buildStatsResponse() });
      return;
    }

    if (input === "!about" || input === "about") {
      await sock.sendMessage(jid, { text: buildAboutResponse() });
      return;
    }

    // ── Default: show menu ──────────────────────────────────────────────────────
    await sock.sendMessage(jid, {
      text: `❓ Command not recognized.\n\n${buildMenu()}`,
    });
  } finally {
    await sock.sendPresenceUpdate("available", jid);
  }
}

module.exports = {
  handleMessage,
  formatChannelPost,
  formatJobList,
  getPakistanTime,
  updateStats,
  stats,
};
