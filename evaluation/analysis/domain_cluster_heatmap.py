"""
Generate a domain × cluster co-occurrence heatmap from atlas_data.csv.
Output: images/new/domain_cluster_heatmap.pdf
"""

import csv
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
from collections import defaultdict

DATA = "dashboard/public/atlas_data.csv"
OUT  = "evaluation/analysis/images/domain_cluster_heatmap.pdf"

# ── 1. Load data
rows = []
with open(DATA) as f:
    for row in csv.DictReader(f):
        domain  = row["domain"].strip()
        cluster = row["cluster_label"].strip()
        if domain and cluster:
            rows.append((domain, cluster))

# ── 2. Build ordered lists
DOMAIN_ORDER = [
    "Health & Clinical AI",
    "LLMs & NLP",
    "General Fairness & Bias Mitigation",
    "Recommender Systems",
    "Graph-Based Fairness & Bias Mitigation",
]

# Collect all clusters, sort by total count descending
cluster_counts: dict[str, int] = defaultdict(int)
for _, c in rows:
    cluster_counts[c] += 1
cluster_order = sorted(cluster_counts, key=lambda x: -cluster_counts[x])

CLUSTER_ABBREV = {
    "Psychology · Mathematics":                    "Psych. · Math",
    "Psychology · Natural language processing":    "Psych. · NLP",
    "Health care · Medicine":                      "Health · Medicine",
    "Recommender system · Information retrieval":  "RecSys · Info. Retrieval",
    "Health care · Psychology":                    "Health · Psychology",
    "Graph · Theoretical computer science":        "Graph · Comp. Sci.",
}

# ── 3. Build co-occurrence matrix
matrix = np.zeros((len(DOMAIN_ORDER), len(cluster_order)), dtype=int)
for domain, cluster in rows:
    if domain in DOMAIN_ORDER and cluster in cluster_order:
        r = DOMAIN_ORDER.index(domain)
        c = cluster_order.index(cluster)
        matrix[r, c] += 1

# ── 4. Row totals for percentage annotation
row_totals = matrix.sum(axis=1)

# ── 5. Plot
fig, ax = plt.subplots(figsize=(11, 5))

im = ax.imshow(matrix, cmap="Blues", aspect="auto")

# Colorbar
cbar = fig.colorbar(im, ax=ax, shrink=0.85)
cbar.set_label("Number of papers", fontsize=13)

# Axis labels
ax.set_xticks(range(len(cluster_order)))
ax.set_xticklabels([CLUSTER_ABBREV.get(c, c) for c in cluster_order], rotation=25, ha="right", fontsize=11)
ax.set_yticks(range(len(DOMAIN_ORDER)))
ax.set_yticklabels(DOMAIN_ORDER, fontsize=12)

ax.set_xlabel("HDBSCAN Cluster", fontsize=15, fontweight="bold")
ax.set_ylabel("Domain", fontsize=15, fontweight="bold")
ax.set_title("Domain × Cluster Co-occurrence", fontsize=14, fontweight="bold")

# Cell annotations: count (pct%)
for r in range(len(DOMAIN_ORDER)):
    for c in range(len(cluster_order)):
        val = matrix[r, c]
        if val == 0:
            continue
        pct = 100 * val / row_totals[r] if row_totals[r] > 0 else 0
        color = "white" if val > matrix.max() * 0.55 else "black"
        ax.text(c, r, f"{val}\n({pct:.0f}%)", ha="center", va="center",
                fontsize=10, color=color)

plt.tight_layout()
plt.savefig(OUT, dpi=200, bbox_inches="tight")
plt.savefig(OUT.replace(".pdf", ".png"), dpi=200, bbox_inches="tight")
print(f"Saved → {OUT} + .png")
