#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Country × Country collaboration matrix (paper– or author–weighted)

Features
- Aligns Authors ↔ Author Regions with Focus Region fallback
- Canonicalizes country/region strings (USA/UK/PRC/etc.)
- Two counting modes:
    • WEIGHT_BY_AUTHOR_MULTIPLICITY = False → one count per country pair per *paper*
    • WEIGHT_BY_AUTHOR_MULTIPLICITY = True  → counts **all cross-country author pairs**
      for a paper (cartesian product: count_A × count_B)
- Optional within-country diagonal (same-country collaborations)
- Word-wrapped ticks, dynamic annotation contrast w/ optional red/violet accent
- Horizontal colorbar below the matrix
- Saves PNG/PDF to ./figures

⚠ Not “first-author vs all-authors.” Both modes look at all authors on a paper.
The flag only switches between boolean presence (False) and multiplicity weighting (True).

EXAMPLE (thought experiment)
Paper 1 has authors from: USA (2 people), UK (1), China (1)
Paper 2 has authors from: USA (1), China (1)

Pair tallies:
  WEIGHT_BY_AUTHOR_MULTIPLICITY = False (boolean per paper)
    USA–UK:    1   (Paper 1)
    USA–China: 2   (Papers 1 & 2)
    UK–China:  1   (Paper 1)

  WEIGHT_BY_AUTHOR_MULTIPLICITY = True (multiplicity per paper)
    USA–UK:    2*1   = 2     (Paper 1)
    USA–China: 2*1 + 1*1 = 3 (Papers 1 & 2)
    UK–China:  1*1   = 1     (Paper 1)
