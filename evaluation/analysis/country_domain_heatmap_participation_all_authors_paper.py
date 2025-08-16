#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Country × Domain analysis with % (count) annotations

Adds METRIC="authors" mode:
- authors: counts author instances by Country×Domain (each author contributes 1 to their country)

Other modes:
- focus: each paper counted once in Focus Region
- participation: each paper counted once per contributing country (dedup per paper-country)
- fractional: paper credit split evenly across countries on the paper

Percentages shown are PER DOMAIN (column-wise share).

# ---------------------------------------------------------------------------
# METRIC options: 'focus' | 'participation' | 'fractional' | 'authors'
# ---------------------------------------------------------------------------
# All heatmaps in this notebook show **column-wise (per-domain) percentages**,
# i.e., within each Domain column we compute the share attributed to each
# Country, then annotate cells as:  "<percent> (count)".
#
# Denominator controls (elsewhere in the script):
#   - DOMAIN_PCT_USE_ALL_COUNTRIES = True  → % uses totals across *all* countries
#     (even if we only *plot* Top-N). Column % may not sum to 100% on the chart
#     because some countries are hidden.
#   - DOMAIN_PCT_USE_ALL_COUNTRIES = False → % uses only the *shown* countries,
#     so each column will sum to ~100% on the chart.
#   - DOMAIN_PCT_EXCLUDE_UNKNOWN toggles whether "Unknown" is included in the
#     domain totals used as denominators.
#
# Counts shown in parentheses:
#   - 'focus' / 'participation' / 'authors' → integer counts
#   - 'fractional' → fractional counts (we display 1 decimal place)
#
# ---------------------------
# METRIC = "focus"
# ---------------------------
# Definition:
#   • Each paper is assigned to exactly ONE country: its Focus Region.
# What “count” means:
#   • Count = # of papers whose Focus Region is the given Country in the Domain.
# Properties:
#   • Summing counts across all countries and domains equals the total # papers.
#   • Ignores Author Regions entirely.
# When to use:
#   • You want a single “home” country per paper (e.g., lead or declared focus).
#
# ---------------------------
# METRIC = "participation"
# ---------------------------
# Definition:
#   • Each paper is counted once for every country appearing in Author Regions.
#   • Deduplicated per paper–country: if a paper has 3 USA authors, USA gets +1.
# What “count” means:
#   • Count = # of unique papers that include at least one author from Country
#     in that Domain.
# Properties:
#   • Column sums across countries can exceed the global # papers because a
#     multi-country paper contributes to multiple countries.
#   • Good measure of *breadth of involvement* by country.
# When to use:
#   • You care about whether a country participated at all, not how many authors.
#
# ---------------------------
# METRIC = "fractional"
# ---------------------------
# Definition:
#   • Like participation, but each paper’s credit is split evenly across its
#     contributing countries. If a paper lists K distinct countries, each gets 1/K.
# What “count” means:
#   • Count = sum of fractional credits for Country in the Domain (can be 0.5, 1.3, …).
# Properties:
#   • Summing counts across countries equals the total # papers.
#   • Fair-share allocation that avoids double-counting multi-country papers.
# When to use:
#   • You want contributions that add up cleanly to totals while reflecting
#     international collaboration fairly.
#
# ---------------------------
# METRIC = "authors"
# ---------------------------
# Definition:
#   • Counts **author instances** by aligning Authors with Author Regions:
#       - If exactly one country is provided, it is broadcast to all authors.
#       - If counts differ, we pad/truncate with the last known country or fall
#         back to Focus Region; if missing, use "Unknown".
#   • Each author contributes +1 to their country in that Domain.
# What “count” means:
#   • Count = # of authors (people instances) from Country in the Domain.
# Properties:
#   • Summing counts across countries equals the total # of authors across papers.
#   • Heavily multi-authored papers contribute more than lightly authored papers.
# When to use:
#   • You want to reflect *people effort / capacity* rather than paper counts.
#
# ---------------------------
# Mini example (one paper, Domain = "X"):
#   Authors & Regions:
#     - A1 (USA), A2 (USA), A3 (UK)
#   Focus Region: USA
#
#   focus:         USA +1
#   participation: USA +1, UK +1     (dedup per country)
#   fractional:    USA +0.5, UK +0.5 (2 countries → each gets 1/2)
#   authors:       USA +2,   UK +1   (author instances)
#
# Notes:
#   • Missing Author Regions fall back to Focus Region, else "Unknown".
#   • If DROP_UNKNOWN_FROM_PLOT=True, "Unknown" is hidden in the figure
#     (but may still be included/excluded in denominators per DOMAIN_PCT_* flags).
#   • TOP_COUNTRIES / TOP_DOMAINS restrict rows/columns shown; consider setting
#     DOMAIN_PCT_USE_ALL_COUNTRIES=True if you want % to reference the global
#     domain totals even when plotting a subset.
# ---------------------------------------------------------------------------

