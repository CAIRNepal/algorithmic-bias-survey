import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from scipy.spatial import ConvexHull
import warnings
from pathlib import Path
from sentence_transformers import SentenceTransformer
import umap

warnings.filterwarnings('ignore')

plt.rcParams.update({
    'font.size': 11,
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
OUT_CSV    = BASE_DIR / 'semantic_similarity_results.csv'
MODEL_NAME = 'all-MiniLM-L6-v2'

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

# ── Embed ─────────────────────────────────────────────────────────────────────
print(f'\nLoading SBERT model ({MODEL_NAME})...')
model = SentenceTransformer(MODEL_NAME)
print('Encoding abstracts...')
embeddings = model.encode(df['abstract'].tolist(), show_progress_bar=True, batch_size=64)
print(f'  Embeddings shape: {embeddings.shape}')

# ── UMAP ─────────────────────────────────────────────────────────────────────
print('\nRunning UMAP...')
reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, metric='cosine', random_state=42)
coords = reducer.fit_transform(embeddings)
df['umap_x'] = coords[:, 0]
df['umap_y'] = coords[:, 1]

# ── Save results CSV ──────────────────────────────────────────────────────────
df[['SN', 'Paper Title', 'DOI', 'Domain', 'Year', 'umap_x', 'umap_y',
    'cited_by_count', 'is_oa', 'oa_status', 'oa_url']].to_csv(OUT_CSV, index=False)
print(f'\nSaved results: {OUT_CSV}')

# ── Figure ────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 9))

# Draw convex hull per domain (background, semi-transparent)
for domain, color in DOMAIN_COLORS.items():
    pts = df[df['Domain'] == domain][['umap_x', 'umap_y']].values
    if len(pts) >= 4:
        try:
            hull = ConvexHull(pts)
            hull_pts = np.append(hull.vertices, hull.vertices[0])
            ax.fill(pts[hull_pts, 0], pts[hull_pts, 1],
                    alpha=0.07, color=color, zorder=1)
            ax.plot(pts[hull_pts, 0], pts[hull_pts, 1],
                    alpha=0.25, color=color, linewidth=0.8, zorder=2)
        except Exception:
            pass

# Scatter points per domain
for domain, color in DOMAIN_COLORS.items():
    sub = df[df['Domain'] == domain]
    ax.scatter(sub['umap_x'], sub['umap_y'],
               c=color, s=20, alpha=0.80, linewidths=0, zorder=3, label=domain)

# Legend
ax.legend(loc='lower right', fontsize=8, framealpha=0.9,
          title='Domain', title_fontsize=9, markerscale=1.4)

ax.set_title(
    'Semantic Landscape of AI Bias Research\n'
    'UMAP projection of SBERT abstract embeddings',
    fontsize=13, fontweight='bold', pad=12
)
ax.set_xlabel('UMAP Dimension 1', fontsize=10)
ax.set_ylabel('UMAP Dimension 2', fontsize=10)
ax.set_facecolor('#f8f9fa')
fig.tight_layout()
fig.savefig(OUT_FIG, dpi=180, bbox_inches='tight')
print(f'Saved figure: {OUT_FIG}')

# ── Domain overlap analysis ───────────────────────────────────────────────────
# For each paper, find its nearest neighbour from a different domain
from sklearn.metrics.pairwise import cosine_similarity

print('\n=== Domain separation (mean intra- vs inter-domain cosine similarity) ===')
emb_df = pd.DataFrame(embeddings, index=df.index)
for domain in DOMAIN_COLORS:
    idx_in  = df[df['Domain'] == domain].index.tolist()
    idx_out = df[df['Domain'] != domain].index.tolist()
    if not idx_in or not idx_out:
        continue
    intra = cosine_similarity(embeddings[idx_in]).mean()
    inter = cosine_similarity(embeddings[idx_in], embeddings[idx_out]).mean()
    print(f'  {domain[:40]:40s}  intra={intra:.3f}  inter={inter:.3f}  diff={intra-inter:.3f}')

print('\n=== Top cited paper per domain ===')
for domain in DOMAIN_COLORS:
    sub = df[df['Domain'] == domain].sort_values('cited_by_count', ascending=False)
    if len(sub):
        top = sub.iloc[0]
        print(f'  {domain[:35]:35s}: {str(top["Paper Title"])[:55]} — {top["cited_by_count"]} citations')
