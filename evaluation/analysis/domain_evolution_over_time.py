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
    'font.size': 12,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300
})


# Load the dataset
BASE_DIR = Path(__file__).resolve().parent
file_path = BASE_DIR / "papers_new.csv"
df = pd.read_csv(file_path)

# Domain evolution over time
domain_year = pd.crosstab(df['Year'], df['Domain'])

plt.figure(figsize=(14, 8))
ax = domain_year.plot(kind='line', marker='o', linewidth=2, markersize=6, figsize=(14, 8))
# plt.title('Evolution of Research Domains Over Time', fontsize=16, fontweight='bold')
plt.xlabel('Year', fontsize=14)
plt.ylabel('Number of Papers', fontsize=14)

# NOTE: Per-point value labels commented out — with 520 papers across 5 domains,
# labels stack heavily in the 2022–2026 peak years making the chart unreadable.
# total_papers = len(df)
# for domain in domain_year.columns:
#     for year in domain_year.index:
#         value = domain_year.loc[year, domain]
#         if value > 0:
#             percentage = (value / total_papers) * 100
#             plt.text(year, value + 0.2, f'{int(value)}\n({percentage:.1f}%)',
#                      ha='center', va='bottom', fontsize=14, alpha=0.8)

# Add legend inside the plot
plt.legend(title='Domain', loc='upper left', fontsize=11)
plt.grid(True, alpha=0.3)
plt.xticks(rotation=0, fontsize=13)
plt.yticks(fontsize=13)
plt.tight_layout()
output_path_pdf = "figures_new/domain-evolution-over-time.pdf"
output_path_png = "figures_new/domain-evolution-over-time.png"
plt.savefig(output_path_pdf, bbox_inches="tight", dpi=300) 
plt.savefig(output_path_png, bbox_inches="tight", dpi=300)  # high-res image
# plt.show()
plt.close()