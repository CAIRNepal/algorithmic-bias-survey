import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

import warnings
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics import silhouette_score
from itertools import product
import umap

warnings.filterwarnings('ignore')

plt.rcParams.update({
    'font.size': 14,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300,
})

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent
ENRICHED   = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS     = BASE_DIR / 'papers_new.csv'
OUT_DIR    = BASE_DIR / 'figures_new'
OUT_FIG    = OUT_DIR / 'semantic_landscape.png'
OUT_CSV        = BASE_DIR / 'semantic_similarity_results.csv'
DASHBOARD_CSV  = BASE_DIR.parent.parent / 'dashboard' / 'public' / 'semantic_clusters.csv'
MODELS = [
    ('all-MiniLM-L6-v2', 'minilm',  None),
    ('all-mpnet-base-v2', 'mpnet',   None),
    ('allenai-specter',   'specter', None),
]

# UMAP grid search params
N_NEIGHBORS_LIST = [5, 10, 15, 30, 50]
MIN_DIST_LIST    = [0.0, 0.05, 0.1, 0.2]

# HDBSCAN grid search params (run on MPNet best coords)
HDBSCAN_MIN_CLUSTER_SIZE_LIST = [5, 10, 15, 20, 25]
HDBSCAN_MIN_SAMPLES_LIST      = [1, 3, 5, 10]

OUT_DIR.mkdir(parents=True, exist_ok=True)

DOMAIN_COLORS = {
    'Health & Clinical AI':                     '#e63946',
    'General Fairness & Bias Mitigation':       '#457b9d',
    'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
    'LLMs & NLP':                               '#e9c46a',
    'Recommender Systems':                      '#f4a261',
}

# ── Load & merge ──────────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df = df[df['abstract'].fillna('').str.strip() != ''].reset_index(drop=True)
print(f'  Papers with abstracts: {len(df)}')
print(f'  Domain counts: {df["Domain"].value_counts().to_dict()}')

# ── Embed + UMAP for each model ───────────────────────────────────────────────
all_embeddings = {}  # key -> np array (for domain separation stats)
all_silhouettes = {}  # key -> silhouette score at best params
all_grid_results = {}  # key -> full grid results list
domain_labels = df['Domain'].values

for model_id, key, prefix in MODELS:
    print(f'\nLoading model: {model_id}')
    m = SentenceTransformer(model_id)
    inputs = df['abstract'].tolist()
    emb = m.encode(inputs, show_progress_bar=True, batch_size=32, normalize_embeddings=True)
    print(f'  Embeddings shape: {emb.shape}')
    all_embeddings[key] = emb

    # ── Grid search over n_neighbors x min_dist ──────────────────────────────
    print(f'  Grid search (n_neighbors x min_dist) for {key}...')
    grid_results = []
    total = len(N_NEIGHBORS_LIST) * len(MIN_DIST_LIST)
    for i, (nn, md) in enumerate(product(N_NEIGHBORS_LIST, MIN_DIST_LIST), 1):
        r = umap.UMAP(n_neighbors=nn, min_dist=md, metric='cosine', random_state=42)
        c = r.fit_transform(emb)
        sil = silhouette_score(c, domain_labels)
        grid_results.append({'n_neighbors': nn, 'min_dist': md, 'silhouette': sil, 'coords': c})
        print(f'    [{i:2d}/{total}] n_neighbors={nn:2d}  min_dist={md}  silhouette={sil:.4f}')
    grid_results.sort(key=lambda r: r['silhouette'], reverse=True)
    best = grid_results[0]
    print(f'  Best: n_neighbors={best["n_neighbors"]}, min_dist={best["min_dist"]}, silhouette={best["silhouette"]:.4f}')

    # Print full ranking
    print(f'  {"Rank":<5} {"n_neighbors":<13} {"min_dist":<10} {"silhouette"}')
    for rank, r in enumerate(grid_results, 1):
        print(f'  {rank:<5} {r["n_neighbors"]:<13} {r["min_dist"]:<10} {r["silhouette"]:.4f}')

    coords = best['coords']
    all_silhouettes[key] = best['silhouette']
    all_grid_results[key] = grid_results
    df[f'umap_x_{key}'] = coords[:, 0]
    df[f'umap_y_{key}'] = coords[:, 1]

