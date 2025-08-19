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


# --- Load dataset ---
BASE_DIR = Path(__file__).resolve().parent
file_path = BASE_DIR / "papers.csv"
df = pd.read_csv(file_path)

# --- Count papers per Domain (regardless of country) ---
domain_counts = df["Domain"].value_counts()

def autopct_with_counts(pct, all_vals):
    absolute = int(round(pct/100.*sum(all_vals)))
    return f"{pct:.1f}% ({absolute})"

# --- Plot pie ---
plt.figure(figsize=(9, 9))
plt.pie(
    domain_counts,
    labels=domain_counts.index,
    autopct=lambda pct: autopct_with_counts(pct, domain_counts),
    startangle=140,
    pctdistance=0.8,
    textprops={'fontsize': 13}
)

output_path_pdf="figures/overall_domain_distribution_all_countries.pdf"
output_path_png="figures/overall_domain_distribution_all_countries.png" 
plt.savefig(output_path_pdf, bbox_inches="tight", dpi=300) 
plt.savefig(output_path_png, bbox_inches="tight", dpi=300)  # high-res image
# plt.show()
plt.close()

