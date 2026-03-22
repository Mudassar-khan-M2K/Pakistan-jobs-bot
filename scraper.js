const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// ─── NJP (National Job Portal) Scraper ───────────────────────────────────────
async function scrapeNJP() {
  try {
    const url = "https://www.njp.gov.pk/jobs";
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const jobs = [];

    // NJP job listings
    $(".job-item, .vacancy-item, .job-listing, tr.job-row, .job-card").each((i, el) => {
      if (i >= 10) return; // max 10 per scrape cycle

      const title =
        $(el).find(".job-title, .title, td:nth-child(1), h3, h4").first().text().trim() ||
        $(el).find("a").first().text().trim();

      const dept =
        $(el).find(".department, .dept, td:nth-child(2), .organization").first().text().trim();

      const location =
        $(el).find(".location, .city, td:nth-child(3)").first().text().trim();

      const deadline =
        $(el).find(".deadline, .last-date, .date, td:nth-child(4)").first().text().trim();

      const link =
        $(el).find("a").first().attr("href") || "";

      if (title && title.length > 3) {
        jobs.push({
          title: title.replace(/\s+/g, " "),
          dept: dept || "Government of Pakistan",
          location: location || "Pakistan",
          deadline: deadline || "See website",
          link: link.startsWith("http") ? link : `https://www.njp.gov.pk${link}`,
          source: "NJP",
          type: "Govt",
        });
      }
    });

    // Fallback: try table rows
    if (jobs.length === 0) {
      $("table tbody tr").each((i, el) => {
        if (i >= 10) return;
        const cells = $(el).find("td");
        if (cells.length >= 2) {
          const title = $(cells[0]).text().trim();
          const dept = $(cells[1]).text().trim();
          const location = $(cells[2])?.text().trim() || "Pakistan";
          const deadline = $(cells[3])?.text().trim() || "See website";
          const link = $(el).find("a").attr("href") || "https://www.njp.gov.pk/jobs";

          if (title && title.length > 3) {
            jobs.push({
              title,
              dept: dept || "Government of Pakistan",
              location,
              deadline,
              link: link.startsWith("http") ? link : `https://www.njp.gov.pk${link}`,
              source: "NJP",
              type: "Govt",
            });
          }
        }
      });
    }

    console.log(`✅ NJP: ${jobs.length} jobs scraped`);
    return jobs;
  } catch (err) {
    console.error("❌ NJP scrape failed:", err.message);
    return [];
  }
}

// ─── Punjab Jobs Portal Scraper ──────────────────────────────────────────────
async function scrapePunjabJobs() {
  try {
    const url = "https://punjab.gov.pk/jobs";
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const jobs = [];

    $(".job-item, .vacancy, .job-listing, .views-row, article, .job-card").each((i, el) => {
      if (i >= 10) return;

      const title =
        $(el).find("h2, h3, h4, .title, .job-title, a").first().text().trim();

      const dept =
        $(el).find(".department, .dept, .organization, .ministry").first().text().trim();

      const location =
        $(el).find(".location, .city, .district").first().text().trim();

      const deadline =
        $(el).find(".deadline, .date, .last-date, time").first().text().trim();

      const link =
        $(el).find("a").first().attr("href") || "";

      if (title && title.length > 3) {
        jobs.push({
          title: title.replace(/\s+/g, " "),
          dept: dept || "Government of Punjab",
          location: location || "Punjab, Pakistan",
          deadline: deadline || "See website",
          link: link.startsWith("http") ? link : `https://punjab.gov.pk${link}`,
          source: "Punjab Portal",
          type: "Govt",
        });
      }
    });

    console.log(`✅ Punjab: ${jobs.length} jobs scraped`);
    return jobs;
  } catch (err) {
    console.error("❌ Punjab scrape failed:", err.message);
    return [];
  }
}

// ─── Rozee.pk Scraper (Private Jobs) ─────────────────────────────────────────
async function scrapeRozee() {
  try {
    const url = "https://www.rozee.pk/jobs/pakistan";
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const jobs = [];

    $(".job-item, .job-listing, .jlst, li.job, .job-box").each((i, el) => {
      if (i >= 8) return;

      const title =
        $(el).find(".job-title, .jtitle, h3, h4, a.title").first().text().trim();

      const company =
        $(el).find(".company, .comp-name, .employer").first().text().trim();

      const location =
        $(el).find(".location, .city, .loc").first().text().trim();

      const deadline =
        $(el).find(".date, .posted, .deadline").first().text().trim();

      const link =
        $(el).find("a").first().attr("href") || "";

      if (title && title.length > 3) {
        jobs.push({
          title: title.replace(/\s+/g, " "),
          dept: company || "Private Company",
          location: location || "Pakistan",
          deadline: deadline || "See website",
          link: link.startsWith("http") ? link : `https://www.rozee.pk${link}`,
          source: "Rozee.pk",
          type: "Private",
        });
      }
    });

    console.log(`✅ Rozee: ${jobs.length} jobs scraped`);
    return jobs;
  } catch (err) {
    console.error("❌ Rozee scrape failed:", err.message);
    return [];
  }
}

// ─── Main fetch function ──────────────────────────────────────────────────────
async function fetchAllJobs() {
  console.log("🔍 Starting job scraping...");
  const [njp, punjab, rozee] = await Promise.all([
    scrapeNJP(),
    scrapePunjabJobs(),
    scrapeRozee(),
  ]);

  // Govt jobs first, then private
  const all = [...njp, ...punjab, ...rozee];
  console.log(`📋 Total jobs fetched: ${all.length}`);
  return all;
}

async function fetchGovtJobs() {
  const [njp, punjab] = await Promise.all([scrapeNJP(), scrapePunjabJobs()]);
  return [...njp, ...punjab];
}

async function fetchPrivateJobs() {
  return await scrapeRozee();
}

async function fetchNJPJobs() {
  return await scrapeNJP();
}

async function fetchPunjabJobs() {
  return await scrapePunjabJobs();
}

module.exports = {
  fetchAllJobs,
  fetchGovtJobs,
  fetchPrivateJobs,
  fetchNJPJobs,
  fetchPunjabJobs,
};