# Use mpnet as the default display coords
df['umap_x'] = df['umap_x_mpnet']
df['umap_y'] = df['umap_y_mpnet']

# ── Save results CSV ──────────────────────────────────────────────────────────
coord_cols = [c for m in MODELS for c in (f'umap_x_{m[1]}', f'umap_y_{m[1]}')]
out = df[['SN', 'Paper Title', 'DOI', 'Domain', 'Year',
          'umap_x', 'umap_y', *coord_cols,
          'cited_by_count', 'is_oa', 'oa_status', 'oa_url']]
out.to_csv(OUT_CSV, index=False)
out.to_csv(DASHBOARD_CSV, index=False)
print(f'\nSaved results: {OUT_CSV}')
print(f'Saved dashboard: {DASHBOARD_CSV}')

# ── Figure (one per model) ────────────────────────────────────────────────────
MODEL_LABELS = {'minilm': 'MiniLM-L6', 'mpnet': 'MPNet-base', 'specter': 'SPECTER'}

for _, key, _ in MODELS:
    fig, ax = plt.subplots(figsize=(14, 10))
    xk, yk = f'umap_x_{key}', f'umap_y_{key}'
    for domain, color in DOMAIN_COLORS.items():
        sub = df[df['Domain'] == domain]
        ax.scatter(sub[xk], sub[yk],
                   c=color, s=55, alpha=0.90, linewidths=0.3,
                   edgecolors='white', zorder=3, label=domain)
    leg = ax.legend(loc='upper left', fontsize=13, framealpha=0.9,
                    title='Domain', title_fontsize=14, markerscale=2.2)
    ax.set_xlabel('UMAP Dimension 1', fontsize=14)
    ax.set_ylabel('UMAP Dimension 2', fontsize=14)
    ax.tick_params(labelsize=12)
    ax.set_facecolor('#f8f9fa')
    fig.tight_layout()
    # Place silhouette score box directly below the legend
    fig.canvas.draw()
    sil = all_silhouettes[key]
    leg_bb = leg.get_window_extent(fig.canvas.get_renderer())
    leg_bb_ax = leg_bb.transformed(ax.transAxes.inverted())
    ax.text(leg_bb_ax.x0, leg_bb_ax.y0 - 0.02, f'Silhouette: {sil:.4f}',
            transform=ax.transAxes, fontsize=14, ha='left', va='top',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#cccccc', alpha=0.9))
    out_path = OUT_DIR / f'semantic_landscape_{key}.png'
    fig.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close(fig)
    print(f'Saved figure: {out_path}')

# Also save default (mpnet) to original path for backwards compat
import shutil
shutil.copy(OUT_DIR / 'semantic_landscape_mpnet.png', OUT_FIG)
print(f'Copied mpnet → {OUT_FIG}')

# ── Grid search heatmap (one subplot per model) ───────────────────────────────
fig_gs, axes_gs = plt.subplots(1, 3, figsize=(18, 5))
for ax_gs, (_, key, _) in zip(axes_gs, MODELS):
    results = all_grid_results[key]
    # Build matrix: rows=n_neighbors, cols=min_dist
    matrix = np.zeros((len(N_NEIGHBORS_LIST), len(MIN_DIST_LIST)))
    for r in results:
        ri = N_NEIGHBORS_LIST.index(r['n_neighbors'])
        ci = MIN_DIST_LIST.index(r['min_dist'])
        matrix[ri, ci] = r['silhouette']
    im = ax_gs.imshow(matrix, aspect='auto', cmap='YlGnBu',
                      vmin=matrix.min(), vmax=matrix.max())
    ax_gs.set_xticks(range(len(MIN_DIST_LIST)))
    ax_gs.set_xticklabels(MIN_DIST_LIST, fontsize=14)
    ax_gs.set_yticks(range(len(N_NEIGHBORS_LIST)))
    ax_gs.set_yticklabels(N_NEIGHBORS_LIST, fontsize=14)
    ax_gs.set_xlabel('min_dist', fontsize=15)
    ax_gs.set_ylabel('n_neighbors', fontsize=15)
    ax_gs.set_title(f'{MODEL_LABELS[key]}\nbest sil={all_silhouettes[key]:.4f}', fontsize=16, fontweight='bold')
    for ri in range(len(N_NEIGHBORS_LIST)):
        for ci in range(len(MIN_DIST_LIST)):
            ax_gs.text(ci, ri, f'{matrix[ri, ci]:.3f}', ha='center', va='center',
                       fontsize=12, color='black' if matrix[ri, ci] < 0.85 * matrix.max() else 'white')
    fig_gs.colorbar(im, ax=ax_gs, shrink=0.8, label='Silhouette')
fig_gs.suptitle('UMAP Grid Search — Silhouette Score by Model (domain labels)', fontsize=14, fontweight='bold')
fig_gs.tight_layout()
grid_path = OUT_DIR / 'umap_grid_search_silhouette.png'
fig_gs.savefig(grid_path, dpi=300, bbox_inches='tight')
plt.close(fig_gs)
print(f'Saved grid search heatmap: {grid_path}')

# ── HDBSCAN grid search (on MPNet best coords) ────────────────────────────────
from sklearn.cluster import HDBSCAN

mpnet_coords = np.column_stack([df['umap_x_mpnet'].values, df['umap_y_mpnet'].values])
total_hdb = len(HDBSCAN_MIN_CLUSTER_SIZE_LIST) * len(HDBSCAN_MIN_SAMPLES_LIST)
hdb_results = []

print(f'\nHDBSCAN grid search ({total_hdb} combos on MPNet coords)...')
print(f'  {"mcs":>4}  {"ms":>4}  {"clusters":>8}  {"noise":>6}  {"silhouette":>10}')
for mcs, ms in product(HDBSCAN_MIN_CLUSTER_SIZE_LIST, HDBSCAN_MIN_SAMPLES_LIST):
    hdb = HDBSCAN(min_cluster_size=mcs, min_samples=ms, metric='euclidean')
    labels = hdb.fit_predict(mpnet_coords)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    # silhouette only on non-noise points, requires >=2 clusters
    mask = labels != -1
    if n_clusters >= 2 and mask.sum() > n_clusters:
        sil = silhouette_score(mpnet_coords[mask], labels[mask])
    else:
        sil = float('nan')
    hdb_results.append({'mcs': mcs, 'ms': ms, 'n_clusters': n_clusters, 'n_noise': n_noise, 'silhouette': sil})
    print(f'  {mcs:>4}  {ms:>4}  {n_clusters:>8}  {n_noise:>6}  {sil:>10.4f}')

# Sort by silhouette descending
hdb_results_sorted = sorted([r for r in hdb_results if not np.isnan(r['silhouette'])],
                             key=lambda r: r['silhouette'], reverse=True)
print(f'\n  Top 5 by silhouette:')
print(f'  {"Rank":<5} {"mcs":<6} {"ms":<6} {"clusters":<10} {"noise":<8} {"silhouette"}')
for rank, r in enumerate(hdb_results_sorted[:5], 1):
    print(f'  {rank:<5} {r["mcs"]:<6} {r["ms"]:<6} {r["n_clusters"]:<10} {r["n_noise"]:<8} {r["silhouette"]:.4f}')

# ── HDBSCAN heatmaps: silhouette + noise count ─────────────────────────────────
fig_hdb, axes_hdb = plt.subplots(1, 2, figsize=(14, 5))

for ax_hdb, metric, label, fmt in zip(
    axes_hdb,
    ['silhouette', 'n_noise'],
    ['Silhouette Score', 'Noise Points'],
    ['.3f', 'd'],
):
    matrix = np.full((len(HDBSCAN_MIN_CLUSTER_SIZE_LIST), len(HDBSCAN_MIN_SAMPLES_LIST)), np.nan)
    for r in hdb_results:
        ri = HDBSCAN_MIN_CLUSTER_SIZE_LIST.index(r['mcs'])
        ci = HDBSCAN_MIN_SAMPLES_LIST.index(r['ms'])
        matrix[ri, ci] = r[metric]
    im = ax_hdb.imshow(matrix, aspect='auto',
                       cmap='YlGnBu' if metric == 'silhouette' else 'YlOrRd_r',
                       vmin=np.nanmin(matrix), vmax=np.nanmax(matrix))
    ax_hdb.set_xticks(range(len(HDBSCAN_MIN_SAMPLES_LIST)))
    ax_hdb.set_xticklabels(HDBSCAN_MIN_SAMPLES_LIST, fontsize=14)
    ax_hdb.set_yticks(range(len(HDBSCAN_MIN_CLUSTER_SIZE_LIST)))
    ax_hdb.set_yticklabels(HDBSCAN_MIN_CLUSTER_SIZE_LIST, fontsize=14)
    ax_hdb.set_xlabel('min_samples', fontsize=15)
    ax_hdb.set_ylabel('min_cluster_size', fontsize=15)
    ax_hdb.set_title(label, fontsize=16, fontweight='bold')
    for ri in range(len(HDBSCAN_MIN_CLUSTER_SIZE_LIST)):
        for ci in range(len(HDBSCAN_MIN_SAMPLES_LIST)):
            val = matrix[ri, ci]
            if not np.isnan(val):
                txt = f'{int(val)}' if fmt == 'd' else f'{val:.3f}'
                ax_hdb.text(ci, ri, txt, ha='center', va='center', fontsize=12,
                            color='black' if val < 0.85 * np.nanmax(matrix) else 'white')
    fig_hdb.colorbar(im, ax=ax_hdb, shrink=0.8, label=label)

fig_hdb.suptitle('HDBSCAN Grid Search — MPNet 2D Coords (n_neighbors=10, min_dist=0.0)',
                 fontsize=14, fontweight='bold')
fig_hdb.tight_layout()
hdb_path = OUT_DIR / 'hdbscan_grid_search.png'
fig_hdb.savefig(hdb_path, dpi=300, bbox_inches='tight')
plt.close(fig_hdb)
print(f'\nSaved HDBSCAN grid search heatmap: {hdb_path}')

# ── Cluster selection (elbow + silhouette) ───────────────────────────────────
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

print('\nRunning cluster selection (k=3..13)...')
ks, inertias, sils = [], [], []
for k in range(3, 14):
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(coords)
    ks.append(k)
    inertias.append(km.inertia_)
    sils.append(silhouette_score(coords, labels))

fig2, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
ax1.plot(ks, inertias, 'o-', color='#457b9d', linewidth=2, markersize=7)
ax1.axvline(x=8, color='#e63946', linestyle='--', label='k=8')
ax1.set_xlabel('k', fontsize=14)
ax1.set_ylabel('Inertia', fontsize=14)
ax1.set_title('Elbow Method', fontsize=15, fontweight='bold')
ax1.tick_params(labelsize=12)
ax1.legend(fontsize=12)

ax2.plot(ks, sils, 'o-', color='#2a9d8f', linewidth=2, markersize=7)
ax2.axvline(x=8, color='#e63946', linestyle='--', label='k=8')
ax2.set_xlabel('k', fontsize=14)
ax2.set_ylabel('Silhouette Score', fontsize=14)
ax2.set_title('Silhouette Score', fontsize=15, fontweight='bold')
ax2.tick_params(labelsize=12)
ax2.legend(fontsize=12)

fig2.tight_layout()
fig2.savefig(OUT_DIR / 'cluster_selection.png', dpi=300, bbox_inches='tight')
plt.close(fig2)
print('Saved figure: cluster_selection.png')

# ── Domain overlap analysis ───────────────────────────────────────────────────
# For each paper, find its nearest neighbour from a different domain
from sklearn.metrics.pairwise import cosine_similarity

print('\n=== Domain separation (mean intra- vs inter-domain cosine similarity) ===')
for model_id, key, _ in MODELS:
    emb = all_embeddings[key]
    print(f'\n  [{key}]')
    for domain in DOMAIN_COLORS:
        idx_in  = df[df['Domain'] == domain].index.tolist()
        idx_out = df[df['Domain'] != domain].index.tolist()
        if not idx_in or not idx_out:
            continue
        intra = cosine_similarity(emb[idx_in]).mean()
        inter = cosine_similarity(emb[idx_in], emb[idx_out]).mean()
        print(f'  {domain[:40]:40s}  intra={intra:.3f}  inter={inter:.3f}  diff={intra-inter:.3f}')

print('\n=== Top cited paper per domain ===')
for domain in DOMAIN_COLORS:
    sub = df[df['Domain'] == domain].sort_values('cited_by_count', ascending=False)
    if len(sub):
        top = sub.iloc[0]
        print(f'  {domain[:35]:35s}: {str(top["Paper Title"])[:55]} — {top["cited_by_count"]} citations')
