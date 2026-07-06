"""
Independent validation: UMAP with library defaults (no grid search),
then HDBSCAN, then compare clusters to domain labels.

No domain labels are used in any decision. They only appear at the end
to measure agreement (ARI, NMI).
"""
import pandas as pd
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.cluster import HDBSCAN
from sklearn.metrics import silhouette_score, adjusted_rand_score, normalized_mutual_info_score
import matplotlib.pyplot as plt
import umap
import warnings

warnings.filterwarnings('ignore')

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
ENRICHED = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS   = BASE_DIR / 'papers_new.csv'

MODEL_ID = 'all-mpnet-base-v2'

# UMAP library defaults — no tuning
UMAP_N_NEIGHBORS = 15
UMAP_MIN_DIST    = 0.1

# HDBSCAN — same params as main analysis (isolates UMAP effect only)
HDBSCAN_MCS = 20
HDBSCAN_MS  = 10

# ── Load data ─────────────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df = df[df['abstract'].fillna('').str.strip() != ''].reset_index(drop=True)
print(f'  Papers with abstracts: {len(df)}')

domain_labels = df['Domain'].values

# ── Encode ────────────────────────────────────────────────────────────────────
print(f'Encoding with {MODEL_ID}...')
model = SentenceTransformer(MODEL_ID)
embeddings = model.encode(df['abstract'].tolist(), show_progress_bar=True,
                          batch_size=32, normalize_embeddings=True)
print(f'  Embeddings shape: {embeddings.shape}')

# ── UMAP with defaults (NO grid search, NO domain labels) ────────────────────
print(f'\nRunning UMAP with library defaults: n_neighbors={UMAP_N_NEIGHBORS}, min_dist={UMAP_MIN_DIST}')
reducer = umap.UMAP(n_neighbors=UMAP_N_NEIGHBORS, min_dist=UMAP_MIN_DIST,
                    metric='cosine', random_state=42)
coords = reducer.fit_transform(embeddings)
print(f'  2D projection shape: {coords.shape}')

# ── HDBSCAN (same params as main analysis — only UMAP is varied) ─────────────
print(f'\nRunning HDBSCAN: min_cluster_size={HDBSCAN_MCS}, min_samples={HDBSCAN_MS}')
hdb = HDBSCAN(min_cluster_size=HDBSCAN_MCS, min_samples=HDBSCAN_MS, metric='euclidean')
cluster_labels = hdb.fit_predict(coords)

n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
n_noise = (cluster_labels == -1).sum()
mask = cluster_labels != -1

print(f'  Clusters found: {n_clusters}')
print(f'  Noise points: {n_noise} ({100*n_noise/len(cluster_labels):.1f}%)')
print(f'  Clustered points: {mask.sum()}')

