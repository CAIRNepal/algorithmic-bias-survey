import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from collections import defaultdict
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')

plt.rcParams.update({
    'font.size': 11,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300,
})

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).resolve().parent
ENRICHED  = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS    = BASE_DIR / 'papers_new.csv'
OUT_DIR   = BASE_DIR / 'figures_new'
OUT_DIR.mkdir(parents=True, exist_ok=True)

DOMAIN_COLORS = {
    'Health & Clinical AI':                     '#e63946',
    'General Fairness & Bias Mitigation':       '#457b9d',
    'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
    'LLMs & NLP':                               '#e9c46a',
    'Recommender Systems':                      '#f4a261',
}

# ── Load ───────────────────────────────────────────────────────────────────────
print('Loading data...')
enriched = pd.read_csv(ENRICHED)
corpus   = pd.read_csv(CORPUS)
df = enriched.merge(corpus[['SN', 'Paper Title', 'DOI', 'Domain', 'Year']], on='SN', how='left')
df['cited_by_count'] = pd.to_numeric(df['cited_by_count'], errors='coerce').fillna(0).astype(int)
df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
print(f'  {len(df)} papers loaded')
print(f'  Year range: {int(df["Year"].min())} – {int(df["Year"].max())}')

# ── 1. EXTERNAL: Publication growth over time ──────────────────────────────────
print('\n=== Publication trend ===')
year_domain = df.groupby(['Year', 'Domain']).size().unstack(fill_value=0)
year_domain = year_domain[[d for d in DOMAIN_COLORS if d in year_domain.columns]]
year_domain = year_domain[year_domain.index >= 2015]

fig, ax = plt.subplots(figsize=(12, 5))
bottom = np.zeros(len(year_domain))
for domain in year_domain.columns:
    vals = year_domain[domain].values
    bars = ax.bar(year_domain.index, vals, bottom=bottom,
                  color=DOMAIN_COLORS[domain], label=domain, alpha=0.88)
    # Label each segment if tall enough
    for bar, v, b in zip(bars, vals, bottom):
        if v >= 5:
            ax.text(bar.get_x() + bar.get_width()/2, b + v/2,
                    str(int(v)), ha='center', va='center', fontsize=6.5, color='white', fontweight='bold')
    bottom += vals

# Total on top of each bar
totals = year_domain.sum(axis=1)
for x, total in zip(year_domain.index, totals):
    ax.text(x, total + 1, str(int(total)), ha='center', va='bottom', fontsize=7.5, fontweight='bold')

ax.set_xlabel('Year', fontsize=10)
ax.set_ylabel('Number of papers', fontsize=10)
ax.set_title('Publication Growth by Domain (2015–2026)', fontsize=13, fontweight='bold', pad=10)
ax.set_xticks(year_domain.index)
ax.tick_params(axis='x', rotation=45)
ax.legend(fontsize=8, loc='upper left', framealpha=0.9)
fig.tight_layout()
fig.savefig(OUT_DIR / 'citation_publication_growth.png', bbox_inches='tight')
plt.close()
print('  Saved: citation_publication_growth.png')

# ── 2. EXTERNAL: Citation distribution by domain ───────────────────────────────
print('\n=== Citation distribution by domain ===')
fig, ax = plt.subplots(figsize=(10, 5))
domains_ordered = sorted(DOMAIN_COLORS.keys(),
                         key=lambda d: df[df['Domain']==d]['cited_by_count'].median(),
                         reverse=True)
data   = [df[df['Domain']==d]['cited_by_count'].values for d in domains_ordered]
colors = [DOMAIN_COLORS[d] for d in domains_ordered]
labels = [f"{d}\n(n={len(df[df['Domain']==d])})" for d in domains_ordered]

bp = ax.boxplot(data, patch_artist=True, showfliers=True,
                flierprops=dict(marker='o', markersize=3, alpha=0.4),
                medianprops=dict(color='black', linewidth=1.5))
