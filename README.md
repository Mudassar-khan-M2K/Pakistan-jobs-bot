# 🇵🇰 Pakistan Jobs Bot v2.0

A WhatsApp bot that automatically scrapes and posts Pakistan job vacancies every 20 minutes.

---

## 📋 Features

- ✅ Connects via WhatsApp Pairing Code (no QR needed)
- ✅ Scrapes NJP, Punjab Portal & Rozee.pk every 20 minutes
- ✅ Auto-posts jobs to a WhatsApp Channel
- ✅ Interactive DM menu with commands
- ✅ Session persistence via PostgreSQL (survives Heroku restarts)
- ✅ Auto-reconnects on disconnection
- ✅ Govt jobs always shown first

---

## 🛠️ Tech Stack

| Component | Package |
|-----------|---------|
| WhatsApp | @whiskeysockets/baileys 6.6.0 |
| Scraping | axios + cheerio |
| Scheduler | node-cron |
| Database | pg (PostgreSQL) |
| Server | express |
| Runtime | Node.js 20.x |

---

## 🚀 Heroku Deployment

### Step 1 — Clone & Push to Heroku

```bash
git init
git add .
git commit -m "Initial commit"
heroku create pakistan-jobs-bot
git push heroku main
```

### Step 2 — Add PostgreSQL Addon

```bash
heroku addons:create heroku-postgresql:mini
```

### Step 3 — Set Config Vars

```bash
heroku config:set PHONE_NUMBER=923216046022
heroku config:set NODE_ENV=production
```

> `DATABASE_URL` is set automatically by the Postgres addon.

### Step 4 — Check Logs for Pairing Code

```bash
heroku logs --tail
```

Look for:
```
╔══════════════════════════════════════╗
║   PAIRING CODE: XXXX-XXXX            ║
╚══════════════════════════════════════╝
```

### Step 5 — Enter Pairing Code on WhatsApp

1. Open WhatsApp on your phone (number: 923216046022)
2. Go to **Settings → Linked Devices → Link a Device**
3. Tap **Link with phone number instead**
4. Enter the 8-digit pairing code from logs

---

## 📱 Bot Commands

| Command | Response |
|---------|----------|
| `hi` / `hello` / `menu` | Show main menu |
| `1` | Government jobs |
| `2` | Private jobs |
| `3` | Punjab govt jobs |
| `4` | NJP jobs |
| `5` | All jobs today |
| `!ping` | Bot status & uptime |
| `!time` | Pakistan time |
| `!stats` | Job fetch statistics |
| `!about` | About the bot |
| `!help` | Show menu |

---

## 📢 Channel

Jobs are auto-posted every 20 minutes to:
```
https://whatsapp.com/channel/0029Vb7fEeo59PwPuRwAae2J
```

---

## 🔄 Session Persistence

On every startup:
1. Check `/tmp/auth_info/creds.json` on disk
2. If not found → restore from PostgreSQL DB
3. If not found in DB → request new pairing code
4. After connecting → backup session to PostgreSQL
5. On every `creds.update` → save to disk + backup to DB

---

## 📂 File Structure

```
whatsapp-job-bot/
├── index.js       ← Main bot, pairing, message routing
├── scraper.js     ← Job scraping (NJP, Punjab, Rozee)
├── formatter.js   ← Message formatting + command handler
├── scheduler.js   ← Cron job, channel posting
├── session.js     ← PostgreSQL session backup/restore
├── package.json
├── Procfile
├── .npmrc
├── .gitignore
└── .env.example
```

---

## ⚠️ Important Notes

- **Never install `sharp`** — it crashes on Heroku
- **Baileys 6.7.x has pairing bugs** — stay on 6.6.0
- If bot logs out, it clears the session and exits with code 1 — just restart it
- The `.npmrc` file with `legacy-peer-deps=true` is required for Baileys install

---

## 🐛 Troubleshooting

| Error | Fix |
|-------|-----|
| `Cannot read properties of undefined (reading 'public')` | Already fixed — bot waits for WS readyState === 1 |
| App crashes on start | Check you don't have `sharp` installed |
| `DATABASE_URL not found` | Add Heroku Postgres addon |
| Bot keeps disconnecting | Normal — auto-reconnect is built in |
| Pairing code not showing | Check `heroku logs --tail` |
