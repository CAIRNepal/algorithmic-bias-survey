import pandas as pd
import numpy as np
from scipy import stats
from scikit_posthocs import posthoc_dunn
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENRICHED = BASE_DIR.parent.parent / 'openalex_enriched.csv'
CORPUS = BASE_DIR / 'papers_new.csv'
OUT_DIR = BASE_DIR / 'figures_new'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Load & merge ──────────────────────────────────────────────────────────────
corpus = pd.read_csv(CORPUS)
enriched = pd.read_csv(ENRICHED)
df = corpus.merge(enriched[['SN', 'cited_by_count', 'openalex_countries']], on='SN', how='left')
df['cited_by_count'] = pd.to_numeric(df['cited_by_count'], errors='coerce').fillna(0).astype(int)

# Expand countries (first listed = first author country)
# Fallback to manual Author Regions when openalex_countries is empty
df['countries_list'] = df.apply(
    lambda r: [c.strip() for c in str(r['openalex_countries']).split(';') if c.strip() and c.strip() != 'nan']
              or [c.strip() for c in str(r['Author Regions']).split(';') if c.strip() and c.strip() != 'nan'],
    axis=1
)
# Normalize UK variants
df['countries_list'] = df['countries_list'].apply(
    lambda cs: ['United Kingdom' if c == 'UK' else c for c in cs]
)
df['first_author_country'] = df['countries_list'].apply(lambda x: x[0] if x else 'Unknown')

# All-author country expansion
rows = []
for _, row in df.iterrows():
    for country in row['countries_list']:
        rows.append({'SN': row['SN'], 'country': country, 'cited_by_count': row['cited_by_count'],
                     'Domain': row['Domain']})
df_country = pd.DataFrame(rows)

print("=" * 70)
print("STATISTICAL ANALYSIS — ATLAS AI Bias Paper")
print("=" * 70)

# ── 1. Kruskal-Wallis: citation counts across 5 domains ──────────────────────
print("\n" + "─" * 70)
print("1. KRUSKAL-WALLIS: Citation counts across domains")
print("─" * 70)

domains = df['Domain'].unique()
groups = [df.loc[df['Domain'] == d, 'cited_by_count'].values for d in domains]

stat_kw, p_kw = stats.kruskal(*groups)
print(f"   H-statistic: {stat_kw:.4f}")
print(f"   p-value:     {p_kw:.2e}")
print(f"   Significant (p < 0.05): {p_kw < 0.05}")

# Post-hoc Dunn's test with Bonferroni correction
print("\n   Post-hoc Dunn's test (Bonferroni):")
dunn = posthoc_dunn(df, val_col='cited_by_count', group_col='Domain', p_adjust='bonferroni')
# Print as formatted table
dunn_display = dunn.copy()
dunn_display.index = [d[:20] for d in dunn_display.index]
dunn_display.columns = [d[:20] for d in dunn_display.columns]
print(dunn_display.round(4).to_string())

print("\n   Domain medians:")
for d in sorted(domains):
    vals = df.loc[df['Domain'] == d, 'cited_by_count']
    print(f"   {d:45s}  median={vals.median():.0f}  mean={vals.mean():.1f}  n={len(vals)}")

# ── 2. Spearman correlation: volume vs. median citation per country ───────────
print("\n" + "─" * 70)
print("2. SPEARMAN CORRELATION: Publication volume vs. median citation (per country)")
print("─" * 70)

# Use first-author country to avoid double-counting
country_stats = df.groupby('first_author_country').agg(
    paper_count=('SN', 'count'),
    median_citation=('cited_by_count', 'median'),
    mean_citation=('cited_by_count', 'mean')
).reset_index()
# Filter countries with >= 5 papers for meaningful comparison
country_stats_filtered = country_stats[country_stats['paper_count'] >= 5].copy()

rho, p_spearman = stats.spearmanr(country_stats_filtered['paper_count'],
                                   country_stats_filtered['median_citation'])
print(f"   Countries with >= 5 papers: {len(country_stats_filtered)}")
print(f"   Spearman rho: {rho:.4f}")
print(f"   p-value:      {p_spearman:.4f}")
print(f"   Interpretation: {'Volume and impact are decoupled' if p_spearman > 0.05 else 'Significant correlation exists'}")

