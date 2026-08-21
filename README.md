# Digital Land Surveying & Mapping — E-Content (CO-wise)

A static, multi-page website presenting Course Outcome (CO)-wise e-content for **BTCVE802T — Digital Land Surveying and Mapping** (B.Tech Civil Engineering, Semester VIII), built to support NBA course-file documentation.

## Contents

| Page | Covers |
|---|---|
| `index.html` | Course overview, CO grid, quick links |
| `co1.html` | CO1 — Fundamentals of Digital Land Surveying |
| `co2.html` | CO2 — GPS: segments, signals, receivers, error sources |
| `co3.html` | CO3 — DGPS: differential correction, base/rover working |
| `co4.html` | CO4 — Total Station: parts, setup, measurement, errors |
| `co5.html` | CO5 — Mapping fundamentals & automated mapping software |
| `references.html` | Prescribed text books + CO-wise additional reference books |

Assets live in `css/style.css` and `js/script.js`. The site is plain HTML/CSS/JS — no build step, no dependencies.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Hosting on GitHub Pages

1. Create a new GitHub repository (e.g. `dlsm-econtent`).
2. Push this folder's contents to the repository's `main` branch:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, select **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`, then click **Save**.
6. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

No further configuration is required — the site has no server-side code and works as-is on GitHub Pages.

## Attribution

Course Outcomes are quoted verbatim from the BTCVE802T syllabus. External further-reading links cite NPTEL and Wikipedia; see each page's "Further reading" section for exact sources.
