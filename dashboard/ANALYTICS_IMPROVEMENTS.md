# Analytics Improvements — Bias Research Dashboard

## Overview

This document tracks the analytics features and improvements implemented for the Bias Research Dashboard, which now consists of two primary surfaces: the **Atlas** (home page, semantic UMAP explorer) and **Research Analytics** (`/advanced`, full overview dashboard).

---

## 🗺️ Atlas — Semantic Paper Explorer (`/`)

The Atlas is the default home page. It provides interactive 2D + 3D UMAP visualisations of all 519 papers alongside rich filtering and analytics.

### Map Views (toggle in toolbar)

| View | Description |
|------|-------------|
| **UMAP** | Side-by-side 2D (pan/zoom/lasso) + 3D (auto-rotate, drag, zoom) canvas scatter plots, coloured by domain or semantic cluster |
| **🌍 World** | Choropleth world map coloured by dominant research domain per country (react-simple-maps). Hover shows country, contribution count, dominant domain. |
| **🔗 Collab** | Ranked bar list of top 30 cross-region country co-authorship pairs with relative count bars |

### Filters (left sidebar — existing)
- **Domain** — multi-select checkboxes with paper counts
- **Cluster** — HDBSCAN semantic cluster checkboxes with labels and counts

### Right Panel — Filters & Analytics (new, shown when no paper selected)

| Section | Feature |
|---------|---------|
| **Publication Timeline** | Year-by-year bar chart; click a bar to snap year filter; From/To year selectors |
| **Open Access toggle** | Filter to freely available papers only |
| **Location / Country** | Searchable multi-select list of all countries with per-country paper counts and relative bars |
| **Co-Authors** | Searchable multi-select list of authors with ≥2 papers in corpus, with count bars |
| **Download** | Export current filtered set as CSV (header + rows) |

### Toolbar controls
- **Search** — full-text across title, abstract, keywords, authors (press `/` to focus)
- **Domain pills** — quick-toggle active domain filters
- **Map-view toggle** — UMAP / World / Collab
- **Colour-mode toggle** — domain / cluster
- **Lasso** — draw free-form selection on 2D canvas to filter
- **Hide/Show maps** — collapse map panels to maximise list + detail
- **Download CSV** — export filtered papers
- **Reset** — clears all active filters (also bound to `Esc`)
- **Paper count** — live filtered / total display

### Right Panel — Paper Detail (shown when a paper is clicked)

| Section | Content |
|---------|---------|
| Header | SN, domain/cluster badge, OA badge, paper title |
| Stats bar | Year, citations, author count, citation percentile bar |
| Abstract | Full text or "not available" fallback |
| Co-Author Analysis | Per-author paper count bar, domains, regions; click name to filter |
| Geography | Countries (OpenAlex) + regions (survey) |
| Keywords | Clickable chips → set search query |
| Cluster Context | Domain breakdown bar chart for the paper's semantic cluster |
| Semantically Related | 6 nearest UMAP neighbours with distance, year, citations; clickable |
| DOI | External link to full paper |

### UMAP technical details
- **Embeddings:** `all-MiniLM-L6-v2` (sentence-transformers) on title + abstract
- **2D:** `n_neighbors=15, min_dist=0.08, metric=cosine, random_state=42`
- **3D:** `n_neighbors=15, min_dist=0.10, metric=cosine, random_state=42`
- **Clustering:** HDBSCAN `min_cluster_size=10, min_samples=3` → 14 named clusters
- **Cluster labels:** Auto-generated from top keywords per cluster (stop-words filtered)
- **Stale-closure fix:** `render2Ref`/`render3Ref` refs updated every render ensure RAF loops always call the latest render closure (fixes blank 3D on load and after hide/show)

---

## 📊 Research Analytics — Overview Dashboard (`/advanced`)

Powered by `BiasResearchDashboard.tsx` reading `public/papers.csv`.

