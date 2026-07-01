import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = 'DejaVu Sans'

# Load data
enriched = pd.read_csv('openalex_enriched.csv')
papers = pd.read_csv('evaluation/analysis/papers_new.csv')

# Restrict to 704-paper corpus (SN 1-704)
papers = papers[papers['SN'] <= 704].copy()
enriched = enriched[enriched['SN'] <= 704].copy()

# Merge to get domain
merged = enriched.merge(papers[['SN', 'Domain']], on='SN', how='inner')
print(f"Merged rows: {len(merged)}")

# Build set of all openalex_ids in corpus
corpus_ids = set(merged['openalex_id'].dropna().str.strip())
print(f"Corpus OpenAlex IDs: {len(corpus_ids)}")

# Compute internal citations (in-degree):
# For each paper, count how many other corpus papers reference it
id_to_internal = {oid: 0 for oid in corpus_ids}

for _, row in merged.iterrows():
    refs = str(row['referenced_works']) if pd.notna(row['referenced_works']) else ''
    if refs.strip() == '' or refs == 'nan':
        continue
    for ref in refs.split(';'):
        ref = ref.strip()
        if ref in id_to_internal:
            id_to_internal[ref] += 1

merged['internal_citations'] = merged['openalex_id'].map(id_to_internal).fillna(0).astype(int)
merged['global_citations'] = pd.to_numeric(merged['cited_by_count'], errors='coerce').fillna(0).astype(int)

# Sum by domain
domain_order = [
    'General Fairness & Bias Mitigation',
    'LLMs & NLP',
    'Health & Clinical AI',
    'Recommender Systems',
    'Graph-Based Fairness & Bias Mitigation'
]

summary = merged.groupby('Domain').agg(
    internal=('internal_citations', 'sum'),
    global_=('global_citations', 'sum')
).reindex(domain_order)

print("\nDomain citation summary:")
print(summary)
print("\nGlobal:Internal ratios:")
for d in domain_order:
    g = summary.loc[d, 'global_']
    i = summary.loc[d, 'internal']
    ratio = f"{g/i:.0f}:1" if i > 0 else "N/A"
    print(f"  {d}: global={g}, internal={i}, ratio={ratio}")

# Plot
short_labels = [
    'General Fairness\n& Bias Mitigation',
    'LLMs\n& NLP',
    'Health\n& Clinical AI',
    'Recommender\nSystems',
    'Graph-Based Fairness\n& Bias Mitigation'
]

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Internal
axes[0].barh(short_labels[::-1], summary['internal'].values[::-1], color='steelblue')
for i, v in enumerate(summary['internal'].values[::-1]):
    axes[0].text(v + 5, i, str(v), va='center', fontsize=10)
axes[0].set_xlabel('Total citations received\nfrom other papers in this corpus')
axes[0].set_title('Internal Citations\n(within 704-paper corpus)')
axes[0].set_xlim(0, summary['internal'].max() * 1.15)

# Global
axes[1].barh(short_labels[::-1], summary['global_'].values[::-1], color='teal')
for i, v in enumerate(summary['global_'].values[::-1]):
    axes[1].text(v + 100, i, f'{v:,}', va='center', fontsize=10)
axes[1].set_xlabel('Total citations received\nacross all academic literature (OpenAlex)')
axes[1].set_title('Global Citations\n(all academic literature via OpenAlex)')
axes[1].set_xlim(0, summary['global_'].max() * 1.15)

plt.tight_layout()
out_path = '/Users/abhashshrestha/Downloads/CAIR - papers/AI bias/in_review/updating_pdf/Final Draft - I/Nature_Machine_Intelligence____working_version_new/images/new/citation_internal_indegree.png'
plt.savefig(out_path, dpi=150, bbox_inches='tight')
print(f"\nSaved to {out_path}")
plt.close()
