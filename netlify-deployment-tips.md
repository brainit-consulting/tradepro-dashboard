# Netlify Deployment Tips (Beginner)

These steps let you host the dashboard for free on Netlify without using Git.

## One-time setup (manual deploy)

1. Ensure your latest dashboard is in `index.html` (this repo’s convention is that `index.html` is always the newest build).
2. On your computer, create a folder (your current example folder is `H:\TradePro-Dashboard-Site`).
3. Copy `index.html` into that folder (and any other files your page needs, if applicable).
4. Go to `https://app.netlify.com/` and sign up / log in.
5. In the Netlify dashboard, click **Add new site** → **Deploy manually** (or use the **Drag and drop** area).
6. Drag the folder (or its contents) into the deploy area.
7. Wait for the deploy to finish. Netlify will give you a URL like `https://your-site-name.netlify.app`.
8. Open the URL and confirm the dashboard loads.

## Common follow-ups

- Rename your site: **Site configuration** → **Change site name** (you renamed yours to `tradepro-dashboard`)
- Add a custom domain: **Domain management** → **Add a domain**, then follow Netlify’s DNS instructions

## Updating the site later

- Manual method: repeat the drag-and-drop deploy with your updated `index.html` (or the whole folder).
- Git method (optional): connect the repo to Netlify so pushes automatically deploy (helpful once you’re comfortable with Git-based workflows).

## Inactivity and cleanup notes (Free plan)

- **Deploy history cleanup:** Netlify may automatically delete *old deploys* (build artifacts) after ~30 days on Free plans, except for the currently published deploy and a small set of most-recent successful deploys (production/branch).
- **Inactive sites (recommendation):** Sites with no builds for 90+ days can be considered “inactive.” Netlify recommends triggering a new build or deleting inactive sites for security hygiene; this is guidance, not necessarily an automatic deletion rule.
- **Special case — unclaimed GPT-created sites:** Sites created via Netlify’s GPT action that are not claimed by a user can be taken offline and deleted quickly (anti-spam behavior). This does not typically apply to normal, claimed sites you manage in your account.

---

*Footnote: Other free static-hosting options include Cloudflare Pages, Vercel, Firebase Hosting (free tier), and Render static sites (free tier).*
