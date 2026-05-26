"""
Grid search over UMAP n_neighbors x min_dist using MPNet-base embeddings.
Ranks by silhouette score on 2D UMAP coords (domain labels).
Saves figures for top 5 combos.
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde
from sklearn.metrics import silhouette_score
from sentence_transformers import SentenceTransformer
import umap
import warnings
from pathlib import Path
from itertools import product

warnings.filterwarnings('ignore')

plt.rcParams.update({
    'font.size': 14,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300,
})

BASE_DIR = Path(__file__).resolve().parent
ENRICHED = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS   = BASE_DIR / 'papers_new.csv'
OUT_DIR  = BASE_DIR / 'figures_new' / 'umap_grid'
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = 'all-mpnet-base-v2'

N_NEIGHBORS_LIST = [5, 10, 15, 30, 50]
MIN_DIST_LIST    = [0.0, 0.05, 0.1, 0.2]

DOMAIN_COLORS = {
    'Health & Clinical AI':                     '#e63946',
    'General Fairness & Bias Mitigation':       '#457b9d',
    'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
    'LLMs & NLP':                               '#e9c46a',
    'Recommender Systems':                      '#f4a261',
}

# ── Load & embed once ─────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df = df[df['abstract'].fillna('').str.strip() != ''].reset_index(drop=True)
print(f'  Papers: {len(df)}')

print(f'Encoding with {MODEL_ID}...')
model = SentenceTransformer(MODEL_ID)
embeddings = model.encode(df['abstract'].tolist(), show_progress_bar=True,
                          batch_size=32, normalize_embeddings=True)
print(f'  Embeddings shape: {embeddings.shape}')

domain_labels = df['Domain'].values

# ── Grid search ───────────────────────────────────────────────────────────────
results = []
total = len(N_NEIGHBORS_LIST) * len(MIN_DIST_LIST)
i = 0

for n_neighbors, min_dist in product(N_NEIGHBORS_LIST, MIN_DIST_LIST):
    i += 1
    print(f'[{i:2d}/{total}] n_neighbors={n_neighbors:2d}  min_dist={min_dist}', end='  ')
    reducer = umap.UMAP(n_neighbors=n_neighbors, min_dist=min_dist,
                        metric='cosine', random_state=42)
    coords = reducer.fit_transform(embeddings)
    sil = silhouette_score(coords, domain_labels)
    print(f'silhouette={sil:.4f}')
    results.append({
        'n_neighbors': n_neighbors,
        'min_dist':    min_dist,
        'silhouette':  sil,
        'coords':      coords,
    })

# ── Rank & report ─────────────────────────────────────────────────────────────
results.sort(key=lambda r: r['silhouette'], reverse=True)

print(f'\n{"="*55}')
print(f'{"Rank":<5} {"n_neighbors":<13} {"min_dist":<10} {"silhouette":<10}')
print(f'{"="*55}')
for rank, r in enumerate(results, 1):
    print(f'{rank:<5} {r["n_neighbors"]:<13} {r["min_dist"]:<10} {r["silhouette"]:.4f}')

# ── Save figures for top 5 ────────────────────────────────────────────────────
def save_fig(r, rank):
    coords = r['coords']
    df['umap_x'] = coords[:, 0]
    df['umap_y'] = coords[:, 1]

    pad = 0.5
    xx, yy = np.mgrid[
        df['umap_x'].min() - pad : df['umap_x'].max() + pad : 200j,
        df['umap_y'].min() - pad : df['umap_y'].max() + pad : 200j,
    ]
    grid = np.vstack([xx.ravel(), yy.ravel()])

    fig, ax = plt.subplots(figsize=(12, 8))
    for domain, color in DOMAIN_COLORS.items():
        pts = df[df['Domain'] == domain][['umap_x', 'umap_y']].values
        if len(pts) < 10:
            continue
        try:
            kde   = gaussian_kde(pts.T, bw_method=0.35)
            z     = kde(grid).reshape(xx.shape)
            level = np.percentile(kde(pts.T), 25)
            ax.contourf(xx, yy, z, levels=[level, z.max()],
                        colors=[color], alpha=0.10, zorder=1)
            ax.contour(xx, yy, z, levels=[level],
                       colors=[color], alpha=0.55, linewidths=1.5, zorder=2)
        except Exception:
            pass
    for domain, color in DOMAIN_COLORS.items():
        sub = df[df['Domain'] == domain]
        ax.scatter(sub['umap_x'], sub['umap_y'], c=color, s=50, alpha=0.88,
                   linewidths=0.3, edgecolors='white', zorder=3, label=domain)

    ax.legend(loc='upper left', fontsize=11, framealpha=0.9,
              title='Domain', title_fontsize=12, markerscale=1.8)
    ax.set_title(
        f'Rank {rank}  |  n_neighbors={r["n_neighbors"]}  min_dist={r["min_dist"]}'
        f'  |  silhouette={r["silhouette"]:.4f}',
        fontsize=12, fontweight='bold'
    )
    ax.set_xlabel('UMAP Dimension 1', fontsize=13)
    ax.set_ylabel('UMAP Dimension 2', fontsize=13)
    ax.set_facecolor('#f8f9fa')
    fig.tight_layout()
    fname = f'rank{rank:02d}_nn{r["n_neighbors"]}_md{r["min_dist"]}.png'
    fig.savefig(OUT_DIR / fname, dpi=300, bbox_inches='tight')
    plt.close(fig)
    print(f'Saved: {fname}')

print(f'\nSaving figures for top 5...')
for rank, r in enumerate(results[:5], 1):
    save_fig(r, rank)

print(f'\nDone. Figures in: {OUT_DIR}')
print(f'Best config: n_neighbors={results[0]["n_neighbors"]}, min_dist={results[0]["min_dist"]}, silhouette={results[0]["silhouette"]:.4f}')