"""

import os, re, textwrap
from collections import Counter
from itertools import combinations
from mpl_toolkits.axes_grid1.inset_locator import inset_axes
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import networkx as nx
import matplotlib.patheffects as pe
from pathlib import Path
from matplotlib.colors import Normalize

# ---------------- Plot style ----------------
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")
plt.rcParams.update({
    'font.size': 12,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300
})

# ---------------- Config ----------------
BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "papers.csv"
OUT_DIR   = "figures"; os.makedirs(OUT_DIR, exist_ok=True)
OUT_PNG   = os.path.join(OUT_DIR, "country_collaboration_matrix.png")
OUT_PDF   = os.path.join(OUT_DIR, "country_collaboration_matrix.pdf")

WRAP_WIDTH = 12                 # wrap width (chars) for tick labels
ANNOTATE_MAX_CELLS = 2500       # annotate only if matrix not too large

# Counting behavior
WEIGHT_BY_AUTHOR_MULTIPLICITY = False   # True=all-author weighting; False=one-per-paper-per-pair
INCLUDE_WITHIN_COUNTRY = False         # if True, include diagonal counts

# Cleaning behavior
KEEP_UNKNOWN  = False
KEEP_GLOBAL   = False
_EMPTY_TOKENS = {"", "nan", "na", "none", "null", "-"}

# Annotation coloring
USE_ACCENT_COLORS = False       # False → auto black/white; True → red/violet accents
ACCENT_HIGH = "#b91c1c"         # red-700
ACCENT_LOW  = "#6d28d9"         # violet-700
ACCENT_THRESH = 0.5             # threshold on normalized value for accent switch

# Optional: run a tiny in-code demo instead of reading your CSV
RUN_EXAMPLE = False  # set True to see the example numbers from the docstring printed

# ---------------- Canonicalization ----------------
_REGION_CANON_MAP = [
    (r"^(us|u\.s\.|usa|u\.s\.a\.|united states( of america)?)$", "United States"),
    (r"^(uk|u\.k\.|britain|great britain|united kingdom|england|scotland|wales|northern ireland)$", "United Kingdom"),
    (r"^(uae|united arab emirates|emirates)$", "United Arab Emirates"),
    (r"^(south korea|republic of korea|korea,?\s*republic|korea)$", "Republic of Korea"),
    (r"^(north korea|dprk|democratic people'?s republic of korea)$", "North Korea"),
    (r"^(russia|russian federation)$", "Russia"),
    (r"^(czech republic|czechia)$", "Czechia"),
    (r"^hong kong( sar)?$", "Hong Kong"),
    (r"^macau( sar)?$", "Macau"),
    (r"^(prc|people'?s republic of china|mainland china|china)$", "China"),
    (r"^(roc|republic of china|taiwan)$", "Taiwan"),
    (r"^(turkiye|turkey)$", "Türkiye"),
    (r"^(côte d’ivoire|cote d’ivoire|cote d'ivoire|ivory coast)$", "Côte d’Ivoire"),
]
_REGION_CANON_MAP = [(re.compile(p, re.I), canon) for p, canon in _REGION_CANON_MAP]

def canonicalize_region(name: str) -> str | None:
    if name is None or (isinstance(name, float) and np.isnan(name)):
        return None
    s = str(name).strip()
    if not s or s.lower() in _EMPTY_TOKENS:
        return None
    s = re.sub(r"\s+", " ", s)
    low = s.lower()
    for rx, canon in _REGION_CANON_MAP:
        if rx.match(low):
            return canon
    if s.upper() in {"UK", "USA", "UAE"}:
        return {"UK": "United Kingdom", "USA": "United States", "UAE": "United Arab Emirates"}[s.upper()]
    return s

def wrap_label_words(label: str, width: int = WRAP_WIDTH) -> str:
    return "\n".join(textwrap.wrap(str(label), width=width, break_long_words=False, break_on_hyphens=False))

def split_semicol(s):
    parts = [p.strip() for p in str(s).split(";")]
    return [p for p in parts if p and p.lower() not in _EMPTY_TOKENS]

# ---------------- Example path ----------------
def _example_dataframe():
    # Paper 1: USA(2), UK(1), China(1)
    # Paper 2: USA(1), China(1)
    data = pd.DataFrame({
        "Authors": [
            "A;B;C;D",
            "E;F"
        ],
        "Author Regions": [
            "USA;USA;UK;China",
            "USA;China"
        ],
        "Focus Region": ["USA", "USA"]
    })
    return data

# ---------------- Load data ----------------
if RUN_EXAMPLE:
    df = _example_dataframe()
else:
    df = pd.read_csv(INPUT_CSV)
    if "Authors" not in df.columns or "Author Regions" not in df.columns:
        raise KeyError("CSV must contain 'Authors' and 'Author Regions' columns.")

authors_list = df.get("Authors", "").fillna("").astype(str).map(split_semicol)
regions_raw  = df.get("Author Regions", "").fillna("").astype(str).map(split_semicol)
focus_clean  = df.get("Focus Region", "Unknown").fillna("Unknown").astype(str).str.strip()

def align_regions(row):
    auths = row["__authors"]
    regs  = [canonicalize_region(r) for r in row["__regions_raw"]]
    regs  = [r if r is not None else canonicalize_region(row["__focus"]) for r in regs]
    if len(regs) < len(auths):
        regs += [canonicalize_region(row["__focus"])] * (len(auths) - len(regs))
    else:
        regs = regs[:len(auths)]
    return regs

tmp = pd.DataFrame({
    "__authors": authors_list,
    "__regions_raw": regions_raw,
    "__focus": focus_clean,
})
tmp["__regions"] = tmp.apply(align_regions, axis=1)

# ---------------- Build per-paper country counts ----------------
paper_country_counts = []
for regs in tmp["__regions"]:
    clean = [r for r in regs if r is not None]
    if not KEEP_UNKNOWN:
        clean = [r for r in clean if r.lower() != "unknown"]
    if not KEEP_GLOBAL:
        clean = [r for r in clean if r.lower() != "global"]
    if not clean:
        continue
    paper_country_counts.append(Counter(clean))

if not paper_country_counts:
    print("No valid author-country data after cleaning; nothing to plot.")
    raise SystemExit

# ---------------- Edge accumulation ----------------
pair_counts = Counter()
diag_counts = Counter()

for cc in paper_country_counts:
    countries = sorted(cc.keys())
    if WEIGHT_BY_AUTHOR_MULTIPLICITY:
        for a, b in combinations(countries, 2):
            pair_counts[(a, b)] += cc[a] * cc[b]
        if INCLUDE_WITHIN_COUNTRY:
            for a in countries:
                n = cc[a]
                diag_counts[a] += n * (n - 1) // 2
    else:
        for a, b in combinations(sorted(set(countries)), 2):
            pair_counts[(a, b)] += 1
        if INCLUDE_WITHIN_COUNTRY:
            for a in countries:
                diag_counts[a] += 1

# ---------------- Graph + ordering ----------------
G = nx.Graph()
for (a, b), w in pair_counts.items():
    G.add_edge(a, b, weight=int(w))
for a in diag_counts:
    if a not in G:
        G.add_node(a)

wdeg = dict(G.degree(weight="weight"))
countries = sorted(G.nodes(), key=lambda c: (-wdeg.get(c, 0), c))
n = len(countries)
idx = {c: i for i, c in enumerate(countries)}

# ---------------- Adjacency matrix ----------------
mat = np.zeros((n, n), dtype=int)
for (a, b), w in pair_counts.items():
    i, j = idx[a], idx[b]
    mat[i, j] = int(w); mat[j, i] = int(w)
if INCLUDE_WITHIN_COUNTRY:
    for a, w in diag_counts.items():
        i = idx[a]; mat[i, i] = int(w)

# ---------------- Plot ----------------
countries_wrapped_x = [wrap_label_words(c) for c in countries]
countries_wrapped_y = [wrap_label_words(c) for c in countries]

fig_w = max(12, min(26, 0.45 * n + 8))
fig_h = max(12, min(26, 0.45 * n + 8))
fig, ax = plt.subplots(figsize=(fig_w, fig_h))

cmap = plt.cm.Blues
im = ax.imshow(mat, cmap=cmap)

ax.set_xticks(range(n))
ax.set_yticks(range(n))
ax.set_xticklabels(countries_wrapped_x, rotation=45, ha="center", fontsize=16)
ax.set_yticklabels(countries_wrapped_y, fontsize=16)

# Dynamic annotations
num_cells = n * n
if num_cells <= ANNOTATE_MAX_CELLS:
    nz = np.argwhere(mat > 0)
    norm = Normalize(vmin=mat.min(), vmax=mat.max() if mat.max() > 0 else 1)
    for i, j in nz:
        val = mat[i, j]
        if not USE_ACCENT_COLORS:
            r, g, b, _ = cmap(norm(val))
            lum = 0.2126*r + 0.7152*g + 0.0722*b
            fg  = "white" if lum < 0.55 else "#111827"
            halo= "#111827" if lum > 0.55 else "white"
        else:
            fg, halo = (ACCENT_HIGH if norm(val) >= ACCENT_THRESH else ACCENT_LOW), "white"
        ax.text(j, i, str(val), ha="center", va="center", fontsize=15,
                color=fg, path_effects=[pe.withStroke(linewidth=1.8, foreground=halo)])

# Horizontal colorbar
unit = "author-pair weight" if WEIGHT_BY_AUTHOR_MULTIPLICITY else "papers"
cb = fig.colorbar(im, ax=ax, orientation="horizontal", fraction=0.046, pad=0.092)
cb.set_label(f"# joint {unit}", fontsize=16)
# ax.set_xlabel("Country", fontsize=16)
# ax.set_ylabel("Country", fontsize=16)
plt.tight_layout()
fig.savefig(OUT_PNG, dpi=300, bbox_inches="tight")
fig.savefig(OUT_PDF, dpi=300, bbox_inches="tight")
# plt.show()
print("Saved:", OUT_PNG)
print("Saved:", OUT_PDF)
