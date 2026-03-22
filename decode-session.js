// Levanter session decoder
// Run this ONCE locally: node decode-session.js
// It will create /tmp/auth_info/creds.json from your Levanter session ID

const fs = require("fs");
const path = require("path");

const SESSION_ID = process.env.SESSION_ID || "levanter_224192240326c64b71a91a7f15d95d7efa";

async function decodeSession() {
  try {
    // Levanter session ID format: levanter_<base64encodeddata>
    // Strip the prefix
    const prefix = "levanter_";
    if (!SESSION_ID.startsWith(prefix)) {
      console.error("Invalid session ID format. Must start with 'levanter_'");
      process.exit(1);
    }

    const encoded = SESSION_ID.slice(prefix.length);

    // Fetch the actual session data from Levanter's API
    const axios = require("axios");
    
    console.log("Fetching session from Levanter API...");
    
    // Try Levanter's session endpoint
    let sessionData = null;
    
    const urls = [
      `https://session.levanter.biz.id/${encoded}`,
      `https://api.levanter.biz.id/session/${encoded}`,
      `https://levanter-session.onrender.com/${encoded}`,
    ];

    for (const url of urls) {
      try {
        console.log("Trying:", url);
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data) {
          sessionData = res.data;
          console.log("Got session data from:", url);
          break;
        }
      } catch (e) {
        console.log("Failed:", url, e.message);
      }
    }

    if (!sessionData) {
      // Try to decode as base64 directly
      console.log("Trying direct base64 decode...");
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        sessionData = JSON.parse(decoded);
        console.log("Decoded as base64!");
      } catch (e) {
        console.log("Not base64 JSON either:", e.message);
      }
    }

    if (!sessionData) {
      console.error("Could not decode session. The session ID may need to be fetched differently.");
      console.log("\nManual option: Check the Levanter bot — it may have sent you a file or JSON.");
      process.exit(1);
    }

    // Save to auth folder
    const authFolder = "/tmp/auth_info";
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

    if (sessionData.creds) {
      // Full session object
      for (const [key, value] of Object.entries(sessionData)) {
        fs.writeFileSync(`${authFolder}/${key}.json`, JSON.stringify(value, null, 2));
      }
    } else {
      // Might be just creds directly
      fs.writeFileSync(`${authFolder}/creds.json`, JSON.stringify(sessionData, null, 2));
    }

    console.log("\n✅ Session saved to", authFolder);
    console.log("Files:", fs.readdirSync(authFolder));

  } catch (err) {
    console.error("Error:", err.message);
  }
}

decodeSession();
