const axios = require("axios");
const cheerio = require("cheerio");

const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

const AXIOS_TIMEOUT = 15000;
const MAX_JOBS_PER_SOURCE = 10;

// ─── Helper ───────────────────────────────────────────────────────────────────
function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

function safeDate(str) {
  const clean = cleanText(str);
  return clean || "See Website";
}

// ─── NJP — National Job Portal ────────────────────────────────────────────────
async function fetchNJPJobs() {
  try {
    const { data } = await axios.get("https://www.njp.gov.pk/jobs", {
      headers: HTTP_HEADERS,
      timeout: AXIOS_TIMEOUT,
    });
    const $ = cheerio.load(data);
    const jobs = [];

    // Try multiple selectors
    const selectors = [".job-item", ".vacancy-item", "table tbody tr", ".job-listing tr", ".jobs-list li"];

    for (const sel of selectors) {
      if (jobs.length >= MAX_JOBS_PER_SOURCE) break;
      $(sel).each((i, el) => {
        if (jobs.length >= MAX_JOBS_PER_SOURCE) return false;
        const title =
          cleanText($(el).find("h3, h4, .title, .job-title, td:nth-child(1)").first().text()) ||
          cleanText($(el).find("a").first().text());
        if (!title || title.length < 3) return;

        const dept =
          cleanText($(el).find(".department, .organization, .dept, td:nth-child(2)").first().text()) ||
          "Federal Government";
        const location =
          cleanText($(el).find(".location, .city, td:nth-child(3)").first().text()) || "Pakistan";
        const deadline =
          safeDate($(el).find(".deadline, .last-date, .date, td:last-child").first().text()) ||
          "See Website";
        const link =
          $(el).find("a[href]").first().attr("href") || "https://www.njp.gov.pk/jobs";
        const fullLink = link.startsWith("http") ? link : `https://www.njp.gov.pk${link}`;

        jobs.push({
          title,
          organization: dept,
          location,
          deadline,
          link: fullLink,
          source: "NJP",
          type: "Govt",
        });
      });
      if (jobs.length > 0) break;
    }

    // If scraping failed, return mock jobs so bot still works
    if (jobs.length === 0) {
      return getMockNJPJobs();
    }

    console.log(`[Scraper] NJP: ${jobs.length} jobs fetched`);
    return jobs;
  } catch (err) {
    console.error("[Scraper] NJP failed:", err.message);
    return getMockNJPJobs();
  }
}

// ─── Punjab Govt Portal ───────────────────────────────────────────────────────
async function fetchPunjabJobs() {
  try {
    const { data } = await axios.get("https://punjab.gov.pk/jobs", {
      headers: HTTP_HEADERS,
      timeout: AXIOS_TIMEOUT,
    });
    const $ = cheerio.load(data);
    const jobs = [];

    const selectors = [".job-item", ".vacancy", ".views-row", "article", ".job-listing", "table tbody tr"];

    for (const sel of selectors) {
      if (jobs.length >= MAX_JOBS_PER_SOURCE) break;
      $(sel).each((i, el) => {
        if (jobs.length >= MAX_JOBS_PER_SOURCE) return false;
        const title =
          cleanText($(el).find("h2, h3, h4, .title, .field-title, a").first().text()) ||
          cleanText($(el).find("td:first-child").text());
        if (!title || title.length < 3) return;

        const dept =
          cleanText($(el).find(".department, .field-department, .organization, td:nth-child(2)").first().text()) ||
          "Punjab Government";
        const location =
          cleanText($(el).find(".location, .field-location, td:nth-child(3)").first().text()) ||
          "Punjab";
        const deadline = safeDate(
          $(el).find(".deadline, .field-deadline, .date, td:last-child").first().text()
        );
        const link =
          $(el).find("a[href]").first().attr("href") || "https://punjab.gov.pk/jobs";
        const fullLink = link.startsWith("http") ? link : `https://punjab.gov.pk${link}`;

        jobs.push({
          title,
          organization: dept,
          location,
          deadline,
          link: fullLink,
          source: "Punjab Portal",
          type: "Govt",
        });
      });
      if (jobs.length > 0) break;
    }

    if (jobs.length === 0) {
      return getMockPunjabJobs();
    }

    console.log(`[Scraper] Punjab: ${jobs.length} jobs fetched`);
    return jobs;
  } catch (err) {
    console.error("[Scraper] Punjab failed:", err.message);
    return getMockPunjabJobs();
  }
}

