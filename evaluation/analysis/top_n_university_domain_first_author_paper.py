#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Universities × Domain heatmap with % (n) annotations.
- Supports ALL AUTHORS vs FIRST AUTHOR ONLY (toggle FIRST_AUTHOR_ONLY).
- Dynamic domains. Drops empty domains after Top-N filter.
- Column-wise normalization (percent within each domain).
- External colorbar, wrapped x-ticks.

Inputs:
- papers.csv with at least: "Affiliations" (semicolon-separated) and "Domain".
  Optionally "Focus Region" (defaults to "Global").

Outputs:
- figures/top_20_university_domain[_first].pdf/.png
- university_country_domain_cleaned.csv
- university_domain_canonical.csv
- unmapped_institutions.csv

Universities × Domain (first author only). Heatmap shows each domain’s column-wise share of papers, where each paper contributes once via the first author’s first affiliation. Cell labels are “% (n)”, where n is the number of papers. Percentages in each column sum to ~100% across the displayed universities.
"""

import os, re, warnings
from textwrap import wrap

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from mpl_toolkits.axes_grid1 import make_axes_locatable

warnings.filterwarnings('ignore')

# ---------------- Plot style ----------------
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")
plt.rcParams.update({
    'font.size': 12,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300
})

# =========================
# Config
# =========================
INPUT_CSV = "papers.csv"
OUT_DIR = "figures"
os.makedirs(OUT_DIR, exist_ok=True)

# Toggle: False = all authors (exploded). True = first author only.
FIRST_AUTHOR_ONLY = True   # <- default: ALL AUTHORS
TOP_N = 20                  # choose how many universities to plot (None for ALL)

# Filenames
suffix = "_first" if FIRST_AUTHOR_ONLY else ""
FIG_PDF = os.path.join(OUT_DIR, f"top_20_university_domain{suffix}.pdf")
FIG_PNG = os.path.join(OUT_DIR, f"top_20_university_domain{suffix}.png")

OUT_AGG_FULL = "university_country_domain_cleaned.csv"   # University × Focus Region × Domain (canonicalized)
OUT_AGG_CANON = "university_domain_canonical.csv"        # University × Domain (canonicalized)
OUT_UNMAPPED = "unmapped_institutions.csv"

print("[MODE]", "FIRST AUTHOR ONLY" if FIRST_AUTHOR_ONLY else "ALL AUTHORS")

# =========================
# Helpers
# =========================
def split_affils(s: str) -> list[str]:
    if pd.isna(s):
        return []
    return [a.strip() for a in str(s).split(";") if a and a.strip()]

def first_affil(s: str) -> str | None:
    items = split_affils(s)
    return items[0] if items else None

def basic_affil_preclean(name: str) -> str:
    if pd.isna(name) or not str(name).strip():
        return ""
    n = str(name).strip()
    n = re.sub(
        r"\s*\((united states|usa|uk|canada|germany|australia|spain|europe|european|global)\)\s*$",
        "", n, flags=re.I
    )
    n = n.replace("’", "'").replace("–", "-").replace("—", "-")
    n = re.sub(r"\s+", " ", n)
    n = re.sub(r"[,\.;:\s]+$", "", n)
    return n.strip()

# --- FULL Canonical mapping (regex -> canonical label). ---
CANONICAL_ORG_MAP = {
    # --- Major US/UK/EU universities ---
    r"\bmit\b|massachusetts institute of technology": "MIT",
    r"\bharvard\b": "Harvard University",
    r"\bstanford\b": "Stanford University",
    r"\buniversity college london\b|\bucl\b": "University College London",
    r"\brutgers(?!\s*business)|rutgers, the state university of new jersey": "Rutgers University",
    r"\buniversity of pennsylvania\b|\bupenn\b": "University of Pennsylvania",
    r"\buniversity of michigan\b": "University of Michigan",
    r"\bmichigan state\b": "Michigan State University",
    r"\bnorth carolina state\b": "North Carolina State University",
    r"\bcarnegie mellon\b|\bcmu\b": "Carnegie Mellon University",
    r"\bcolumbia\b": "Columbia University",
    r"\bcornell\b": "Cornell University",
    r"\byale\b": "Yale University",
    r"\buniversity of washington(?!\s*bothell)": "University of Washington",
    r"\buniversity of washington bothell\b": "University of Washington Bothell",
    r"\buniversity of southern california\b|\busc\b": "University of Southern California",
    r"\buniversity of virginia\b": "University of Virginia",
    r"\buniversity of arizona\b": "University of Arizona",
    r"\buniversity of utah\b": "University of Utah",
    r"\buniversity of georgia\b": "University of Georgia",
    r"\buniversity of illinois chicago\b": "University of Illinois Chicago",
    r"\buniversity of minnesota(?!, duluth)": "University of Minnesota",
    r"\buniversity of minnesota,\s*duluth\b": "University of Minnesota Duluth",
    r"\bqueen'?s university\b": "Queen's University",
    r"\bgeorge washington university\b": "George Washington University",

    # --- UC specifics ---
    r"\bucla\b|\buniversity of california,\s*los angeles\b": "UCLA",
    r"\buc berkeley\b|\buniversity of california,\s*berkeley\b": "UC Berkeley",
    r"\buniversity of california,\s*riverside\b": "UC Riverside",

    # --- Europe (UK/EU) ---
    r"\buniversity of oxford\b|\boxford university\b|\boxford\b": "University of Oxford",
    r"\buniversity of cambridge\b|\bcambridge university\b|\bcambridge\b": "University of Cambridge",
    r"\bimperial college london\b": "Imperial College London",
    r"\brwth aachen\b": "RWTH Aachen University",
    r"\btechnische universität berlin\b|\btu berlin\b": "Technische Universität Berlin",
    r"\bcharit[eé]\b.*universitätsmedizin berlin": "Charité - Universitätsmedizin Berlin",
    r"\buniversity college dublin\b": "University College Dublin",
    r"\bthe alan turing institute\b": "The Alan Turing Institute",
    r"\btib leibniz information centre.*\b": "TIB Leibniz Information Centre for Science and Technology",
    r"\bl3s research center.*leibniz university hannover\b": "L3S Research Center & Leibniz University Hannover",
    r"\bipvs, universität stuttgart\b|\buniversität stuttgart\b": "University of Stuttgart",
    r"\bgesis\b.*social sciences": "GESIS Leibniz Institute for the Social Sciences",
    r"\b[ée]cole polytechnique\b": "École Polytechnique",
    r"\bvienna university of economics and business\b": "Vienna University of Economics and Business",
    r"\buniversity of portsmouth\b": "University of Portsmouth",
    r"\bleiden university medical center\b": "Leiden University Medical Center",
    r"\buniversity hospital of zurich\b": "University Hospital of Zurich",
    r"\buniversity of zurich\b": "University of Zurich",
    r"\bzurich university of applied sciences\b": "Zurich University of Applied Sciences",
    r"\bheinrich-heine-universit[aä]t d[üu]sseldorf\b": "Heinrich-Heine-Universität Düsseldorf",
    r"\binstitute for legal informatics, leibniz university of hanover\b": "Leibniz University Hannover",
    r"\binstitute of computer science, forth-ics\b": "FORTH-ICS",
    r"\binnovation lab, schu[aä]fa holding ag\b": "SCHUFA Holding AG",
    r"\binformation technologies institute, certh\b": "CERTH – Information Technologies Institute",
    r"\buniversit[eé] de toulouse\b|\binstitut de math[eé]matiques de toulouse\b": "Université de Toulouse",
    r"\buniversity of southampton\b|\buniversity of southampton.*electronics and computer science\b": "University of Southampton",

    # --- Asia (CN/HK/TW/KR) ---
    r"\btsinghua university\b": "Tsinghua University",
    r"\bpeking university\b": "Peking University",
    r"\bfudan university\b": "Fudan University",
    r"\bshanghai jiao tong university\b": "Shanghai Jiao Tong University",
    r"\bzhejiang university\b": "Zhejiang University",
    r"\bnational taiwan university\b": "National Taiwan University",
    r"\buniversity of hong kong\b": "University of Hong Kong",
    r"\bhong kong university of science and technology \((guangzhou|gz)\)|\bhkust\b|\bthe hong kong university of science and technology\b":
        "The Hong Kong University of Science and Technology",
    r"\bthe hong kong polytechnic university\b": "The Hong Kong Polytechnic University",
    r"\bcity university of hong kong\b": "City University of Hong Kong",
    r"\bzhongguancun laboratory\b": "Zhongguancun Laboratory",
    r"\bzhongguancun laboratory, tsinghua university\b": "Zhongguancun Laboratory",
    r"\bharbin institute of technology, shenzhen\b": "Harbin Institute of Technology, Shenzhen",
    r"\bmoe key laboratory of high confidence software technologies\b": "MOE Key Laboratory of High Confidence Software Technologies",
    r"\bwestlake university\b": "Westlake University",
    r"\byen[gk]se?i university\b": "Yonsei University",
    r"\bkaist\b|\bkorea advanced institute of science and technology\b": "KAIST",
    r"\bjilin university\b": "Jilin University",
    r"\brenmin university\b": "Renmin University of China",

    # --- Australia / NZ ---
    r"\bunsw sydney\b": "UNSW Sydney",
    r"\buniversity of technology sydney\b": "University of Technology Sydney",
    r"\buniversity of wollongong\b": "University of Wollongong",
    r"\bswansea university\b": "Swansea University",  # note: had AU mark in CSV once
    r"\bunited arab emirates university\b": "United Arab Emirates University",

    # --- Hospitals / Clinics / Health orgs ---
    r"\bbrigham and women'?s hospital\b": "Brigham and Women's Hospital",
    r"\bmassachusetts general hospital\b": "Massachusetts General Hospital",
    r"\bnorthwestern university\b": "Northwestern University",
    r"\bmayo clinic\b": "Mayo Clinic",
    r"\bmedical university of graz\b": "Medical University of Graz",
    r"\buniversity hospital carl gustav carus\b": "University Hospital Carl Gustav Carus",
    r"\bcenter for devices and radiological health\b": "Center for Devices and Radiological Health",
    r"\bfraunhofer institute for digital medicine\b": "Fraunhofer Institute for Digital Medicine",
    r"\btampere university\b": "Tampere University",
    r"\bst\.?\s*helena hospital\b": "St. Helena Hospital",
    r"\bst\.?\s*luke'?s international university\b": "St. Luke's International University",
    r"\bkaiser permanente\b": "Kaiser Permanente",

    # --- Companies / Labs ---
    r"\bgoogle research\b": "Google Research",
    r"\bgoogle\b": "Google",
    r"\bibm research - india\b": "IBM Research India",
    r"\bibm research\b": "IBM Research",
    r"\bmicrosoft research\b": "Microsoft Research",
    r"\bmicrosoft \((united states|canada)\)\b": "Microsoft",
    r"\bamazon aws ai\b": "Amazon AWS AI",
    r"\bamazon\b": "Amazon",
    r"\badobe research\b": "Adobe Research",
    r"\badobe systems\b": "Adobe",
    r"\bdeepmind\b": "DeepMind",
    r"\balibaba\b": "Alibaba",
    r"\bant group\b": "Ant Group",
    r"\bintel\b": "Intel",
    r"\btwitter\b": "Twitter",
    r"\btencent\b": "Tencent",
    r"\bhuawei noah'?s ark lab\b|\bhuawei\b": "Huawei",
    r"\barista\b": "Arista",
    r"\bolympus\b": "Olympus",
    r"\bopen knowledge\b": "Open Knowledge Foundation",

    # --- Misc / Institutes / Faculties ---
    r"\bknowledge media institute, the open university\b|\bthe open university\b": "The Open University",
    r"\blaboratoire hubert curien\b": "Laboratoire Hubert Curien",
    r"\binstitut polytechnique de paris\b": "Institut Polytechnique de Paris",
    r"\bamsterdam university medical centers\b|\bamsterdam umc\b": "Amsterdam University Medical Centers",
    r"\bdepartment of cognitive and brain sciences, hebrew university\b": "Hebrew University of Jerusalem",
    r"\bfedermann center.*hebrew university\b": "Hebrew University of Jerusalem",
    r"\bfaculty of data and decision sciences, technion\b|\btechnion\b": "Technion – Israel Institute of Technology",
    r"\bkddlab,? dipartimento di informatica, universit[aà] di pisa\b|\buniversity of pisa\b": "University of Pisa",
    r"\binstitut[o|e] de matem[aá]ticas.*valladolid\b|\buniversity of valladolid\b": "University of Valladolid",
    r"\binstitut[o|e] de matem[aá]ticas.*toulouse\b": "Université de Toulouse",
    r"\baalborg university\b": "Aalborg University",
    r"\bhaverford college\b": "Haverford College",
    r"\bwestern university\b": "Western University",
    r"\buniversity of rochester\b": "University of Rochester",
    r"\buniversity of cagliari\b": "University of Cagliari",
    r"\bmacquarie university\b": "Macquarie University",
    r"\by[ıi]ld[ıi]z technical university\b": "Yıldız Technical University",
    r"\bbennett university\b": "Bennett University",
    r"\bcmr university\b": "CMR University",
    r"\bcape breton university\b": "Cape Breton University",
    r"\bcardiovascular institute of the south\b": "Cardiovascular Institute of the South",
    r"\bthe chinese university of hong kong\b": "The Chinese University of Hong Kong",
    r"\buniversity of central florida\b": "University of Central Florida",
    r"\buniversity of notre dame\b": "University of Notre Dame",
    r"\buniversity of padua\b": "University of Padua",
    r"\buniversity of pennsylvania.*health": "University of Pennsylvania",
    r"\buniversity of waterloo\b": "University of Waterloo",
    r"\buniversity of victoria\b": "University of Victoria",
}
COMPILED_MAP = [(re.compile(pat, flags=re.I), canon) for pat, canon in CANONICAL_ORG_MAP.items()]

def canonicalize_org(name: str) -> str | None:
    if pd.isna(name) or not str(name).strip():
        return None
    pre = basic_affil_preclean(name)
    low = pre.lower()
    for rx, canon in COMPILED_MAP:
        if rx.search(low):
            return canon
    return pre  # fallback to pre-cleaned

def wrap_label(s, width=14):
    s = "" if s is None else str(s)
    if len(s) <= width:
        return s
    return "\n".join(wrap(s, width=width, break_long_words=False, break_on_hyphens=False))

# =========================
# Load + Prepare
# =========================
df = pd.read_csv(INPUT_CSV)

# Ensure required columns
if "Affiliations" not in df.columns or "Domain" not in df.columns:
    raise KeyError("Expected columns 'Affiliations' and 'Domain' in papers.csv")

if "Focus Region" not in df.columns:
    df["Focus Region"] = "Global"

# Canonicalize domain labels
df["Domain"] = df["Domain"].astype(str).str.strip()
df = df.replace({"Domain": {"nan": None}}).dropna(subset=["Domain"])
df["Focus Region"] = df["Focus Region"].astype(str).str.strip()

# ----- Build author-university rows -----
if FIRST_AUTHOR_ONLY:
    # Only the first affiliation per paper
    df["FirstAffilRaw"] = df["Affiliations"].apply(first_affil)
    df_first = df.dropna(subset=["FirstAffilRaw"]).copy()
    df_first["University"] = df_first["FirstAffilRaw"].apply(canonicalize_org)
    df_first = df_first.dropna(subset=["University"])
    base_rows = df_first[["University", "Domain", "Focus Region"]].copy()
else:
    # All authors: explode affiliations (identical to your baseline)
    df["Affil_List"] = df["Affiliations"].apply(split_affils)
    df_exp = df.explode("Affil_List").dropna(subset=["Affil_List"]).copy()
    df_exp["University"] = df_exp["Affil_List"].apply(canonicalize_org)
    df_exp = df_exp.dropna(subset=["University"])
    base_rows = df_exp[["University", "Domain", "Focus Region", "Affil_List"]].copy()

# =========================
# Unmapped report (from ALL affiliations if available; else first-affil only)
# =========================
def is_unmapped(raw):
    if pd.isna(raw) or not str(raw).strip():
        return False
    pre = basic_affil_preclean(raw).lower()
    return not any(rx.search(pre) for rx, _ in COMPILED_MAP)

if not FIRST_AUTHOR_ONLY:
    unmapped_series = (
        df_exp.loc[df_exp["Affil_List"].apply(is_unmapped), "Affil_List"]
        .apply(basic_affil_preclean)
    )
else:
    unmapped_series = (
        df_first.loc[df_first["FirstAffilRaw"].apply(is_unmapped), "FirstAffilRaw"]
        .apply(basic_affil_preclean)
    )

unmapped_counts = unmapped_series.value_counts().reset_index()
unmapped_counts.columns = ["Raw_Institution_Precleaned", "Count"]
unmapped_counts.to_csv(OUT_UNMAPPED, index=False)
print(f"[Info] Saved unmapped institutions to: {OUT_UNMAPPED} (rows={len(unmapped_counts)})")

# =========================
# Aggregations (canonicalized)
# =========================
uni_country_domain = (
    base_rows.groupby(["University", "Focus Region", "Domain"])
             .size().reset_index(name="Count")
)
uni_country_domain.to_csv(OUT_AGG_FULL, index=False)
print(f"[Info] Saved aggregate (University × Focus Region × Domain) to: {OUT_AGG_FULL} (rows={len(uni_country_domain)})")

uni_domain = (
    base_rows.groupby(["University", "Domain"])
             .size().reset_index(name="Count")
)
uni_domain.to_csv(OUT_AGG_CANON, index=False)
print(f"[Info] Saved canonical University × Domain to: {OUT_AGG_CANON} (rows={len(uni_domain)})")

# --- Optional: checksum for 1:1 verification across scripts ---
chk = (uni_domain.sort_values(["University","Domain","Count"])
                 .reset_index(drop=True))
print("Checksum:", pd.util.hash_pandas_object(chk, index=False).sum())

# =========================
# Pivot + Plot (percent per column; drop empty domains)
# =========================
df_plot = uni_domain.copy()

# Top-N universities by total papers across domains (deterministic)
totals = (df_plot.groupby("University")["Count"]
                 .sum()
                 .sort_values(ascending=False, kind="mergesort"))
if TOP_N is not None:
    print("[TopN cutoff preview]")
    print(totals.head(TOP_N + 5))
    top_unis = totals.head(TOP_N).index
    df_plot = df_plot[df_plot["University"].isin(top_unis)]

# Pivot: University × Domain
pivot_ud = (
    df_plot.pivot(index="University", columns="Domain", values="Count")
           .fillna(0)
           .sort_index(axis=0)
           .sort_index(axis=1)
)

# Drop domains empty in the selected slice
col_totals = pivot_ud.sum(axis=0)
non_empty_cols = col_totals[col_totals > 0].index
pivot_ud = pivot_ud.loc[:, non_empty_cols]

# Recompute totals and percent matrix
col_totals = pivot_ud.sum(axis=0)
percent_matrix = pivot_ud.divide(col_totals.replace(0, np.nan), axis=1) * 100.0

# Build "% (n)" annotations
ann = pivot_ud.astype(object).copy()
for j, col in enumerate(pivot_ud.columns):
    denom = col_totals.loc[col]
    for i, _ in enumerate(pivot_ud.index):
        n = int(pivot_ud.iat[i, j])
        ann.iat[i, j] = f"{(n/denom*100.0):.1f}% ({n})" if denom > 0 else f"0.0% ({n})"

# Auto-annotate threshold
num_cells = int(pivot_ud.shape[0] * pivot_ud.shape[1])
annotate = num_cells <= 2500

# Dynamic figure size
fig_height = max(8, 0.38 * max(1, len(pivot_ud)))
fig_width  = max(10, 1.2 * max(8, pivot_ud.shape[1]))

# Plot
fig, ax = plt.subplots(figsize=(fig_width, fig_height), constrained_layout=True)
hm = sns.heatmap(
    percent_matrix,
    ax=ax,
    annot=ann if annotate else False,
    fmt="",
    cmap="YlGnBu",
    vmin=0, vmax=100,
    cbar=False,
    linewidths=0.0
)

# Wrapped x-ticks
wrapped_xticks = [wrap_label(col, width=14) for col in percent_matrix.columns]
ax.set_xticklabels(wrapped_xticks, fontsize=12, ha="center", rotation=0)
ax.set_yticklabels(ax.get_yticklabels(), fontsize=12)

ax.set_xlabel("Domain", fontsize=13)
ax.set_ylabel("University", fontsize=13)
# title_bits = ["Universities × Domain — Share within domain"]
# title_bits.append(f"(Top {TOP_N})" if TOP_N is not None else "(All)")
# if FIRST_AUTHOR_ONLY:
#     title_bits.append("[First author only]")
# ax.set_title(" ".join(title_bits), fontsize=14, weight="bold", pad=12)

# External colorbar
divider = make_axes_locatable(ax)
cax = divider.append_axes("right", size="3%", pad=0.4)
cb = fig.colorbar(hm.collections[0], cax=cax)
cb.ax.tick_params(labelsize=10)
cb.set_label("Percent within domain (%)", fontsize=11)

# Save
fig.savefig(FIG_PDF, bbox_inches="tight", dpi=300)
fig.savefig(FIG_PNG, bbox_inches="tight", dpi=300)
# plt.show()
plt.close(fig)

print(f"[Done] Saved heatmap: {FIG_PDF} and {FIG_PNG}")