for i, (patch, color, d) in enumerate(zip(bp['boxes'], colors, domains_ordered)):
    patch.set_facecolor(color)
    patch.set_alpha(0.75)
    med = df[df['Domain']==d]['cited_by_count'].median()
    ax.text(i + 1, med * 1.15, f'median={int(med)}',
            ha='center', va='bottom', fontsize=8, fontweight='bold')

ax.set_xticklabels(labels, fontsize=8)
ax.set_ylabel('Global citation count', fontsize=10)
ax.set_title('Global Citation Distribution by Domain\n(cited_by_count from OpenAlex — all academic literature)', fontsize=12, fontweight='bold', pad=10)
ax.set_yscale('symlog', linthresh=10)
ax.yaxis.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(OUT_DIR / 'citation_distribution_by_domain.png', bbox_inches='tight')
plt.close()
print('  Saved: citation_distribution_by_domain.png')

# Print median citations per domain
for d in domains_ordered:
    sub = df[df['Domain']==d]
    print(f'  {d[:45]:45s}  median={sub["cited_by_count"].median():.0f}  mean={sub["cited_by_count"].mean():.0f}  max={sub["cited_by_count"].max()}')

# ── 3. EXTERNAL: Top 15 cited papers ───────────────────────────────────────────
print('\n=== Top 15 cited papers ===')
top15 = df.nlargest(15, 'cited_by_count')[['Paper Title', 'Domain', 'Year', 'cited_by_count']]
for _, row in top15.iterrows():
    print(f"  [{int(row['cited_by_count']):5d}] {str(row['Paper Title'])[:65]} ({int(row['Year'])})")

fig, ax = plt.subplots(figsize=(12, 6))
titles_short = [str(t)[:55] + ('…' if len(str(t)) > 55 else '') for t in top15['Paper Title']]
bar_colors   = [DOMAIN_COLORS.get(d, '#adb5bd') for d in top15['Domain']]
bars = ax.barh(range(len(top15)), top15['cited_by_count'], color=bar_colors, alpha=0.85)
for bar, val in zip(bars, top15['cited_by_count']):
    ax.text(bar.get_width() + 30, bar.get_y() + bar.get_height()/2,
            f'{int(val):,}', va='center', fontsize=8, fontweight='bold')
ax.set_yticks(range(len(top15)))
ax.set_yticklabels(titles_short, fontsize=8)
ax.invert_yaxis()
ax.margins(x=0.15)
ax.set_xlabel('Global citation count (source: OpenAlex — all academic literature)', fontsize=10)
ax.set_title('Top 15 Most Cited Papers in Corpus\n(global citations across all academic literature, via OpenAlex)', fontsize=12, fontweight='bold', pad=10)
legend_patches = [mpatches.Patch(color=c, label=d) for d, c in DOMAIN_COLORS.items()]
ax.legend(handles=legend_patches, fontsize=7, loc='lower right', framealpha=0.9)
ax.xaxis.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(OUT_DIR / 'citation_top15.png', bbox_inches='tight')
plt.close()
print('  Saved: citation_top15.png')

# ── 4. EXTERNAL: Citation counts by region ─────────────────────────────────────
print('\n=== Regional citation analysis ===')
rows_country = []
for _, row in df.iterrows():
    countries_raw = str(row.get('openalex_countries', '') or '')
    countries = list({c.strip() for c in countries_raw.split(';') if c.strip()})
    for c in countries:
        rows_country.append({'country': c, 'cited_by_count': row['cited_by_count'], 'SN': row['SN']})

cdf = pd.DataFrame(rows_country)
country_stats = cdf.groupby('country').agg(
    paper_count=('SN', 'nunique'),
    total_citations=('cited_by_count', 'sum'),
    median_citations=('cited_by_count', 'median'),
    mean_citations=('cited_by_count', 'mean'),
).reset_index()
country_stats = country_stats[country_stats['paper_count'] >= 5].sort_values('median_citations', ascending=False)

