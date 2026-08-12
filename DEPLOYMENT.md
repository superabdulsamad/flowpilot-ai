# SOP — Publish to GitHub (new account) & Deploy to Vercel

Standard steps for taking this project from your local folder (`D:\New folder (3)`) to a public
GitHub repo on a **different** account, then live on Vercel. All steps here are manual — nothing
in this file is automated, and nothing has been pushed or deployed yet.

---

## 0. Pre-flight checklist (do this once, before the first push)

Run these from the project folder to double-check nothing sensitive is about to go public:

```bash
cd "D:\New folder (3)"
```

```bash
git status
```
Confirm `.env` does **not** appear (it's git-ignored — only `.env.example` should ever be tracked).

```bash
grep -ril -i "exaguru" src index.html
```
Should print nothing. If it prints a file, stop and fix it before pushing.

Also open [`LICENSE`](LICENSE) and replace `<Your Name>` with your actual name.

---

## 1. Create the GitHub repo on the *other* account

1. In your browser, make sure you're signed in to the **GitHub account you want this to live
   on** (not your employer's/original account). If you use multiple GitHub accounts in the same
   browser, use an incognito window or your browser's profile switcher to be sure.
2. Go to [github.com/new](https://github.com/new).
3. Repo name: e.g. `flowpilot-ai` (or whatever you'd like).
4. Leave **"Add a README", ".gitignore", and "license"** all **unchecked** — this project already
   has those files locally; letting GitHub create its own would conflict on first push.
5. Click **Create repository**. Copy the URL it shows you (HTTPS form looks like
   `https://github.com/<your-username>/flowpilot-ai.git`).

### A note on multiple GitHub accounts on one machine

If you're already authenticated to a different GitHub account on this computer (e.g. Git Credential
Manager has your work account cached), a plain `git push` can silently try to push using the wrong
identity, or fail with a permissions error on someone else's repo. Two reliable fixes:

- **Personal Access Token (simplest):** on the new account, go to
  GitHub → Settings → Developer settings → Personal access tokens → generate one (repo scope).
  When `git push` prompts for a password, paste the token instead of your GitHub password.
- **GitHub CLI:** `gh auth login` and pick the new account explicitly, or `gh auth switch` if
  you're already logged into more than one.

---

## 2. Commit and push

From `D:\New folder (3)`:

```bash
git add .
```

```bash
git commit -m "Initial commit: FlowPilot AI portfolio edition"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/<your-username>/flowpilot-ai.git
```

```bash
git push -u origin main
```

If prompted for credentials, use the new account's username + the Personal Access Token from
step 1 (not your GitHub password — GitHub no longer accepts plain passwords over HTTPS git).

Verify: reload the repo page on GitHub and confirm the files are there — and specifically confirm
`.env` is **not** listed (only `.env.example` should be).

---

## 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in — choose **"Continue with GitHub"** and
   authorize the **same new account** from step 1 (Vercel needs access to that account to see the
   repo).
2. Click **Add New… → Project**.
3. Select the `flowpilot-ai` repo from the list (you may need to click "Adjust GitHub App
   Permissions" if it doesn't show up, and grant Vercel access to that specific repo).
4. Vercel auto-detects **Vite** as the framework. Defaults should already be correct:
   - Build command: `npm run build` (auto)
   - Output directory: `dist` (auto)
   - Install command: `npm install` (auto)
5. **Environment variables** — expand that section before deploying and add:

   | Name | Value |
   |---|---|
   | `VITE_USE_MOCK` | `true` |

   That's enough to ship the mock-data demo exactly as you tested it locally. If you'd rather
   connect a real Firebase project instead, set `VITE_USE_MOCK` to `false` and add the
   `VITE_FIREBASE_*` variables from `.env.example` with your own Firebase project's values.
6. Click **Deploy**. Takes under a minute.
7. Vercel gives you a live URL like `flowpilot-ai-<hash>.vercel.app`. Open it and confirm:
   - Login screen shows "FlowPilot AI"
   - Log in with `demo` / `demo1234`
   - A few tabs load with no errors (browser DevTools → Console)

### Custom domain (optional)

Project → Settings → Domains → add your own domain and follow Vercel's DNS instructions. Not
required — the default `*.vercel.app` URL works fine for a portfolio link.

---

## 4. Ongoing updates

Once connected, Vercel auto-deploys on every push to `main`:

```bash
git add .
```
```bash
git commit -m "describe your change"
```
```bash
git push
```

Vercel picks it up automatically and redeploys within a minute or two — no dashboard action needed.
