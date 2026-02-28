# 🧭 Dr. Maya's Career Compass — Deployment Guide

## Folder Structure
```
deploy/
├── public/
│   └── index.html      ← The full student web app
├── api/
│   └── chat.js         ← Secure AI backend (never exposed to students)
├── package.json        ← Required by Vercel for Node functions
├── vercel.json         ← Routing configuration
└── README.md           ← This file
```

---

## Step 1 — Create a free Vercel account
1. Go to https://vercel.com
2. Click **Sign Up** → use your email
3. Verify your email and log in

---

## Step 2 — Deploy (drag & drop — no coding needed)
1. In Vercel, click **"Add New…"** → **"Project"**
2. Click **"Browse"** or drag the entire `deploy` folder into the upload area
3. Leave all settings as default
4. Click **"Deploy"**
5. Wait about 60 seconds — you'll get a free URL like:
   `https://career-compass-abc123.vercel.app`

---

## Step 3 — Add your Anthropic API key
This is what activates all the AI feedback features.

1. In your Vercel project, click **"Settings"** (top menu)
2. Click **"Environment Variables"** (left sidebar)
3. Click **"Add New"**
4. Fill in:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-...` (your actual key from console.anthropic.com)
5. Click **Save**
6. Go to **"Deployments"** → click the three dots on your latest deployment → **"Redeploy"**

✅ AI feedback is now live!

---

## Step 4 — Customize your class codes
Open `public/index.html` and find this line:
```js
const VALID_CODES = ['MAYA2024','CLASS1','SPRING25','CAREERJOB'];
```
Replace with your own codes, save, and re-upload.

---

## Step 5 — Share with students
- **Student URL:** your Vercel URL (e.g. `https://career-compass-abc123.vercel.app`)
- **Instructor login password:** `teacher123`
  (change this in index.html — search for `INSTRUCTOR_PASS`)

---

## Troubleshooting Common Errors

| Error | Fix |
|---|---|
| "Function not found" | Make sure the `api` folder is inside `deploy`, not outside it |
| "Cannot GET /" | Make sure `index.html` is inside the `public` folder |
| AI feedback not working | Check that `ANTHROPIC_API_KEY` is set in Vercel Environment Variables and you redeployed after adding it |
| "Invalid API Key" | Double-check the key — copy it fresh from console.anthropic.com |

---

## Estimated AI Costs
| Usage | Est. Cost |
|---|---|
| 1 student, 1 full session | ~$0.01–0.03 |
| 20 students, 1 session each | ~$0.20–0.60 |
| Full semester (20 students) | ~$2–6 |