print('  Top 15 countries by median citations (min 5 papers):')
for _, row in country_stats.head(15).iterrows():
    print(f"  {row['country']:30s}  papers={int(row['paper_count']):3d}  median={row['median_citations']:.0f}  mean={row['mean_citations']:.0f}")

fig, axes = plt.subplots(1, 2, figsize=(14, 6))

# Left: paper count
top_n = country_stats.nlargest(15, 'paper_count')
axes[0].barh(top_n['country'], top_n['paper_count'], color='#457b9d', alpha=0.8)
axes[0].invert_yaxis()
axes[0].set_xlabel('Number of papers', fontsize=10)
axes[0].set_title('Papers per Country (top 15)', fontsize=11, fontweight='bold')
axes[0].xaxis.grid(True, alpha=0.3)

# Right: median citations
top_n2 = country_stats.nlargest(15, 'median_citations')
axes[1].barh(top_n2['country'], top_n2['median_citations'], color='#e63946', alpha=0.8)
axes[1].invert_yaxis()
axes[1].set_xlabel('Median citation count', fontsize=10)
axes[1].set_title('Median Citations per Country (top 15, min 5 papers)', fontsize=11, fontweight='bold')
axes[1].xaxis.grid(True, alpha=0.3)

fig.suptitle('Regional Publication & Citation Analysis', fontsize=13, fontweight='bold', y=1.01)
fig.tight_layout()
fig.savefig(OUT_DIR / 'citation_regional.png', bbox_inches='tight')
plt.close()
print('  Saved: citation_regional.png')

# ── 5. INTERNAL: Build citation DAG ────────────────────────────────────────────
print('\n=== Internal citation DAG ===')
id_to_sn  = dict(zip(df['openalex_id'].dropna(), df.loc[df['openalex_id'].notna(), 'SN']))
sn_to_meta = df.set_index('SN')[['Paper Title', 'Domain', 'Year', 'cited_by_count']].to_dict('index')

edges = []
for _, row in df.iterrows():
    refs_raw = str(row.get('referenced_works', '') or '')
    if not refs_raw.strip():
        continue
    citing_sn = row['SN']
    for ref_id in refs_raw.split(';'):
        ref_id = ref_id.strip()
        if ref_id in id_to_sn:
            cited_sn = id_to_sn[ref_id]
            if cited_sn != citing_sn:
                edges.append({'citing_SN': citing_sn, 'cited_SN': cited_sn})

edges_df = pd.DataFrame(edges).drop_duplicates()
print(f'  Internal citations: {len(edges_df)} edges between corpus papers')

# In-degree = how many corpus papers cite this paper
in_deg  = edges_df.groupby('cited_SN').size().rename('in_degree_corpus')
out_deg = edges_df.groupby('citing_SN').size().rename('out_degree_corpus')

dag_nodes = df[['SN', 'Paper Title', 'Domain', 'Year', 'cited_by_count']].copy()
dag_nodes = dag_nodes.join(in_deg, on='SN').join(out_deg, on='SN')
dag_nodes['in_degree_corpus']  = dag_nodes['in_degree_corpus'].fillna(0).astype(int)
dag_nodes['out_degree_corpus'] = dag_nodes['out_degree_corpus'].fillna(0).astype(int)
dag_nodes = dag_nodes.sort_values('in_degree_corpus', ascending=False)

print('\n  Top 15 most internally-cited papers (foundational within corpus):')
for _, row in dag_nodes.head(15).iterrows():
    print(f"  [in={int(row['in_degree_corpus']):3d}] {str(row['Paper Title'])[:65]} ({int(row['Year'])})")

# Save DAG CSVs for dashboard
edges_df.to_csv(BASE_DIR / 'citation_dag_edges.csv', index=False)
dag_nodes.to_csv(BASE_DIR / 'citation_dag_nodes.csv', index=False)
print('\n  Saved: citation_dag_edges.csv')
print('  Saved: citation_dag_nodes.csv')