print("\n   Country breakdown:")
for _, row in country_stats_filtered.sort_values('paper_count', ascending=False).iterrows():
    print(f"   {row['first_author_country']:20s}  papers={row['paper_count']:3.0f}  "
          f"median_cit={row['median_citation']:6.1f}  mean_cit={row['mean_citation']:7.1f}")

# ── 3. Gini coefficient: geographic & institutional concentration ─────────────
print("\n" + "─" * 70)
print("3. GINI COEFFICIENT: Geographic & institutional concentration")
print("─" * 70)


def gini(array):
    array = np.sort(np.array(array, dtype=float))
    n = len(array)
    if n == 0 or array.sum() == 0:
        return 0.0
    index = np.arange(1, n + 1)
    return (2 * np.sum(index * array) - (n + 1) * np.sum(array)) / (n * np.sum(array))


# Geographic Gini (first-author country)
country_papers = df['first_author_country'].value_counts().values
gini_geo = gini(country_papers)
print(f"   Geographic Gini (first-author country):  {gini_geo:.4f}")
print(f"   Number of countries: {len(country_papers)}")
print(f"   Top country share: {country_papers[0] / country_papers.sum() * 100:.1f}%")

# Institutional Gini (from Affiliations column)
affiliations = df['Affiliations'].dropna()
inst_counts = {}
for aff_str in affiliations:
    for inst in aff_str.split(';'):
        inst = inst.strip()
        if inst:
            inst_counts[inst] = inst_counts.get(inst, 0) + 1

if inst_counts:
    inst_values = np.array(sorted(inst_counts.values()))
    gini_inst = gini(inst_values)
    print(f"   Institutional Gini (all authors):        {gini_inst:.4f}")
    print(f"   Number of institutions: {len(inst_values)}")
    print(f"   Top institution: {max(inst_counts, key=inst_counts.get)} ({max(inst_counts.values())} papers)")
else:
    print("   Institutional Gini: SKIPPED (Affiliations column empty)")

# Institutional Gini (first author only — first affiliation per paper)
first_inst_counts = {}
for aff_str in affiliations:
    first_inst = aff_str.split(';')[0].strip()
    if first_inst:
        first_inst_counts[first_inst] = first_inst_counts.get(first_inst, 0) + 1

if first_inst_counts:
    first_inst_values = np.array(sorted(first_inst_counts.values()))
    gini_first_inst = gini(first_inst_values)
    print(f"   Institutional Gini (first author):       {gini_first_inst:.4f}")
    print(f"   Number of institutions: {len(first_inst_values)}")
    print(f"   Top institution: {max(first_inst_counts, key=first_inst_counts.get)} ({max(first_inst_counts.values())} papers)")
else:
    print("   Institutional Gini (first author): SKIPPED")

print(f"\n   Interpretation: Gini > 0.5 = high concentration, > 0.7 = very high")

# ── 4. Chi-square: domain distribution independence from country ──────────────
print("\n" + "─" * 70)
print("4. CHI-SQUARE: Domain distribution independence from country")
print("─" * 70)

# Use top countries with sufficient papers across domains
top_countries = country_stats[country_stats['paper_count'] >= 10]['first_author_country'].tolist()
df_top = df[df['first_author_country'].isin(top_countries)]

contingency = pd.crosstab(df_top['first_author_country'], df_top['Domain'])
chi2, p_chi2, dof, expected = stats.chi2_contingency(contingency)
# Cramér's V for effect size
n_obs = contingency.sum().sum()
k = min(contingency.shape)
cramers_v = np.sqrt(chi2 / (n_obs * (k - 1)))

print(f"   Countries included (>= 10 papers): {top_countries}")
print(f"   Chi-square statistic: {chi2:.4f}")
print(f"   Degrees of freedom:   {dof}")
print(f"   p-value:              {p_chi2:.2e}")
print(f"   Cramér's V:           {cramers_v:.4f}")
print(f"   Significant (p < 0.05): {p_chi2 < 0.05}")
print(f"   Effect size: {'small' if cramers_v < 0.3 else 'medium' if cramers_v < 0.5 else 'large'}")

print("\n   Contingency table:")
print(contingency.to_string())

# ── 5. Bootstrap 95% CIs on median citations ──────────────────────────────────
print("\n" + "─" * 70)
print("5. BOOTSTRAP 95% CIs: Median citations per domain and per country")
print("─" * 70)

rng = np.random.default_rng(42)
N_BOOT = 10000


