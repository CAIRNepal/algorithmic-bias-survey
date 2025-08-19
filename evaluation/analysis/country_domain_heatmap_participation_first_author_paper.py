#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Country × Domain (FIRST AUTHOR ONLY) with % (count) annotations

Country × Domain (first author only). Heatmap of the column-wise share of papers within each domain whose first author is from each country. Cells are annotated as “% (count)”, where the count is the number of first-authored papers for that country–domain. Percentages are normalized within each domain (optionally using all countries and excluding “Unknown” per settings), with rows/columns limited to Top-N if specified.

"""

import os
import warnings
from textwrap import wrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
warnings.filterwarnings("ignore")

# =========================
# Config
# =========================
BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "papers.csv"
# INPUT_CSV = "papers.csv"
OUT_DIR = "figures"; os.makedirs(OUT_DIR, exist_ok=True)

TOP_COUNTRIES = 20      # set None for all
TOP_DOMAINS   = None    # set None for all
COLOR_BY_PERCENT = True
DROP_UNKNOWN_FROM_PLOT = True
ANNOTATE_ALWAYS = True
DOMAIN_PCT_USE_ALL_COUNTRIES = True
DOMAIN_PCT_EXCLUDE_UNKNOWN   = True

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
    if pd.isna(x): 
        return []
    s = str(x).strip()
    if s.lower() in ("", "nan", "na", "none"):
        return []
    parts = [t.strip() for t in s.split(";")]
    return [t for t in parts if t and t.lower() not in ("nan", "na", "none")]

def first_author_country(row):
    authors = split_safe(row.get("Authors"))
    regions = split_safe(row.get("Author Regions"))
    focus   = row.get("Focus Region")
    focus   = None if (pd.isna(focus) or str(focus).strip().lower() in ("", "nan", "na", "none")) else str(focus).strip()
    if not authors:
        return None, None
    first_author  = authors[0]
    first_country = regions[0] if regions else (focus or "Unknown")
    return first_author, first_country

# =========================
# Load & clean
# =========================
df = pd.read_csv(INPUT_CSV)
df["Domain"] = df["Domain"].astype(str).str.strip()
df = df[~df["Domain"].str.lower().isin(["", "nan", "na", "none"])].copy()

# =========================
# Build first-author table (one row per paper)
# =========================
rows = []
for _, r in df.iterrows():
    a, c = first_author_country(r)
    if a and c:
        rows.append((r["SN"], c, r["Domain"]))

dfa = pd.DataFrame(rows, columns=["SN", "Country", "Domain"])

# Clean country labels  ✅ fixed here
dfa = dfa[dfa["Country"].notna()].copy()
dfa["Country"] = dfa["Country"].astype(str).str.strip()
dfa = dfa[~dfa["Country"].str.lower().isin(["nan", "na", "none", ""])]

# Aggregate (each paper counted once in its first author's country)
country_domain = (
    dfa.groupby(["Country", "Domain"])["SN"]
       .nunique()
       .reset_index()
       .rename(columns={"SN": "Count"})
)

country_domain.to_csv("country_domain_first_author.csv", index=False)
print("[Info] Saved CSV: country_domain_first_author.csv")

# =========================
# Prepare for plotting
# =========================
df_plot_long = country_domain.copy()
if DROP_UNKNOWN_FROM_PLOT:
    df_plot_long = df_plot_long[df_plot_long["Country"] != "Unknown"]

totals_by_country = df_plot_long.groupby("Country")["Count"].sum().sort_values(ascending=False)
if TOP_COUNTRIES is not None:
    keep_countries = totals_by_country.head(TOP_COUNTRIES).index
    df_plot_long = df_plot_long[df_plot_long["Country"].isin(keep_countries)]

pivot_counts = (
    df_plot_long.pivot(index="Country", columns="Domain", values="Count")
                .fillna(0)
                .sort_index(axis=0)
)

if TOP_DOMAINS is not None:
    top_domains = pivot_counts.sum(axis=0).sort_values(ascending=False).head(TOP_DOMAINS).index
    pivot_counts = pivot_counts.loc[:, top_domains]

# =========================
# Column-wise % (per-domain share)
# =========================
if DOMAIN_PCT_USE_ALL_COUNTRIES:
    denom_base = country_domain.copy()
    if DOMAIN_PCT_EXCLUDE_UNKNOWN:
        denom_base = denom_base[denom_base["Country"] != "Unknown"]
    domain_denoms = denom_base.groupby("Domain")["Count"].sum()
    domain_denoms = domain_denoms.reindex(pivot_counts.columns).replace(0, np.nan)
else:
    domain_denoms = pivot_counts.sum(axis=0).replace(0, np.nan)

pivot_pct = pivot_counts.div(domain_denoms, axis=1) * 100.0

# Annotations: "% (count)"
count_str = pivot_counts.astype(int).astype(str)
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
plt.ylabel("Country (First Author)", fontsize=14)
title_bits = ["First Author Only", "Domain-share % shown"]
if TOP_COUNTRIES: title_bits.insert(0, f"Top {TOP_COUNTRIES} Countries")
if TOP_DOMAINS:   title_bits.append(f"Top {TOP_DOMAINS} Domains")
# plt.title("Country × Domain — " + " | ".join(title_bits), fontsize=14)

# caption = ("Each cell shows the % of a domain’s papers whose FIRST author is from that country; "
#            "parentheses show the number of first-authored papers. Column percentages use "
#            f"{'all countries' if DOMAIN_PCT_USE_ALL_COUNTRIES else 'only the displayed countries'}"
#            f"{' (excluding Unknown)' if DOMAIN_PCT_EXCLUDE_UNKNOWN else ''} as the denominator.")
# plt.figtext(0.5, -0.02, caption, ha="center", va="top", fontsize=10, wrap=True)

plt.tight_layout()
fig_pdf = os.path.join(OUT_DIR, "country_domain_heatmap_first_author_pct_count.pdf")
fig_png = os.path.join(OUT_DIR, "country_domain_heatmap_first_author_pct_count.png")
plt.savefig(fig_pdf, bbox_inches="tight", dpi=300)
plt.savefig(fig_png, bbox_inches="tight", dpi=300)
# plt.show()
print(f"[Done] Saved figure: {fig_pdf} and {fig_png}")

# =========================
# Sanity checks
# =========================
total_papers = df["SN"].nunique()
sum_counts = int(country_domain["Count"].sum())
print(f"[Check] Total unique papers in CSV: {total_papers}")
print(f"[Check] Sum of first-author assignments: {sum_counts}")
