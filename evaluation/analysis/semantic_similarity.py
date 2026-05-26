import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from scipy.stats import gaussian_kde
import warnings
from pathlib import Path
from sentence_transformers import SentenceTransformer
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

for model_id, key, prefix in MODELS:
    print(f'\nLoading model: {model_id}')
    m = SentenceTransformer(model_id)
    inputs = df['abstract'].tolist()
    emb = m.encode(inputs, show_progress_bar=True, batch_size=32, normalize_embeddings=True)
    print(f'  Embeddings shape: {emb.shape}')
    all_embeddings[key] = emb

    print(f'  Running UMAP (n_neighbors=15, min_dist=0.0)...')
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.0, metric='cosine', random_state=42)
    coords  = reducer.fit_transform(emb)
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

# ── Figure ────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(14, 10))

# KDE contour grid — cover full data range with padding
pad = 0.5
all_x = df['umap_x'].values
all_y = df['umap_y'].values
xx, yy = np.mgrid[
    all_x.min() - pad : all_x.max() + pad : 200j,
    all_y.min() - pad : all_y.max() + pad : 200j,
]
grid = np.vstack([xx.ravel(), yy.ravel()])

# Draw KDE contour per domain (encloses ~75% of each domain's density mass)
for domain, color in DOMAIN_COLORS.items():
    pts = df[df['Domain'] == domain][['umap_x', 'umap_y']].values
    if len(pts) < 10:
        continue
    try:
        kde  = gaussian_kde(pts.T, bw_method=0.35)
        z    = kde(grid).reshape(xx.shape)
        # Level at the 25th percentile of KDE values at data points → encloses ~75% of mass
        level = np.percentile(kde(pts.T), 25)
        ax.contourf(xx, yy, z, levels=[level, z.max()],
                    colors=[color], alpha=0.10, zorder=1)
        ax.contour(xx, yy, z, levels=[level],
                   colors=[color], alpha=0.55, linewidths=1.5, zorder=2)
    except Exception:
        pass

# Scatter points per domain
for domain, color in DOMAIN_COLORS.items():
    sub = df[df['Domain'] == domain]
    ax.scatter(sub['umap_x'], sub['umap_y'],
               c=color, s=55, alpha=0.90, linewidths=0.3,
               edgecolors='white', zorder=3, label=domain)

# Legend
ax.legend(loc='upper left', fontsize=13, framealpha=0.9,
          title='Domain', title_fontsize=14, markerscale=2.2)

# ax.set_title(
#     'Semantic Landscape of AI Bias Research\n'
#     'UMAP projection of SBERT abstract embeddings',
#     fontsize=16, fontweight='bold', pad=14
# )
ax.set_xlabel('UMAP Dimension 1', fontsize=14)
ax.set_ylabel('UMAP Dimension 2', fontsize=14)
ax.tick_params(labelsize=12)
ax.set_facecolor('#f8f9fa')
fig.tight_layout()
fig.savefig(OUT_FIG, dpi=300, bbox_inches='tight')
print(f'Saved figure: {OUT_FIG}')

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
