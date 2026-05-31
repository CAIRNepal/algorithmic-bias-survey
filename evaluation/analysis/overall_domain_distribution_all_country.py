# Import required libraries
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
from datetime import datetime
from pathlib import Path
warnings.filterwarnings('ignore')

# Set plotting style for publication quality
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")
plt.rcParams.update({
    'font.size': 16,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300
})


# --- Load dataset ---
BASE_DIR = Path(__file__).resolve().parent
file_path = BASE_DIR / "papers_new.csv"
df = pd.read_csv(file_path)

# --- Count papers per Domain (regardless of country) ---
domain_counts = df["Domain"].value_counts()

DOMAIN_COLORS = {
    'Health & Clinical AI':                     '#e63946',
    'General Fairness & Bias Mitigation':       '#457b9d',
    'Graph-Based Fairness & Bias Mitigation':   '#2a9d8f',
    'LLMs & NLP':                               '#e9c46a',
    'Recommender Systems':                      '#f4a261',
}
colors = [DOMAIN_COLORS.get(d, '#aaaaaa') for d in domain_counts.index]

def autopct_with_counts(pct, all_vals):
    absolute = int(round(pct/100.*sum(all_vals)))
    return f"{pct:.1f}% ({absolute})"

# --- Plot pie ---
plt.figure(figsize=(9, 9))
plt.pie(
    domain_counts,
    labels=domain_counts.index,
    colors=colors,
    autopct=lambda pct: autopct_with_counts(pct, domain_counts),
    startangle=140,
    pctdistance=0.8,
    textprops={'fontsize': 16, 'fontweight': 'bold'}
)

output_path_pdf="figures_new/overall_domain_distribution_all_countries.pdf"
output_path_png="figures_new/overall_domain_distribution_all_countries.png"
plt.savefig(output_path_pdf, bbox_inches="tight", dpi=300)
plt.savefig(output_path_png, bbox_inches="tight", dpi=300)
plt.close()

# --- Donut chart ---
fig, ax = plt.subplots(figsize=(10, 7))
wedges, texts, autotexts = ax.pie(
    domain_counts,
    colors=colors,
    autopct=lambda pct: autopct_with_counts(pct, domain_counts),
    startangle=140,
    pctdistance=0.78,
    wedgeprops=dict(width=0.5, edgecolor='white', linewidth=2),
    textprops={'fontsize': 14, 'fontweight': 'bold'},
)
for at in autotexts:
    at.set_fontsize(13)
    at.set_fontweight('bold')

ax.legend(wedges, domain_counts.index,
          loc='lower center', bbox_to_anchor=(0.5, -0.12),
          ncol=2, fontsize=13, framealpha=0.0,
          title='Domain', title_fontsize=14)
ax.set_title('Distribution of Research Across Thematic Domains',
             fontsize=15, fontweight='bold', pad=20)

plt.tight_layout()
plt.savefig("figures_new/overall_domain_distribution_donut.pdf", bbox_inches="tight", dpi=300)
plt.savefig("figures_new/overall_domain_distribution_donut.png", bbox_inches="tight", dpi=300)
plt.close()
print("Saved donut chart.")