# ── 6. Citation Impact by Domain — internal vs global grouped bars ─────────────
# Per domain: total internal citations (sum in_degree) vs total global citations (sum cited_by_count)
domain_order = list(DOMAIN_COLORS.keys())
total_internal = []
total_global   = []

for d in domain_order:
    papers_in_domain = df[df['Domain'] == d]['SN'].tolist()
    total_global.append(int(df[df['Domain'] == d]['cited_by_count'].sum()))
    total_internal.append(int(dag_nodes[dag_nodes['SN'].isin(papers_in_domain)]['in_degree_corpus'].sum()))

# Sort ascending so largest value ends up at top of barh
sort_idx       = np.argsort(total_internal)
domain_order   = [domain_order[i]   for i in sort_idx]
total_internal = [total_internal[i] for i in sort_idx]
total_global   = [total_global[i]   for i in sort_idx]

y      = np.arange(len(domain_order))
height = 0.35
base_colors = [DOMAIN_COLORS[d] for d in domain_order]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), sharey=True)
fig.suptitle('Citation Impact by Research Domain', fontsize=14, fontweight='bold', y=1.02)

# Left: total internal citations
bars1 = ax1.barh(y, total_internal, height * 1.6, color=base_colors, alpha=0.9)
for bar, val in zip(bars1, total_internal):
    ax1.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
             str(val), va='center', fontsize=10, fontweight='bold')
ax1.set_yticks(y)
ax1.set_yticklabels([d.replace(' & ', '\n& ') for d in domain_order], fontsize=9.5)
ax1.set_xlabel('Total citations received\nfrom other papers in this corpus', fontsize=9)
ax1.set_title('Internal Citations\n(within 519-paper corpus)', fontsize=10, fontweight='bold')
ax1.xaxis.grid(True, alpha=0.25)
ax1.set_axisbelow(True)

# Right: total global citations
bars2 = ax2.barh(y, total_global, height * 1.6, color=base_colors, alpha=0.9)
for bar, val in zip(bars2, total_global):
    ax2.text(bar.get_width() * 1.01, bar.get_y() + bar.get_height()/2,
             f'{val:,}', va='center', fontsize=10, fontweight='bold')
ax2.set_xlabel('Total citations received\nacross all academic literature (OpenAlex)', fontsize=9)
ax2.set_title('Global Citations\n(all academic literature via OpenAlex)', fontsize=10, fontweight='bold')
ax2.xaxis.grid(True, alpha=0.25)
ax2.set_axisbelow(True)

fig.tight_layout()
fig.savefig(OUT_DIR / 'citation_internal_indegree.png', bbox_inches='tight')
plt.close()
print('  Saved: citation_internal_indegree.png (total internal vs total global per domain)')

print('\n  Domain citation summary:')
for d, ti, tg in zip(domain_order, total_internal, total_global):
    print(f'  {d[:45]:45s}  internal={ti:4d}  global={tg:6,}')

# ── 7. Summary stats ───────────────────────────────────────────────────────────
print('\n=== Summary ===')
print(f'  Total papers:                  {len(df)}')
print(f'  Papers with citations > 0:     {(df["cited_by_count"] > 0).sum()}')
print(f'  Papers with 0 citations:       {(df["cited_by_count"] == 0).sum()}')
print(f'  Median citations (all):        {df["cited_by_count"].median():.0f}')
print(f'  Mean citations (all):          {df["cited_by_count"].mean():.1f}')
print(f'  Total internal citation edges: {len(edges_df)}')
print(f'  Papers cited internally ≥1x:   {(dag_nodes["in_degree_corpus"] >= 1).sum()}')
print(f'  Papers citing internally ≥1x:  {(dag_nodes["out_degree_corpus"] >= 1).sum()}')
print(f'  Most cited internally:         {dag_nodes.iloc[0]["Paper Title"][:60]} (in={dag_nodes.iloc[0]["in_degree_corpus"]})')