# ── Metrics (domain labels used ONLY here, for evaluation) ───────────────────
if n_clusters >= 2 and mask.sum() > n_clusters:
    sil = silhouette_score(coords[mask], cluster_labels[mask])
    ari = adjusted_rand_score(domain_labels[mask], cluster_labels[mask])
    nmi = normalized_mutual_info_score(domain_labels[mask], cluster_labels[mask])

    print(f'\n{"="*50}')
    print(f'RESULTS (UMAP defaults, no domain-label tuning)')
    print(f'{"="*50}')
    print(f'  Silhouette (on HDBSCAN labels): {sil:.4f}')
    print(f'  ARI (vs domain labels):         {ari:.4f}')
    print(f'  NMI (vs domain labels):         {nmi:.4f}')
    print(f'  Clusters: {n_clusters}')
    print(f'  Noise: {n_noise} ({100*n_noise/len(cluster_labels):.1f}%)')
    print(f'{"="*50}')
    print(f'  ARI > 0.3 = meaningful agreement')
    print(f'  NMI > 0.4 = meaningful agreement')
    if ari > 0.3 and nmi > 0.4:
        print(f'  --> PASS: clusters align with domains WITHOUT label-based tuning')
    elif ari > 0.2:
        print(f'  --> PARTIAL: moderate agreement, weaker than tuned version')
    else:
        print(f'  --> FAIL: clusters do not strongly align without tuning')

    # ── Domain-cluster overlap ────────────────────────────────────────────────
    print(f'\nDomain-Cluster overlap (clustered points only):')
    ct = pd.crosstab(domain_labels[mask], cluster_labels[mask], margins=True)
    print(ct.to_string())

    # Per-domain: which cluster captures most of that domain?
    print(f'\nPer-domain majority cluster:')
    for domain in sorted(set(domain_labels)):
        domain_mask = (domain_labels == domain) & mask
        if domain_mask.sum() == 0:
            continue
        domain_clusters = cluster_labels[domain_mask]
        majority_cluster = pd.Series(domain_clusters).mode()[0]
        # denominator = ALL papers in domain (incl. noise), matching the heatmap figure's convention
        all_domain_mask = domain_labels == domain
        majority_pct = (domain_clusters == majority_cluster).sum() / all_domain_mask.sum() * 100
        print(f'  {domain:45s} → Cluster {majority_cluster} ({majority_pct:.1f}% of domain, all-domain denominator)')

    # ── Robustness heatmap ─────────────────────────────────────────────────
    DOMAIN_ORDER = [
        'Health & Clinical AI',
        'LLMs & NLP',
        'General Fairness & Bias Mitigation',
        'Recommender Systems',
        'Graph-Based Fairness & Bias Mitigation',
    ]
    # Order clusters by size descending, Unclustered last
    cluster_ids_sorted = sorted(
        [c for c in set(cluster_labels) if c >= 0]
    )
    if -1 in set(cluster_labels):
        cluster_ids_sorted.append(-1)

    cluster_display = ['Unclustered' if c < 0 else f'Cluster {c+1}' for c in cluster_ids_sorted]

    matrix = np.zeros((len(DOMAIN_ORDER), len(cluster_ids_sorted)), dtype=int)
    for i in range(len(df)):
        dom = domain_labels[i]
        cid = cluster_labels[i]
        if dom in DOMAIN_ORDER and cid in cluster_ids_sorted:
            r = DOMAIN_ORDER.index(dom)
            c = cluster_ids_sorted.index(cid)
            matrix[r, c] += 1

    row_totals = matrix.sum(axis=1)

    fig, ax = plt.subplots(figsize=(11, 5))
    im = ax.imshow(matrix, cmap='Blues', aspect='auto')
    cbar = fig.colorbar(im, ax=ax, shrink=0.85)
    cbar.set_label('Number of papers', fontsize=13)

    ax.set_xticks(range(len(cluster_display)))
    ax.set_xticklabels(cluster_display, rotation=25, ha='right', fontsize=11)
    ax.set_yticks(range(len(DOMAIN_ORDER)))
    ax.set_yticklabels(DOMAIN_ORDER, fontsize=12)
    ax.set_xlabel(f'HDBSCAN Cluster (Default UMAP: n_neighbors={UMAP_N_NEIGHBORS}, min_dist={UMAP_MIN_DIST})',
                  fontsize=13, fontweight='bold')
    ax.set_ylabel('Domain', fontsize=15, fontweight='bold')
    ax.set_title(f'Domain × Cluster Co-occurrence — Robustness Check '
                 f'({n_clusters} clusters, ARI={ari:.2f}, NMI={nmi:.2f})',
                 fontsize=14, fontweight='bold')

    for r in range(len(DOMAIN_ORDER)):
        for c in range(len(cluster_ids_sorted)):
            val = matrix[r, c]
            if val == 0:
                continue
            pct = 100 * val / row_totals[r] if row_totals[r] > 0 else 0
            color = 'white' if val > matrix.max() * 0.55 else 'black'
            ax.text(c, r, f'{val}\n({pct:.1f}%)', ha='center', va='center',
                    fontsize=10, color=color)

    plt.tight_layout()
    out_dir = BASE_DIR / 'figures_new'
    out_dir.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_dir / 'robustness_heatmap.png', dpi=200, bbox_inches='tight')
    plt.savefig(out_dir / 'robustness_heatmap.pdf', dpi=200, bbox_inches='tight')
    print(f'\nSaved: robustness_heatmap.png + .pdf')

    # ── Export summary + domain-cluster crosstab to CSV (all-domain denominator) ──
    summary_rows = [
        {'metric': 'n_clusters', 'value': n_clusters},
        {'metric': 'n_noise', 'value': int(n_noise)},
        {'metric': 'noise_pct', 'value': round(100 * n_noise / len(cluster_labels), 2)},
        {'metric': 'clustering_silhouette', 'value': round(sil, 4)},
        {'metric': 'ARI_vs_domain', 'value': round(ari, 4)},
        {'metric': 'NMI_vs_domain', 'value': round(nmi, 4)},
        {'metric': 'umap_n_neighbors', 'value': UMAP_N_NEIGHBORS},
        {'metric': 'umap_min_dist', 'value': UMAP_MIN_DIST},
        {'metric': 'hdbscan_min_cluster_size', 'value': HDBSCAN_MCS},
        {'metric': 'hdbscan_min_samples', 'value': HDBSCAN_MS},
    ]
    pd.DataFrame(summary_rows).to_csv(out_dir / 'robustness_clustering_summary.csv', index=False)
    print(f"Saved: {out_dir / 'robustness_clustering_summary.csv'}")

    crosstab_rows = []
    for r, dom in enumerate(DOMAIN_ORDER):
        for c, cid in enumerate(cluster_ids_sorted):
            val = matrix[r, c]
            if val == 0:
                continue
            pct = 100 * val / row_totals[r] if row_totals[r] > 0 else 0
            crosstab_rows.append({'domain': dom, 'cluster': cid, 'count': int(val), 'pct_of_domain': round(pct, 1)})
    pd.DataFrame(crosstab_rows).to_csv(out_dir / 'robustness_domain_cluster_crosstab.csv', index=False)
    print(f"Saved: {out_dir / 'robustness_domain_cluster_crosstab.csv'}")

else:
    print(f'\n  Cannot compute metrics: only {n_clusters} cluster(s) found.')
