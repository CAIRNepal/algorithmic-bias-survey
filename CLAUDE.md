# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Research companion repo for the paper "Towards FAIR AI: A Survey of Regional Trends and Knowledge Graph-Enhanced Bias Mitigation." Contains analysis scripts for the survey corpus, a metadata extraction notebook, and an interactive Next.js dashboard deployed to GitHub Pages.

## Repository Structure

- `evaluation/analysis/` — Python scripts that generate figures from the survey corpus CSV
- `dashboard/` — Next.js 15 (TypeScript, Tailwind, Recharts, Papa Parse) interactive dashboard
- `extract_publication_metadata.ipynb` — Jupyter notebook that fetches metadata from OpenAlex API given DOIs
- `figures/` — Output figures from original 99-paper corpus
- `evaluation/analysis/figures_new/` — Output figures from expanded corpus

## Data Files

Two corpus versions exist:
- `evaluation/analysis/papers.csv` — Original 99-paper corpus
- `evaluation/analysis/papers_new.csv` — Expanded corpus (272+ papers)

CSV columns: `SN, Paper Title, DOI, Authors, Author Regions, Affiliations, Year, Focus Region, Domain, Source`

**CSV quoting:** Titles with commas must be properly quoted. When writing CSVs, use `quoting=csv.QUOTE_ALL` in pandas to avoid breaking the dashboard's Papa Parse parser.

**Affiliations column** is empty in `papers_new.csv` — the `top_n_university_domain_*.py` scripts cannot run until it's populated.

**Focus Region** is empty for new papers (Source=New). The dashboard no longer requires it for filtering but some analysis scripts use it.

## Analysis Scripts

All scripts in `evaluation/analysis/` read from a CSV and output to a figures directory. Key config lines at the top of each script:
- `INPUT_CSV` — which CSV to read
- `OUT_DIR` — output directory for figures

Scripts currently point to `papers_new.csv` and `figures_new/`:

| Script | What it produces | Needs Affiliations? |
|--------|-----------------|-------------------|
| `all_first_author_count_country_paper.py` | Country bar charts (all authors + first author) | No |
| `country_country_collab_heatmap.py` | Country collaboration matrix | No |
| `country_domain_heatmap_participation_all_authors_paper.py` | Country x Domain heatmap (all authors) | No |
| `country_domain_heatmap_participation_first_author_paper.py` | Country x Domain heatmap (first author) | No |
| `domain_evolution_over_time.py` | Domain trends over years | No |
| `overall_domain_distribution_all_country.py` | Domain pie chart | No |
| `top_n_university_domain_all_author_paper.py` | Top 20 institutions heatmap | **Yes** |
| `top_n_university_domain_first_author_paper.py` | Top 20 institutions (first author) | **Yes** |

The bar chart script (`all_first_author_count_country_paper.py`) includes broken y-axis support that activates automatically when the top value is 2.5x larger than the second-largest.

## Dashboard

### Run locally
```bash
cd dashboard
npm install
npm run dev          # starts on localhost:3000
```

### How it works
- `BiasResearchDashboard.tsx` is the main component (loaded by `page.tsx`)
- Fetches `papers.csv` from `public/` via Papa Parse at runtime
- `public/papers.csv` must be properly quoted CSV — copy from `evaluation/analysis/papers_new.csv` using pandas with `QUOTE_ALL`
- Production builds use `basePath: /algorithmic-bias-survey` for GitHub Pages

### Deployment
Automatic via `.github/workflows/deploy.yml` on push/merge to `main`. Builds the dashboard as a static export and deploys to GitHub Pages.

### Key pages
- `/` — Main dashboard (`BiasResearchDashboard.tsx`)
- `/advanced` — Advanced analytics (`advanced/page.tsx`)

## Branches
- `main` — Production, triggers GitHub Pages deploy
- `revision` — Active revision branch for paper resubmission work