"""

import os
import warnings
from textwrap import wrap

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings("ignore")

# =========================
# Config
# =========================
INPUT_CSV = "papers.csv"
OUT_DIR = "figures"; os.makedirs(OUT_DIR, exist_ok=True)

# Choose: 'focus' | 'participation' | 'fractional' | 'authors'
METRIC = "authors"

# Filter options (set to None to keep all)
TOP_COUNTRIES = 20
TOP_DOMAINS   = None

# Plot options
COLOR_BY_PERCENT = True                 # color scale by % (True) or raw count (False)
DROP_UNKNOWN_FROM_PLOT = True           # hide "Unknown" in the figure
ANNOTATE_ALWAYS = True                  # force annotations even for large grids

# Percent options (column-wise / per-domain)
DOMAIN_PCT_USE_ALL_COUNTRIES = True     # denom includes all countries (global) even if Top-N plotted
DOMAIN_PCT_EXCLUDE_UNKNOWN   = True     # exclude "Unknown" from domain denominators

# Styling
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")
plt.rcParams.update({
    "font.size": 12,
    "font.family": "serif",
    "figure.dpi": 300,
    "savefig.dpi": 300,
})

# =========================
# Helpers
# =========================
def wrap_label(s, width=16):
    s = "" if s is None else str(s)
    return s if len(s) <= width else "\n".join(wrap(s, width=width, break_long_words=False, break_on_hyphens=False))

def split_safe(x):
    """Split ';' into a clean list. Return [] for NaN/empty."""
    if pd.isna(x): 
        return []
    s = str(x).strip()
    if s.lower() in ("", "nan", "na", "none"):
        return []
    parts = [t.strip() for t in s.split(";")]
    return [t for t in parts if t and t.lower() not in ("nan", "na", "none")]

def country_set_for_row(row):
    """
    For participation/fractional: a NON-EMPTY SET of countries for a paper.
    - use Author Regions (dedup)
    - if empty, fall back to Focus Region
    - if still empty, return {'Unknown'}
    """
    countries = set(split_safe(row.get("Author Regions")))
    focus = row.get("Focus Region")
    focus = None if (pd.isna(focus) or str(focus).strip().lower() in ("", "nan", "na", "none")) else str(focus).strip()
    if not countries:
        countries = {focus} if focus else {"Unknown"}
    return countries

def author_country_list_for_row(row):
    """
    For authors metric: list of countries aligned to Authors length.
    Robust pairing rules:
      - If 1 country but many authors -> broadcast
      - If lengths differ -> pad/truncate with last known or Focus Region or 'Unknown'
      - If no regions -> use Focus Region or 'Unknown'
    Returns list (len = #authors). If no authors -> [].
    """
    authors  = split_safe(row.get("Authors"))
    regions  = split_safe(row.get("Author Regions"))
    focus    = row.get("Focus Region")
    focus    = None if (pd.isna(focus) or str(focus).strip().lower() in ("", "nan", "na", "none")) else str(focus).strip()

    if not authors:
        return []

    if len(regions) == 0:
        regions = [focus or "Unknown"] * len(authors)
    elif len(regions) == 1 and len(authors) > 1:
        regions = regions * len(authors)
    elif len(regions) != len(authors):
        fill = regions[-1] if regions else (focus or "Unknown")
        regions = list(regions) + [fill] * max(0, len(authors) - len(regions))
        regions = regions[:len(authors)]

    # final cleanup
    regions = [(r if r else (focus or "Unknown")) for r in regions]
    return regions

# =========================
# Load & clean
# =========================
df = pd.read_csv(INPUT_CSV)

# Keep valid domains
df["Domain"] = df["Domain"].astype(str).str.strip()
df = df[~df["Domain"].str.lower().isin(["", "nan", "na", "none"])].copy()

# =========================
# Build long tables for each metric
# =========================
records_participation, records_fractional, records_authors = [], [], []

for _, row in df.iterrows():
    domain = row["Domain"]

    # For participation / fractional
    countries = country_set_for_row(row)         # set
    k = len(countries)
    w = 1.0 / k
    for c in countries:
        records_participation.append((c, domain))     # unique paper per country-domain
        records_fractional.append((c, domain, w))     # fractional weight per country-domain

    # For authors metric
    auth_countries = author_country_list_for_row(row) # list aligned to authors
    for c in auth_countries:
        records_authors.append((c, domain))           # 1 per author instance

# Participation: unique paper counts per (Country, Domain)
country_domain_part = (
    pd.DataFrame(records_participation, columns=["Country", "Domain"])
      .value_counts()
      .reset_index(name="Count")
)

# Fractional: sum of weights per (Country, Domain)
country_domain_frac = (
    pd.DataFrame(records_fractional, columns=["Country", "Domain", "w"])
      .groupby(["Country", "Domain"], as_index=False)["w"].sum()
      .rename(columns={"w": "Count"})
)

# Focus-only: each paper once in Focus Region
focus_df = (
    df.assign(Country=df["Focus Region"].astype(str).str.strip())
      .loc[:, ["Domain", "Country"]]
)
focus_df["Country"] = focus_df["Country"].replace({"": np.nan, "nan": np.nan, "NA": np.nan, "None": np.nan}).fillna("Unknown")
country_domain_focus = (
    focus_df.value_counts(["Country", "Domain"])
            .reset_index(name="Count")
)

# Authors metric: author-instance counts per (Country, Domain)
country_domain_auth = (
    pd.DataFrame(records_authors, columns=["Country", "Domain"])
      .value_counts()
      .reset_index(name="Count")
)

# =========================
# Choose metric (and keep an unfiltered copy for denominators)
# =========================
if METRIC == "focus":
    df_metric_all = country_domain_focus.copy()
elif METRIC == "participation":
    df_metric_all = country_domain_part.copy()
elif METRIC == "fractional":
    df_metric_all = country_domain_frac.copy()
elif METRIC == "authors":
    df_metric_all = country_domain_auth.copy()
else:
    raise ValueError("METRIC must be 'focus', 'participation', 'fractional', or 'authors'.")

# Base for plotting (apply display filters)
df_plot_long = df_metric_all.copy()
if DROP_UNKNOWN_FROM_PLOT:
    df_plot_long = df_plot_long[df_plot_long["Country"] != "Unknown"]

# Filter countries by total (within chosen metric)
totals_by_country = df_plot_long.groupby("Country")["Count"].sum().sort_values(ascending=False)
if TOP_COUNTRIES is not None:
    keep_countries = totals_by_country.head(TOP_COUNTRIES).index
    df_plot_long = df_plot_long[df_plot_long["Country"].isin(keep_countries)]

# Pivot raw counts for shown countries
pivot_counts = (
    df_plot_long.pivot(index="Country", columns="Domain", values="Count")
                .fillna(0.0)
                .sort_index(axis=0)
)

# Optionally limit to top domains among shown countries
if TOP_DOMAINS is not None:
    top_domains = pivot_counts.sum(axis=0).sort_values(ascending=False).head(TOP_DOMAINS).index
    pivot_counts = pivot_counts.loc[:, top_domains]

# =========================
# Column-wise % (per-domain share)
# =========================
if DOMAIN_PCT_USE_ALL_COUNTRIES:
    denom_base = df_metric_all.copy()
    if DOMAIN_PCT_EXCLUDE_UNKNOWN:
        denom_base = denom_base[denom_base["Country"] != "Unknown"]
    domain_denoms = denom_base.groupby("Domain")["Count"].sum()
    domain_denoms = domain_denoms.reindex(pivot_counts.columns).replace(0, np.nan)
else:
    domain_denoms = pivot_counts.sum(axis=0).replace(0, np.nan)

pivot_pct = pivot_counts.div(domain_denoms, axis=1) * 100.0

# =========================
# Build annotation strings: "{pct:.1f}% (count)"
def fmt_count(x):
    # Fractional shows one decimal, others as integers
    return f"{x:.1f}" if METRIC == "fractional" else f"{int(round(x))}"

count_str = pivot_counts.applymap(fmt_count).astype(str)
annot_df = pivot_pct.round(1).astype(str) + "% (" + count_str + ")"

# =========================
# Plot
# =========================
data_for_color = pivot_pct if COLOR_BY_PERCENT else pivot_counts
cbar_label = "% within domain" if COLOR_BY_PERCENT else "Count"

num_cells = int(pivot_counts.shape[0] * pivot_counts.shape[1])
annotate = ANNOTATE_ALWAYS or (num_cells <= 2500)

fig_h = max(8, 0.5 * len(pivot_counts))
plt.figure(figsize=(14, fig_h))
ax = sns.heatmap(
    data_for_color,
    cmap="YlGnBu",
    annot=annot_df.values if annotate else False,
    fmt="",
    cbar_kws={"shrink": 0.55, "label": cbar_label},
)

wrapped_xticks = [wrap_label(col, width=16) for col in pivot_counts.columns]
ax.set_xticklabels(wrapped_xticks, fontsize=13, rotation=0)
ax.set_yticklabels(ax.get_yticklabels(), fontsize=13)

plt.xlabel("Domain", fontsize=14)
plt.ylabel("Country", fontsize=14)
title_bits = [f"Metric: {METRIC.capitalize()}"]
if TOP_COUNTRIES: title_bits.append(f"Top {TOP_COUNTRIES} Countries")
if TOP_DOMAINS:   title_bits.append(f"Top {TOP_DOMAINS} Domains")
# plt.title("Country × Domain — " + " | ".join(title_bits) + " — domain-share % shown", fontsize=14)

plt.tight_layout()
fig_pdf = os.path.join(OUT_DIR, f"country_domain_heatmap_{METRIC}_pct_count.pdf")
fig_png = os.path.join(OUT_DIR, f"country_domain_heatmap_{METRIC}_pct_count.png")
plt.savefig(fig_pdf, bbox_inches="tight", dpi=300)
plt.savefig(fig_png, bbox_inches="tight", dpi=300)
plt.show()
print(f"[Done] Saved figure: {fig_pdf} and {fig_png}")

# =========================
# Sanity checks (printed)
# =========================
total_papers = df["SN"].nunique() if "SN" in df.columns else len(df)
sum_focus = int(country_domain_focus["Count"].sum())
sum_part  = int(country_domain_part["Count"].sum())
sum_frac  = round(country_domain_frac["Count"].sum(), 6)
sum_auth  = int(country_domain_auth["Count"].sum())
print(f"[Check] Total unique papers: {total_papers}")
print(f"[Check] Sum Focus counts (= total papers): {sum_focus}")
print(f"[Check] Sum Participation counts (>= total, due to multi-country): {sum_part}")
print(f"[Check] Sum Fractional counts (= total papers): {sum_frac}")
print(f"[Check] Sum Authors counts (= total author instances): {sum_auth}")
