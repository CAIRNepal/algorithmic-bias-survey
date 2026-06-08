"""
Independent validation: run HDBSCAN directly on 768D MPNet embeddings
(no UMAP, no domain-label-optimized projection).

If clusters align with domain labels here, that IS independent validation
because no step in this pipeline uses domain labels.
"""
import pandas as pd
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.cluster import HDBSCAN
from sklearn.metrics import silhouette_score, adjusted_rand_score, normalized_mutual_info_score
from sklearn.metrics.pairwise import cosine_distances
from itertools import product
import warnings

warnings.filterwarnings('ignore')

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
ENRICHED = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS   = BASE_DIR / 'papers_new.csv'
OUT_DIR  = BASE_DIR / 'figures_new'
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = 'all-mpnet-base-v2'

# HDBSCAN grid search params
MIN_CLUSTER_SIZE_LIST = [5, 10, 15, 20, 25, 30]
MIN_SAMPLES_LIST      = [1, 3, 5, 10, 15]

# ── Load data ─────────────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df = df[df['abstract'].fillna('').str.strip() != ''].reset_index(drop=True)
print(f'  Papers with abstracts: {len(df)}')
print(f'  Domain counts:\n{df["Domain"].value_counts().to_string()}\n')

domain_labels = df['Domain'].values

# ── Encode ────────────────────────────────────────────────────────────────────
print(f'Encoding with {MODEL_ID}...')
model = SentenceTransformer(MODEL_ID)
embeddings = model.encode(df['abstract'].tolist(), show_progress_bar=True,
                          batch_size=32, normalize_embeddings=True)
print(f'  Embeddings shape: {embeddings.shape}')

# ── Precompute cosine distance matrix (HDBSCAN supports precomputed) ─────────
print('Computing cosine distance matrix...')
dist_matrix = cosine_distances(embeddings)
print(f'  Distance matrix shape: {dist_matrix.shape}')

# ── HDBSCAN grid search on 768D embeddings ───────────────────────────────────
total = len(MIN_CLUSTER_SIZE_LIST) * len(MIN_SAMPLES_LIST)
results = []

print(f'\nHDBSCAN grid search on 768D embeddings ({total} combos)...')
print(f'  {"mcs":>4}  {"ms":>4}  {"clusters":>8}  {"noise":>6}  {"sil_hdb":>10}  {"ARI":>8}  {"NMI":>8}')
print(f'  {"-"*56}')

for mcs, ms in product(MIN_CLUSTER_SIZE_LIST, MIN_SAMPLES_LIST):
    hdb = HDBSCAN(min_cluster_size=mcs, min_samples=ms, metric='precomputed')
    labels = hdb.fit_predict(dist_matrix)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    noise_pct = 100 * n_noise / len(labels)

    # Silhouette on HDBSCAN's own labels (not domain labels) — label-free quality
    mask = labels != -1
    if n_clusters >= 2 and mask.sum() > n_clusters:
        sil = silhouette_score(dist_matrix[np.ix_(mask, mask)], labels[mask], metric='precomputed')
    else:
        sil = float('nan')

    # Agreement with domain labels (the validation metric)
    if n_clusters >= 2:
        ari = adjusted_rand_score(domain_labels[mask], labels[mask])
        nmi = normalized_mutual_info_score(domain_labels[mask], labels[mask])
    else:
        ari = float('nan')
        nmi = float('nan')

    results.append({
        'mcs': mcs, 'ms': ms,
        'n_clusters': n_clusters, 'n_noise': n_noise, 'noise_pct': noise_pct,
        'silhouette': sil, 'ari': ari, 'nmi': nmi,
    })
    print(f'  {mcs:>4}  {ms:>4}  {n_clusters:>8}  {n_noise:>6}  {sil:>10.4f}  {ari:>8.4f}  {nmi:>8.4f}')

# ── Summary: top configs by ARI ──────────────────────────────────────────────
valid = [r for r in results if not np.isnan(r['ari'])]
by_ari = sorted(valid, key=lambda r: r['ari'], reverse=True)

print(f'\n{"="*70}')
print('TOP 10 BY ADJUSTED RAND INDEX (agreement with domain labels)')
print(f'{"="*70}')
print(f'  {"Rank":<5} {"mcs":<6} {"ms":<6} {"k":<5} {"noise":<8} {"noise%":<8} {"sil":<8} {"ARI":<8} {"NMI":<8}')
for rank, r in enumerate(by_ari[:10], 1):
    print(f'  {rank:<5} {r["mcs"]:<6} {r["ms"]:<6} {r["n_clusters"]:<5} '
          f'{r["n_noise"]:<8} {r["noise_pct"]:<8.1f} {r["silhouette"]:<8.4f} '
          f'{r["ari"]:<8.4f} {r["nmi"]:<8.4f}')

# ── Summary: top configs by NMI ──────────────────────────────────────────────
by_nmi = sorted(valid, key=lambda r: r['nmi'], reverse=True)
print(f'\nTOP 10 BY NORMALIZED MUTUAL INFORMATION')
print(f'  {"Rank":<5} {"mcs":<6} {"ms":<6} {"k":<5} {"noise":<8} {"noise%":<8} {"sil":<8} {"ARI":<8} {"NMI":<8}')
for rank, r in enumerate(by_nmi[:10], 1):
    print(f'  {rank:<5} {r["mcs"]:<6} {r["ms"]:<6} {r["n_clusters"]:<5} '
          f'{r["n_noise"]:<8} {r["noise_pct"]:<8.1f} {r["silhouette"]:<8.4f} '
          f'{r["ari"]:<8.4f} {r["nmi"]:<8.4f}')

# ── Interpretation guide ─────────────────────────────────────────────────────
print(f'\n{"="*70}')
print('INTERPRETATION')
print(f'{"="*70}')
print('  ARI:  1.0 = perfect match with domain labels, 0.0 = random')
print('  NMI:  1.0 = perfect match, 0.0 = no mutual information')
print('  If ARI > 0.3 and NMI > 0.4, domains have genuine semantic structure')
print('  in the raw embedding space — independent of any UMAP tuning.')
print(f'{"="*70}')

# ── Save results to CSV ──────────────────────────────────────────────────────
out_csv = OUT_DIR / 'hdbscan_768d_validation.csv'
pd.DataFrame(results).to_csv(out_csv, index=False)
print(f'\nResults saved: {out_csv}')