def bootstrap_ci(data, n_boot=N_BOOT, ci=95):
    data = np.array(data)
    medians = np.array([np.median(rng.choice(data, size=len(data), replace=True)) for _ in range(n_boot)])
    lower = np.percentile(medians, (100 - ci) / 2)
    upper = np.percentile(medians, 100 - (100 - ci) / 2)
    return np.median(data), lower, upper


print("\n   By domain:")
for d in sorted(domains):
    vals = df.loc[df['Domain'] == d, 'cited_by_count'].values
    med, lo, hi = bootstrap_ci(vals)
    print(f"   {d:45s}  median={med:6.0f}  95% CI=[{lo:.0f}, {hi:.0f}]  n={len(vals)}")

print("\n   By country (>= 5 papers, first-author):")
for _, row in country_stats_filtered.sort_values('paper_count', ascending=False).iterrows():
    c = row['first_author_country']
    vals = df.loc[df['first_author_country'] == c, 'cited_by_count'].values
    med, lo, hi = bootstrap_ci(vals)
    print(f"   {c:20s}  median={med:6.0f}  95% CI=[{lo:.0f}, {hi:.0f}]  n={len(vals)}")

# ── 6. Mann-Whitney U: Global South vs. Global North citations ────────────────
print("\n" + "─" * 70)
print("6. MANN-WHITNEY U: Global South vs. Global North citations")
print("─" * 70)

GLOBAL_NORTH = {
    'USA', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia',
    'Netherlands', 'Switzerland', 'Austria', 'Italy', 'Spain', 'Sweden',
    'Denmark', 'Norway', 'Finland', 'Belgium', 'Ireland', 'Japan',
    'South Korea', 'Israel', 'New Zealand', 'Greece', 'Portugal',
    'Czech Republic', 'Poland', 'Singapore', 'Hong Kong'
}

df['global_group'] = df['first_author_country'].apply(
    lambda x: 'Global North' if x in GLOBAL_NORTH else 'Global South'
)

north = df.loc[df['global_group'] == 'Global North', 'cited_by_count'].values
south = df.loc[df['global_group'] == 'Global South', 'cited_by_count'].values

if len(south) >= 5:
    u_stat, p_mw = stats.mannwhitneyu(north, south, alternative='two-sided')
    # Effect size: rank-biserial correlation
    r_rb = 1 - (2 * u_stat) / (len(north) * len(south))

    print(f"   Global North: n={len(north)}, median={np.median(north):.0f}, mean={np.mean(north):.1f}")
    print(f"   Global South: n={len(south)}, median={np.median(south):.0f}, mean={np.mean(south):.1f}")
    print(f"   U-statistic:          {u_stat:.0f}")
    print(f"   p-value:              {p_mw:.4f}")
    print(f"   Rank-biserial r:      {r_rb:.4f}")
    print(f"   Significant (p < 0.05): {p_mw < 0.05}")

    # Bootstrap CIs for both groups
    med_n, lo_n, hi_n = bootstrap_ci(north)
    med_s, lo_s, hi_s = bootstrap_ci(south)
    print(f"\n   Global North median: {med_n:.0f}  95% CI=[{lo_n:.0f}, {hi_n:.0f}]")
    print(f"   Global South median: {med_s:.0f}  95% CI=[{lo_s:.0f}, {hi_s:.0f}]")
else:
    print(f"   Global South papers: {len(south)} (insufficient for test)")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print(f"   1. Kruskal-Wallis (domains):        H={stat_kw:.2f}, p={p_kw:.2e}")
print(f"   2. Spearman (volume vs impact):     rho={rho:.3f}, p={p_spearman:.4f}")
print(f"   3. Gini (geographic):               {gini_geo:.4f}")
print(f"   4. Chi-square (country × domain):   χ²={chi2:.2f}, p={p_chi2:.2e}, V={cramers_v:.3f}")
print(f"   5. Bootstrap CIs:                   see above")
if len(south) >= 5:
    print(f"   6. Mann-Whitney (North vs South):   U={u_stat:.0f}, p={p_mw:.4f}, r={r_rb:.3f}")
print("=" * 70)

# ── Export CSV ────────────────────────────────────────────────────────────────
csv_rows = []

# Test 1: Kruskal-Wallis
csv_rows.append({'test': 'Kruskal-Wallis', 'scope': 'all domains', 'statistic': 'H',
                 'value': round(stat_kw, 4), 'p_value': f'{p_kw:.2e}', 'effect_size': '',
                 'n': len(df), 'notes': 'Citation counts across 5 domains'})

