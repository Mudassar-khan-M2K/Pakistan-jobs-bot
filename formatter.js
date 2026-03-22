// ─── Format a single job post ────────────────────────────────────────────────
function formatJob(job, index = null) {
  const badge = job.type === "Govt" ? "🏛️ *GOVT JOB*" : "🏢 *PRIVATE JOB*";
  const sourceBadge =
    job.source === "NJP"
      ? "📌 National Job Portal"
      : job.source === "Punjab Portal"
      ? "📌 Punjab Jobs Portal"
      : "📌 Rozee.pk";

  const num = index !== null ? `*${index + 1}.* ` : "";

  return (
    `${num}${badge}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💼 *Position:* ${job.title}\n` +
    `🏢 *Organization:* ${job.dept}\n` +
    `📍 *Location:* ${job.location}\n` +
    `📅 *Last Date:* ${job.deadline}\n` +
    `${sourceBadge}\n` +
    `🔗 *Apply:* ${job.link}\n` +
    `━━━━━━━━━━━━━━━━━━━━━`
  );
}

// ─── Format a list of jobs ────────────────────────────────────────────────────
function formatJobList(jobs, title = "📋 Latest Pakistan Jobs") {
  if (!jobs || jobs.length === 0) {
    return `❌ No jobs found at the moment. Please try again later.`;
  }

  const header =
    `🇵🇰 *${title}*\n` +
    `🕐 Updated: ${getPKTime()}\n` +
    `📊 Total: ${jobs.length} jobs\n\n`;

  const body = jobs.map((job, i) => formatJob(job, i)).join("\n\n");

  const footer =
    `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🤖 *Pakistan Jobs Bot*\n` +
    `📢 Follow our channel for daily updates!\n` +
    `⏰ Updates every 20 minutes`;

  return header + body + footer;
}

// ─── Format channel post (shorter, cleaner) ───────────────────────────────────
function formatChannelPost(jobs) {
  if (!jobs || jobs.length === 0) return null;

  const govtJobs = jobs.filter((j) => j.type === "Govt");
  const privateJobs = jobs.filter((j) => j.type === "Private");

  let msg =
    `🇵🇰 *PAKISTAN JOBS UPDATE*\n` +
    `🕐 ${getPKTime()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (govtJobs.length > 0) {
    msg += `🏛️ *GOVERNMENT JOBS (${govtJobs.length})*\n\n`;
    govtJobs.slice(0, 5).forEach((job, i) => {
      msg +=
        `*${i + 1}. ${job.title}*\n` +
        `   🏢 ${job.dept}\n` +
        `   📍 ${job.location}\n` +
        `   📅 Last Date: ${job.deadline}\n` +
        `   🔗 ${job.link}\n\n`;
    });
  }

  if (privateJobs.length > 0) {
    msg += `\n🏢 *PRIVATE JOBS (${privateJobs.length})*\n\n`;
    privateJobs.slice(0, 3).forEach((job, i) => {
      msg +=
        `*${i + 1}. ${job.title}*\n` +
        `   🏢 ${job.dept}\n` +
        `   📍 ${job.location}\n` +
        `   📅 Last Date: ${job.deadline}\n` +
        `   🔗 ${job.link}\n\n`;
    });
  }

  msg +=
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🤖 *Pakistan Jobs Bot*\n` +
    `📢 Share with friends & family!\n` +
    `🔔 Subscribe for updates every 20 min`;

  return msg;
}

// ─── Menu message ─────────────────────────────────────────────────────────────
function getMenuMessage() {
  return (
    `🇵🇰 *PAKISTAN JOBS BOT* 🤖\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Assalam o Alaikum! 👋\n` +
    `Welcome to Pakistan's #1 Job Alert Bot!\n\n` +
    `📋 *MAIN MENU*\n\n` +
    `1️⃣  Latest Govt Jobs\n` +
    `2️⃣  Latest Private Jobs\n` +
    `3️⃣  Punjab Jobs Portal\n` +
    `4️⃣  National Job Portal (NJP)\n` +
    `5️⃣  All Jobs Today\n` +
    `6️⃣  ℹ️  About Bot\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💬 *Reply with a number (1-6)*\n` +
    `📢 Or join our channel for auto updates!\n\n` +
    `🕐 ${getPKTime()}`
  );
}

// ─── About message ────────────────────────────────────────────────────────────
function getAboutMessage() {
  return (
    `🤖 *PAKISTAN JOBS BOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 *Version:* 1.0\n` +
    `🎯 *Purpose:* Automated Pakistan job alerts\n\n` +
    `📊 *Sources:*\n` +
    `   • National Job Portal (njp.gov.pk)\n` +
    `   • Punjab Government Jobs Portal\n` +
    `   • Rozee.pk (Private sector)\n\n` +
    `⚙️ *Features:*\n` +
    `   • Auto updates every 20 minutes\n` +
    `   • Govt & Private jobs\n` +
    `   • All Pakistan coverage\n` +
    `   • Interactive menu\n\n` +
    `📢 *Channel:* https://whatsapp.com/channel/0029Vb7fEeo59PwPuRwAae2J\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🇵🇰 Serving Pakistan since 2024\n` +
    `💚 Made with ❤️ for Pakistanis`
  );
}

// ─── Error message ────────────────────────────────────────────────────────────
function getErrorMessage() {
  return (
    `❌ *Invalid option!*\n\n` +
    `Please reply with a number from *1 to 6*\n\n` +
    `Type *menu* to see options again 📋`
  );
}

// ─── Pakistan time ────────────────────────────────────────────────────────────
function getPKTime() {
  return new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

module.exports = {
  formatJob,
  formatJobList,
  formatChannelPost,
  getMenuMessage,
  getAboutMessage,
  getErrorMessage,
  getPKTime,
};