### Features
- **World choropleth** — countries coloured by dominant research domain; All Authors / First Author toggle; multi-domain select with dashed secondary-domain borders
- **Domain distribution** — pie chart of research domains
- **Country bar charts** — top-15 countries by paper count + Other bucket
- **Year trend** — publication timeline
- **Collaboration heatmap** — top-20 country co-authorship matrix
- **Co-author network** — author collaboration analysis
- **Research Insights** — gap analysis, geographic distribution, temporal evolution, recommendations
- **Advanced Analytics tab** — citation analysis, h-index, network density, methodology breakdown

---

## 🔧 Technical Implementation

### Stack
- **Next.js 15** — App Router, static export for GitHub Pages
- **TypeScript** — fully typed throughout
- **Tailwind CSS** — utility-first styling, consistent design tokens
- **Recharts** — charts in BiasResearchDashboard / AdvancedAnalytics
- **Canvas API** — 2D and 3D UMAP rendering in AbstractAtlas (no library overhead)
- **react-simple-maps** — SVG world choropleth in Atlas + BiasResearchDashboard
- **Papa Parse** — runtime CSV loading

### Routing

| Route | Component | Data |
|-------|-----------|------|
| `/` | `AbstractAtlas` | `public/atlas_data.csv` |
| `/advanced` | `BiasResearchDashboard` | `public/papers.csv` |
| `/atlas` | `AbstractAtlas` | `public/atlas_data.csv` |

### Design system
- Card style: `rounded-2xl border border-gray-100 shadow-sm`
- Background: `bg-slate-50` on `<main>` in layout
- Domain colours: Health `#e63946` · General `#2563eb` · Graph `#059669` · LLMs `#d97706` · Recommender `#7c3aed`
- Atlas full-screen: `calc(100vh - 72px)` height, body `overflow: hidden`

---

## 📋 Adding New Papers

New papers do **not** appear automatically. Follow this pipeline:

```bash
# 1. Add rows to source CSV
#    evaluation/analysis/papers_new.csv

# 2. Re-run UMAP pipeline
python generate_atlas_umap.py
#    → dashboard/public/atlas_data.csv (new embeddings + clusters)

# 3. Refresh papers.csv for Research Analytics page
python -c "
import pandas as pd, csv
pd.read_csv('evaluation/analysis/papers_new.csv').to_csv(
    'dashboard/public/papers.csv', index=False, quoting=csv.QUOTE_ALL
)
"

# 4. Push to main → auto-deploys via GitHub Actions
git add dashboard/public/ evaluation/analysis/papers_new.csv
git commit -m "Add N new papers, re-run UMAP"
git push
```

> ⚠️ UMAP must be re-run because adding papers changes the embedding space and cluster assignments.

---

## 🐛 Known Fixes Applied

| Bug | Fix |
|-----|-----|
| 3D canvas blank on initial load | `render3Ref` ref updated every render; auto-rotate loop calls `render3Ref.current()` instead of stale closure |
| Hide/Show maps breaks canvas sizing | Added `showMaps` + `mapView` to ResizeObserver `useEffect` dependency array |
| `s.toLowerCase is not a function` | `norm()` helper uses `String(s ?? '')` to handle null/number CSV values |
| Double header on Atlas page | Removed `AppHeader` from `atlas/page.tsx`; Atlas link added to global `layout.tsx` nav instead |
| `__webpack_modules__[moduleId] is not a function` | Removed `next/dynamic(ssr:false)` from `'use client'` page; direct import used instead |
| `Cannot find module './NNN.js'` | Stale `.next` cache — fix: `rm -rf .next && npm run build` |

---

## 📈 Planned Enhancements

1. **Auto-pipeline GitHub Action** — trigger `generate_atlas_umap.py` on `papers_new.csv` changes
2. **Institution filter** — once `Affiliations` column is populated in `papers_new.csv`
3. **Interactive network graph** — D3 force-directed co-author network in Atlas
4. **Abstract search with embeddings** — semantic nearest-neighbour search beyond keyword matching
5. **OpenAlex live enrichment** — fetch citations/abstracts at build time via API
6. **PDF export** — downloadable report of filtered paper set with charts
