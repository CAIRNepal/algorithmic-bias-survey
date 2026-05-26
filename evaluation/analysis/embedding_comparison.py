"""
Compare embedding models for domain separation quality.
Runs UMAP on each model's embeddings, computes intra/inter-domain cosine
similarity gap, and saves one UMAP plot per model + a summary ranking.
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import umap
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')

plt.rcParams.update({
    'font.size': 14,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300,
})

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
ENRICHED = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS   = BASE_DIR / 'papers_new.csv'
OUT_DIR  = BASE_DIR / 'figures_new' / 'embedding_comparison'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# (model_id, label, input_prefix, trust_remote_code)
# prefix=None means no prefix needed
MODELS = [
    ('all-MiniLM-L6-v2',          'MiniLM-L6 (baseline)',  None,             False),
    ('all-mpnet-base-v2',          'MPNet-base',            None,             False),
    ('allenai-specter',            'SPECTER',               None,             False),
    ('malteos/scincl',             'SciNCL',                None,             False),
    ('intfloat/e5-base-v2',        'E5-base-v2',            'passage: ',      False),
    ('BAAI/bge-base-en-v1.5',      'BGE-base',              None,             False),
    ('nomic-ai/nomic-embed-text-v1','Nomic-embed-text',     'search_document: ', True),
]

DOMAIN_COLORS = {
    'Health & Clinical AI':                     '#e63946',
    'General Fairness & Bias Mitigation':       '#457b9d',
    'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
    'LLMs & NLP':                               '#e9c46a',
    'Recommender Systems':                      '#f4a261',
}

UMAP_PARAMS = dict(n_neighbors=15, min_dist=0.0, metric='cosine', random_state=42)

# ── Load data ─────────────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df = df[df['abstract'].fillna('').str.strip() != ''].reset_index(drop=True)
print(f'  Papers with abstracts: {len(df)}')
abstracts = df['abstract'].tolist()

# ── Per-model separation score ────────────────────────────────────────────────
def mean_separation(embeddings, df):
    """Mean (intra - inter) cosine similarity gap across all domains."""
    gaps = []
    for domain in DOMAIN_COLORS:
        idx_in  = df[df['Domain'] == domain].index.tolist()
        idx_out = df[df['Domain'] != domain].index.tolist()
        if not idx_in or not idx_out:
            continue
        intra = cosine_similarity(embeddings[idx_in]).mean()
        inter = cosine_similarity(embeddings[idx_in], embeddings[idx_out]).mean()
        gaps.append(intra - inter)
    return np.mean(gaps), gaps

def make_umap_plot(coords, df, model_label, score, out_path):
    fig, ax = plt.subplots(figsize=(12, 8))
    pad = 0.5
    all_x = df['umap_x'].values
    all_y = df['umap_y'].values
    xx, yy = np.mgrid[
        all_x.min() - pad : all_x.max() + pad : 200j,
        all_y.min() - pad : all_y.max() + pad : 200j,
    ]
    grid = np.vstack([xx.ravel(), yy.ravel()])
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
    ax.set_title(f'{model_label}  |  mean separation gap = {score:.4f}',
                 fontsize=13, fontweight='bold')
    ax.set_xlabel('UMAP Dimension 1', fontsize=13)
    ax.set_ylabel('UMAP Dimension 2', fontsize=13)
    ax.set_facecolor('#f8f9fa')
    fig.tight_layout()
    fig.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close(fig)

# ── Run all models ────────────────────────────────────────────────────────────
results = []

for model_id, model_label, prefix, trust_remote in MODELS:
    print(f'\n{"="*60}')
    print(f'Model: {model_label} ({model_id})')
    print(f'{"="*60}')

    try:
        model = SentenceTransformer(model_id, trust_remote_code=trust_remote)
        inputs = [f'{prefix}{t}' for t in abstracts] if prefix else abstracts
        embeddings = model.encode(inputs, show_progress_bar=True, batch_size=32,
                                  normalize_embeddings=True)
        print(f'  Embeddings shape: {embeddings.shape}')

        reducer = umap.UMAP(**UMAP_PARAMS)
        coords  = reducer.fit_transform(embeddings)
        df['umap_x'] = coords[:, 0]
        df['umap_y'] = coords[:, 1]

        score, per_domain = mean_separation(embeddings, df)
        print(f'  Mean separation gap: {score:.4f}')
        for domain, gap in zip(DOMAIN_COLORS.keys(), per_domain):
            print(f'    {domain[:42]:42s}  gap={gap:.4f}')

        safe_name = model_id.replace('/', '_')
        out_path = OUT_DIR / f'umap_{safe_name}.png'
        make_umap_plot(coords, df, model_label, score, out_path)
        print(f'  Saved: {out_path.name}')

        results.append({'model_id': model_id, 'label': model_label,
                        'score': score, 'figure': out_path.name})

    except Exception as e:
        print(f'  ERROR: {e}')
        results.append({'model_id': model_id, 'label': model_label,
                        'score': float('nan'), 'figure': None})

# ── Summary ───────────────────────────────────────────────────────────────────
print(f'\n{"="*60}')
print('RANKING (by mean intra-inter cosine similarity gap)')
print(f'{"="*60}')
results.sort(key=lambda r: r['score'] if not np.isnan(r['score']) else -1, reverse=True)
for i, r in enumerate(results, 1):
    score_str = f"{r['score']:.4f}" if not np.isnan(r['score']) else 'FAILED'
    print(f'  {i}. {r["label"]:25s}  score={score_str}')

print(f'\nBest model: {results[0]["label"]} ({results[0]["model_id"]})')
print(f'Figures saved to: {OUT_DIR}')