# Dunn post-hoc pairwise
for i, d1 in enumerate(dunn.index):
    for j, d2 in enumerate(dunn.columns):
        if i < j:
            csv_rows.append({'test': 'Dunn post-hoc (Bonferroni)', 'scope': f'{d1} vs {d2}',
                             'statistic': 'p_adj', 'value': round(dunn.iloc[i, j], 4),
                             'p_value': f'{dunn.iloc[i, j]:.4f}',
                             'effect_size': '', 'n': '',
                             'notes': 'Significant' if dunn.iloc[i, j] < 0.05 else 'Not significant'})

# Test 2: Spearman
csv_rows.append({'test': 'Spearman correlation', 'scope': 'volume vs median citation',
                 'statistic': 'rho', 'value': round(rho, 4), 'p_value': f'{p_spearman:.4f}',
                 'effect_size': '', 'n': len(country_stats_filtered),
                 'notes': f'Countries with >= 5 papers'})

# Test 3: Gini
csv_rows.append({'test': 'Gini coefficient', 'scope': 'geographic (first-author country)',
                 'statistic': 'Gini', 'value': round(gini_geo, 4), 'p_value': '',
                 'effect_size': '', 'n': len(country_papers),
                 'notes': f'Top country share: {country_papers[0] / country_papers.sum() * 100:.1f}%'})
if inst_counts:
    csv_rows.append({'test': 'Gini coefficient', 'scope': 'institutional (all authors)',
                     'statistic': 'Gini', 'value': round(gini_inst, 4), 'p_value': '',
                     'effect_size': '', 'n': len(inst_values),
                     'notes': f'Top: {max(inst_counts, key=inst_counts.get)}'})
if first_inst_counts:
    csv_rows.append({'test': 'Gini coefficient', 'scope': 'institutional (first author)',
                     'statistic': 'Gini', 'value': round(gini_first_inst, 4), 'p_value': '',
                     'effect_size': '', 'n': len(first_inst_values),
                     'notes': f'Top: {max(first_inst_counts, key=first_inst_counts.get)}'})

# Test 4: Chi-square
csv_rows.append({'test': 'Chi-square', 'scope': 'country x domain independence',
                 'statistic': 'chi2', 'value': round(chi2, 4), 'p_value': f'{p_chi2:.2e}',
                 'effect_size': f"Cramer's V={cramers_v:.4f}", 'n': n_obs,
                 'notes': f'df={dof}, countries >= 10 papers'})

# Test 5: Bootstrap CIs by domain
for d in sorted(domains):
    vals = df.loc[df['Domain'] == d, 'cited_by_count'].values
    med, lo, hi = bootstrap_ci(vals)
    csv_rows.append({'test': 'Bootstrap 95% CI', 'scope': f'domain: {d}',
                     'statistic': 'median', 'value': med, 'p_value': '',
                     'effect_size': f'CI=[{lo:.0f}, {hi:.0f}]', 'n': len(vals), 'notes': ''})

# Bootstrap CIs by country
for _, row in country_stats_filtered.sort_values('paper_count', ascending=False).iterrows():
    c = row['first_author_country']
    vals = df.loc[df['first_author_country'] == c, 'cited_by_count'].values
    med, lo, hi = bootstrap_ci(vals)
    csv_rows.append({'test': 'Bootstrap 95% CI', 'scope': f'country: {c}',
                     'statistic': 'median', 'value': med, 'p_value': '',
                     'effect_size': f'CI=[{lo:.0f}, {hi:.0f}]', 'n': len(vals), 'notes': ''})

# Test 6: Mann-Whitney
if len(south) >= 5:
    csv_rows.append({'test': 'Mann-Whitney U', 'scope': 'Global North vs Global South',
                     'statistic': 'U', 'value': u_stat, 'p_value': f'{p_mw:.6f}',
                     'effect_size': f'rank-biserial r={r_rb:.4f}',
                     'n': f'{len(north)} vs {len(south)}',
                     'notes': f'North median={np.median(north):.0f}, South median={np.median(south):.0f}'})

csv_out = OUT_DIR / 'statistical_tests_results.csv'
pd.DataFrame(csv_rows).to_csv(csv_out, index=False)
print(f"\nResults exported to: {csv_out}")
