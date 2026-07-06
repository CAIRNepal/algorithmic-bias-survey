# Contributing to BiasAtlas

There are two ways to contribute, depending on how involved you want to be.

## How the pipeline fits together

Two source-of-truth files feed everything else. Nothing downstream is edited
by hand — it's all regenerated from these two:

```
papers_new.csv              openalex_enriched.csv
(manual: title, DOI,        (auto-fetched via notebook,
 authors, domain, ...)       matched by DOI: abstract,
        │                    citations, OA status, ...)
        │                            │
        └──────────────┬─────────────┘
                        │  merged by SN
                        ▼
        ┌───────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
semantic_similarity.py            statistical_tests.py
generate_atlas_umap.py            citation_analysis.py
        │                         country/institution scripts
        ▼                                 │
atlas_data.csv                            ▼
semantic_clusters.csv          figures_new/*.png, *.csv
        │
        ▼
dashboard/public/*.csv  ──push──▶  live site (biasatlas.cair-nepal.org)
```

In short: **`papers_new.csv`** is where you manually add a paper's
bibliographic details. **`openalex_enriched.csv`** is populated
*automatically* from `papers_new.csv`'s DOI — you only touch it by hand for
the rare paper with no DOI (see Step 2). Everything else — embeddings,
clusters, figures, dashboard data, the live site — is generated code, never
edited directly.

## 1. Nominate a paper (no setup required)

If you just want a publication added to the corpus, open a GitHub issue with
the paper's title, DOI, and which of the five thematic domains it belongs to
(General Fairness & Bias Mitigation, Health & Clinical AI, LLMs & NLP,
Recommender Systems, Graph-Based Fairness & Bias Mitigation).

Someone from the team will run it through the pipeline below.

## 2. Add papers yourself and open a PR

This requires Python 3 and the packages in `requirements-atlas.txt`.

### Step 1 — Add rows to the corpus

Add one row per paper to `evaluation/analysis/papers_new.csv`, filling in:

| Column | What goes here |
|---|---|
| `SN` | Next sequential number after the current max |
| `Paper Title` | Exact published title |
| `DOI` | Full DOI URL, e.g. `https://doi.org/10.1145/...` (leave blank only if the paper genuinely has none — see note below) |
| `Authors` | Semicolon-separated, in publication order |
| `Author Regions` | Semicolon-separated country for each author, **same order and count as `Authors`** |
| `Affiliations` | Semicolon-separated institution for each author, same order as `Authors` |
| `Year` | Publication year |
| `Domain` | One of the five domains listed above, exactly as written |
| `Focus Region` | Geographic focus of the study, or `Global` if not region-specific |
| `Source` | `Original` for hand-added papers, or the venue name if bulk-imported (e.g. `FAccT`) |
| `ORC ID` | Semicolon-separated ORCID URLs, same order as `Authors` (`N/A` where unknown) |

**Before adding a row, check it isn't already in the corpus** — search
`papers_new.csv` by DOI and by a fuzzy title match, not just an exact title
match. Papers have previously been added twice under slightly reworded
titles (e.g. a colon vs. a dash, or a trailing period) with the same DOI.

### Step 2 — Fetch OpenAlex metadata

Open `extract_publication_metadata.ipynb` and run it for the new DOIs. This
looks up each DOI via the OpenAlex API and **appends a row automatically** —
you do not hand-fill this file the way you did `papers_new.csv` in Step 1.
The new row will have:

| Column | Where it comes from |
|---|---|
| `SN` | Same `SN` as the matching row in `papers_new.csv` |
| `corpus_doi` | Copied from `papers_new.csv`'s `DOI`, used for matching |
| `openalex_id` | OpenAlex's own work ID for this paper |
| `doi` | DOI as OpenAlex has it recorded (should match `corpus_doi`) |
| `title` | Title as OpenAlex has it (may be truncated/differ slightly from `Paper Title`) |
| `year` | Publication year per OpenAlex |
| `cited_by_count` | Citation count from OpenAlex, at fetch time |
| `abstract` | Fetched automatically — **only field you fill by hand for no-DOI papers**, see below |
| `referenced_works` | OpenAlex IDs of everything this paper cites — used later to build the internal citation network |
| `is_oa` / `oa_status` / `oa_url` | Open-access flag, category, and link, per OpenAlex |

**If a paper has no DOI**, the notebook has nothing to match against, so no
row gets added automatically. In that case, add the row yourself with the
same `SN` as in `papers_new.csv`, leave `openalex_id`/`cited_by_count`/
`referenced_works`/`is_oa`/`oa_status`/`oa_url` blank, and write the
**real** abstract text into `abstract`. Don't invent placeholder abstracts
(e.g. "An overview of X approaches") — either supply the real abstract or
leave it blank rather than adding filler.

### Step 3 — Regenerate embeddings and clusters

```bash
python3 evaluation/analysis/semantic_similarity.py   # → semantic_clusters.csv + figures (~3-5 min)
python3 generate_atlas_umap.py                       # → atlas_data.csv (~3-5 min)
```

### Step 4 — Update the dashboard's copy of the corpus

```bash
python3 -c "
import pandas as pd, csv
df = pd.read_csv('evaluation/analysis/papers_new.csv')
df.to_csv('dashboard/public/papers.csv', index=False, quoting=csv.QUOTE_ALL)
"
```

### Step 5 (optional) — Regenerate bibliometric figures/stats

Only needed if you want updated country/institution/citation figures
reflecting the new papers:

```bash
python3 evaluation/analysis/statistical_tests.py
python3 evaluation/analysis/citation_analysis.py
python3 evaluation/analysis/all_first_author_count_country_paper.py
python3 evaluation/analysis/country_domain_heatmap_participation_all_authors_paper.py
python3 evaluation/analysis/country_domain_heatmap_participation_first_author_paper.py
python3 evaluation/analysis/top_n_university_domain_all_author_paper.py
python3 evaluation/analysis/top_n_university_domain_first_author_paper.py
```

### Step 6 — Open a PR

Commit `papers_new.csv`, `openalex_enriched.csv`, `dashboard/public/`, and
any regenerated figures. Describe in the PR which papers were added and why,
and mention if the total corpus size changed (several places — this README,
the dashboard UI text, the dataset card — reference the current paper
count and will need updating too).

## Common pitfalls (found the hard way)

- **Duplicate detection by exact title match isn't enough.** Check DOI first;
  if DOI is missing, fuzzy-match the title before assuming a paper is new.
- **`Author Regions` and `Affiliations` must have the same number of
  semicolon-separated entries as `Authors`.** A mismatch silently breaks
  per-author country/institution attribution.
- **Country names must be normalized** (`UK` → `United Kingdom`, not left
  as an abbreviation) or they'll be undercounted in country-level stats.
- Scripts that write output should use paths anchored to their own file
  location (`Path(__file__).resolve().parent`), not bare relative strings —
  a bare relative path resolves differently depending on which directory you
  run the script from, and has caused stale/misplaced output files before.

## Code contributions

For changes to the dashboard, analysis scripts, or pipeline itself, open a
pull request describing the change and its effect on any precomputed
layouts, figures, or stats. If your change alters the corpus size or any
headline statistic, please update it consistently across the README, the
dashboard UI, and the dataset card on Hugging Face — these are three
separate places that don't auto-sync.
