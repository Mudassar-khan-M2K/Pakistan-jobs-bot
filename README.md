# 🇵🇰 Pakistan Jobs Bot — WhatsApp

A WhatsApp bot that automatically fetches and posts Pakistan job vacancies (Govt + Private) to your WhatsApp channel every 20 minutes.

---

## ✨ Features

- 🏛️ Govt jobs from NJP & Punjab Jobs Portal
- 🏢 Private jobs from Rozee.pk
- 📢 Auto-posts to your WhatsApp channel every 20 minutes
- 💬 Interactive menu for DMs
- 🔐 Session stored in PostgreSQL (no re-pairing after restart)
- 🚀 24/7 on Heroku

---

## 🚀 Deployment Guide (Heroku)

### Step 1 — Prepare GitHub Repo

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/whatsapp-job-bot.git
git push -u origin main
```

### Step 2 — Create Heroku App

1. Go to [heroku.com](https://heroku.com) → New → Create new app
2. Name it (e.g. `pakistan-jobs-bot`)
3. Go to **Deploy** tab → Connect to GitHub → Select your repo
4. Enable **Automatic Deploys**

### Step 3 — Add PostgreSQL

1. Go to **Resources** tab in Heroku
2. Search for **Heroku Postgres** → Add it (Essential-0 plan, ~$5/mo)
3. `DATABASE_URL` will be auto-set ✅

### Step 4 — Set Environment Variables

Go to **Settings** → **Config Vars** → Add:

| Key | Value |
|-----|-------|
| `PHONE_NUMBER` | `923216046022` |
| `NODE_ENV` | `production` |

*(DATABASE_URL is already set by Postgres addon)*

### Step 5 — Deploy & Pair

1. Click **Deploy Branch** (manual first deploy)
2. Go to **More** → **View logs**
3. Wait for the pairing code to appear in logs:
```
╔══════════════════════════════════╗
║  🔑 PAIRING CODE: ABC-1234       ║
╚══════════════════════════════════╝
```
4. On your phone → WhatsApp → Settings → Linked Devices → Link with Phone Number
5. Enter the code → Done! ✅

---

## 💬 Interactive Menu (DM the bot number)

| Message | Response |
|---------|----------|
| `hi` / `menu` / `start` | Show main menu |
| `1` | Latest Govt Jobs |
| `2` | Latest Private Jobs |
| `3` | Punjab Jobs Portal |
| `4` | National Job Portal |
| `5` | All Jobs Today |
| `6` | About Bot |

---

## 📢 Channel

https://whatsapp.com/channel/0029Vb7fEeo59PwPuRwAae2J

---

## 🛠️ Local Testing

```bash
npm install
cp .env.example .env
# Fill in .env values
node index.js
```

---

## 📁 File Structure

```
whatsapp-job-bot/
├── index.js        # Main bot + pairing code
├── scraper.js      # Job scraping (NJP, Punjab, Rozee)
├── formatter.js    # WhatsApp message formatting
├── scheduler.js    # Cron job (every 20 min)
├── session.js      # PostgreSQL session storage
├── Procfile        # Heroku config
├── package.json
└── .env.example
```
