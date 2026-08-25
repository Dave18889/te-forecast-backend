# 2026 Gartner T&E Forecast Portal

A clean rebuild of this dashboard, replacing the tangle of duplicate files
(`site.js`, an `api/te-forecast.js` that was actually a copy of the page,
`vercel.json`, missing backend logic) with a simple, standard structure —
the same one your other two dashboards already use successfully.

---

## Step 1: Delete everything currently in your GitHub repo

This is important — the confusion so far has come from old, duplicate, and
conflicting files sitting alongside each other. Starting clean avoids that
entirely.

1. Open your repo on GitHub
2. Delete every file and folder in it, including `vercel.json`,
   `package.json`, `site.js`, the `api` folder — everything
3. Commit that as "Clean slate"

(If you'd rather keep history, creating a brand new repo and pointing
Vercel at that instead works just as well — either way, the goal is an
empty starting point.)

## Step 2: Upload the new files

1. Unzip the file I've provided
2. On your (now empty, or brand new) GitHub repo, use **Add file → Upload
   files**
3. Open the unzipped folder, select **everything inside it** (not the
   outer folder itself), and drag it all into the upload box
4. Commit

Your repo should now show, at the top level: `api`, `lib`, `index.html`,
`style.css`, `app.js`, `server.js`, `middleware.js`, `package.json`,
`.env.example`, `.gitignore` — no `vercel.json`, no `site.js`.

## Step 3: Confirm (or reconnect) the Vercel project

If this GitHub repo is already connected to a Vercel project, the upload in
Step 2 will trigger an automatic redeploy — you can skip to Step 4.

If you created a **new** repo instead of reusing the old one:
1. Vercel → **Add New → Project** → import the new repo
2. **Framework Preset**: Other (should auto-detect)
3. **Root Directory**: leave blank / `./`

## Step 4: Set environment variables

Vercel → your project → **Settings → Environment Variables**. Add (or
confirm) these two:

| Name | Value |
|---|---|
| `GOOGLE_API_KEY` | your Google Cloud API key |
| `SPREADSHEET_ID` | `1lMx9A-CVvae7iIinprtdVoE47N6FBf2ibDGuCUuevmc` |

The Google Sheet needs to be shared as **"Anyone with the link – Viewer"**
for the API key to read it.

**Leave `SITE_USER` and `SITE_PASSWORD` unset for now.** Get the site
loading with real data first — add a password afterward (Step 6) once
you've confirmed everything works.

## Step 5: Redeploy and check it works

**Deployments** tab → latest → **⋯** → **Redeploy**. Visit the site — it
should load directly with no login prompt, showing real conference and
budget data.

If something's wrong, check the browser console (F12 → Console tab) for
the actual error rather than guessing — that's what cracked the last few
issues quickly.

## Step 6 (optional): Add a password

Once the site is loading real data correctly:

1. Vercel → **Settings → Environment Variables** → add `SITE_USER` and
   `SITE_PASSWORD` (any values you choose)
2. **Deployments** → latest → **⋯** → **Redeploy**
3. Visiting the site now prompts for that username/password

To remove the password later, delete those two variables and redeploy —
the site will load with no prompt again (this version of the code checks
for both variables before requiring anything, so an incomplete or deleted
configuration can never lock you out the way it did before).

---

## What's in this package

```
├── api/
│   └── te-forecast.js     # Reads your Google Sheet, returns JSON
├── lib/
│   ├── sheets.js            # Sheets API batch-fetch + cache
│   └── parse.js               # Parses regional tabs, Cost Summary, Team View
├── index.html
├── style.css
├── app.js                       # Browse / Person clash-check / Cost Summary views
├── server.js                      # Optional: run locally without Vercel CLI
├── middleware.js                    # Optional password protection
├── package.json
├── .env.example
└── .gitignore
```

This was tested against a real export of your 2026 sheet before being
packaged — every region's conference count, the Cost Summary figures
(including mixed formats like `"New"`, `"N/A"`, and `"$ 141,136.39"`), and
the Team View home-region calculation were all verified to match the
sheet exactly.
