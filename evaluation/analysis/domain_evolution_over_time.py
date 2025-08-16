# Import required libraries
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
from datetime import datetime
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
file_path = "papers.csv"
df = pd.read_csv(file_path)

# Domain evolution over time
domain_year = pd.crosstab(df['Year'], df['Domain'])

plt.figure(figsize=(14, 8))
ax = domain_year.plot(kind='line', marker='o', linewidth=2, markersize=6, figsize=(14, 8))
# plt.title('Evolution of Research Domains Over Time', fontsize=16, fontweight='bold')
plt.xlabel('Year', fontsize=14)
plt.ylabel('Number of Papers', fontsize=14)

# Add value labels on each data point with both count and percentage
total_papers = len(df)
for domain in domain_year.columns:
    for year in domain_year.index:
        value = domain_year.loc[year, domain]
        if value > 0:  # Only label non-zero values
            percentage = (value / total_papers) * 100
            plt.text(year, value + 0.2, f'{int(value)}\n({percentage:.1f}%)', 
                     ha='center', va='bottom', fontsize=14, alpha=0.8)


# Add legend inside the plot
plt.legend(title='Domain', loc='upper right', fontsize=13)
plt.grid(True, alpha=0.3)
plt.xticks(rotation=0, fontsize=13)
plt.yticks(fontsize=13)
plt.tight_layout()
output_path_pdf = "figures/domain-evolution-over-time.pdf"
output_path_png = "figures/domain-evolution-over-time.png"
plt.savefig(output_path_pdf, bbox_inches="tight", dpi=300) 
plt.savefig(output_path_png, bbox_inches="tight", dpi=300)  # high-res image
# plt.show()
plt.close()