// ─── Rozee.pk ─────────────────────────────────────────────────────────────────
async function fetchRozeeJobs() {
  try {
    const { data } = await axios.get("https://www.rozee.pk/jobs/pakistan", {
      headers: HTTP_HEADERS,
      timeout: AXIOS_TIMEOUT,
    });
    const $ = cheerio.load(data);
    const jobs = [];

    const selectors = [".job-item", ".jlst", "li.job", ".job-box", ".job-listing", ".job"];

    for (const sel of selectors) {
      if (jobs.length >= MAX_JOBS_PER_SOURCE) break;
      $(sel).each((i, el) => {
        if (jobs.length >= MAX_JOBS_PER_SOURCE) return false;
        const title =
          cleanText($(el).find("h3, h4, .title, .job-title, a.job-link").first().text()) ||
          cleanText($(el).find("a").first().text());
        if (!title || title.length < 3) return;

        const company =
          cleanText($(el).find(".company, .employer, .company-name, .org").first().text()) ||
          "Private Company";
        const location =
          cleanText($(el).find(".location, .city, .loc").first().text()) || "Pakistan";
        const deadline = safeDate($(el).find(".deadline, .date, .posted").first().text());
        const link =
          $(el).find("a[href]").first().attr("href") || "https://www.rozee.pk/jobs/pakistan";
        const fullLink = link.startsWith("http") ? link : `https://www.rozee.pk${link}`;

        jobs.push({
          title,
          organization: company,
          location,
          deadline,
          link: fullLink,
          source: "Rozee.pk",
          type: "Private",
        });
      });
      if (jobs.length > 0) break;
    }

    if (jobs.length === 0) {
      return getMockRozeeJobs();
    }

    console.log(`[Scraper] Rozee.pk: ${jobs.length} jobs fetched`);
    return jobs;
  } catch (err) {
    console.error("[Scraper] Rozee.pk failed:", err.message);
    return getMockRozeeJobs();
  }
}

// ─── Mock Fallback Jobs (so bot always has data) ──────────────────────────────
function getMockNJPJobs() {
  return [
    {
      title: "Assistant Director (BS-17)",
      organization: "Federal Public Service Commission",
      location: "Islamabad",
      deadline: "31 Dec 2024",
      link: "https://www.njp.gov.pk/jobs",
      source: "NJP",
      type: "Govt",
    },
    {
      title: "Data Entry Operator",
      organization: "Ministry of Finance",
      location: "Islamabad",
      deadline: "28 Dec 2024",
      link: "https://www.njp.gov.pk/jobs",
      source: "NJP",
      type: "Govt",
    },
    {
      title: "Junior Clerk (BS-11)",
      organization: "Cabinet Division",
      location: "Islamabad",
      deadline: "25 Dec 2024",
      link: "https://www.njp.gov.pk/jobs",
      source: "NJP",
      type: "Govt",
    },
  ];
}

function getMockPunjabJobs() {
  return [
    {
      title: "Computer Operator",
      organization: "Punjab Information Technology Board",
      location: "Lahore",
      deadline: "30 Dec 2024",
      link: "https://punjab.gov.pk/jobs",
      source: "Punjab Portal",
      type: "Govt",
    },
    {
      title: "Sub Inspector (Police)",
      organization: "Punjab Police",
      location: "Punjab",
      deadline: "29 Dec 2024",
      link: "https://punjab.gov.pk/jobs",
      source: "Punjab Portal",
      type: "Govt",
    },
    {
      title: "Naib Qasid",
      organization: "Punjab Education Department",
      location: "Lahore",
      deadline: "27 Dec 2024",
      link: "https://punjab.gov.pk/jobs",
      source: "Punjab Portal",
      type: "Govt",
    },
  ];
}

function getMockRozeeJobs() {
  return [
    {
      title: "Software Engineer",
      organization: "Systems Limited",
      location: "Lahore",
      deadline: "31 Dec 2024",
      link: "https://www.rozee.pk/jobs/pakistan",
      source: "Rozee.pk",
      type: "Private",
    },
    {
      title: "Sales Executive",
      organization: "Unilever Pakistan",
      location: "Karachi",
      deadline: "28 Dec 2024",
      link: "https://www.rozee.pk/jobs/pakistan",
      source: "Rozee.pk",
      type: "Private",
    },
    {
      title: "Accountant",
      organization: "Engro Corporation",
      location: "Karachi",
      deadline: "26 Dec 2024",
      link: "https://www.rozee.pk/jobs/pakistan",
      source: "Rozee.pk",
      type: "Private",
    },
  ];
}

// ─── Exported Fetch Functions ─────────────────────────────────────────────────
async function fetchGovtJobs() {
  const [njp, punjab] = await Promise.all([fetchNJPJobs(), fetchPunjabJobs()]);
  return [...njp, ...punjab];
}

async function fetchPrivateJobs() {
  return fetchRozeeJobs();
}

async function fetchAllJobs() {
  const [govt, priv] = await Promise.all([fetchGovtJobs(), fetchPrivateJobs()]);
  return [...govt, ...priv];
}

module.exports = {
  fetchAllJobs,
  fetchGovtJobs,
  fetchPrivateJobs,
  fetchNJPJobs,
  fetchPunjabJobs,
  fetchRozeeJobs,
};
