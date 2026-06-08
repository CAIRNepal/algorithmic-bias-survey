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

# HDBSCAN params — same as your paper
HDBSCAN_MCS = 10
HDBSCAN_MS  = 3

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

# ── HDBSCAN (same params as paper) ───────────────────────────────────────────
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
        majority_pct = (domain_clusters == majority_cluster).mean() * 100
        print(f'  {domain:45s} → Cluster {majority_cluster} ({majority_pct:.1f}% of domain)')
else:
    print(f'\n  Cannot compute metrics: only {n_clusters} cluster(s) found.')
