"""
Regional Normalization Analysis
================================
Compares AI-bias research output per country against total AI publication volume
per country (2015–2026), using OpenAlex. Produces:
  - regional_normalization.csv  — per-country table with counts and share
  - figures_new/regional_normalization.png — dual-bar + scatter figure

Usage:
    python3 evaluation/analysis/regional_normalization.py
"""

import csv
import time
import requests
import pandas as pd
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
ENRICHED_CSV  = Path("openalex_enriched.csv")
PAPERS_CSV    = Path("evaluation/analysis/papers_new.csv")
OUT_CSV       = Path("evaluation/analysis/regional_normalization.csv")
FIGURES_DIR   = Path("evaluation/analysis/figures_new")
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# OpenAlex Artificial Intelligence concept ID
AI_CONCEPT_ID = "C154945302"
YEAR_FROM     = 2015  # corpus has 8 papers before 2015; exclude to match OpenAlex baseline
YEAR_TO       = 2026
TOP_N         = 20     # countries to show in bar charts

# Country code → display name (mirrors notebook)
CC2NAME = {
    "AF":"Afghanistan","AL":"Albania","DZ":"Algeria","AR":"Argentina","AM":"Armenia",
    "AU":"Australia","AT":"Austria","AZ":"Azerbaijan","BH":"Bahrain","BD":"Bangladesh",
    "BY":"Belarus","BE":"Belgium","BO":"Bolivia","BA":"Bosnia and Herzegovina",
    "BR":"Brazil","BG":"Bulgaria","KH":"Cambodia","CA":"Canada","CL":"Chile",
    "CN":"China","CO":"Colombia","HR":"Croatia","CY":"Cyprus","CZ":"Czech Republic",
    "DK":"Denmark","EG":"Egypt","EE":"Estonia","ET":"Ethiopia","FI":"Finland",
    "FR":"France","GE":"Georgia","DE":"Germany","GH":"Ghana","GR":"Greece",
    "HK":"Hong Kong","HU":"Hungary","IN":"India","ID":"Indonesia","IR":"Iran",
    "IQ":"Iraq","IE":"Ireland","IL":"Israel","IT":"Italy","JP":"Japan",
    "JO":"Jordan","KZ":"Kazakhstan","KE":"Kenya","KR":"South Korea","KW":"Kuwait",
    "LV":"Latvia","LB":"Lebanon","LT":"Lithuania","LU":"Luxembourg","MY":"Malaysia",
    "MT":"Malta","MX":"Mexico","MA":"Morocco","NL":"Netherlands","NZ":"New Zealand",
    "NG":"Nigeria","NO":"Norway","OM":"Oman","PK":"Pakistan","PE":"Peru",
    "PH":"Philippines","PL":"Poland","PT":"Portugal","QA":"Qatar","RO":"Romania",
    "RU":"Russia","SA":"Saudi Arabia","RS":"Serbia","SG":"Singapore","SK":"Slovakia",
    "SI":"Slovenia","ZA":"South Africa","ES":"Spain","LK":"Sri Lanka","SE":"Sweden",
    "CH":"Switzerland","TW":"Taiwan","TH":"Thailand","TN":"Tunisia","TR":"Turkey",
    "UA":"Ukraine","AE":"United Arab Emirates","GB":"United Kingdom","US":"USA",
    "UY":"Uruguay","UZ":"Uzbekistan","VN":"Vietnam","MO":"Macau","NP":"Nepal",
}
NAME2CC = {v: k for k, v in CC2NAME.items()}

# ── Step 1: fetch total AI publications per country from OpenAlex ─────────────

def fetch_ai_counts_by_country() -> dict[str, int]:
    """
    Uses OpenAlex group-by to get total AI paper counts per country (2015–2024).
    Returns dict: country_name → count  (names match CC2NAME conventions)

    OpenAlex group-by keys have the form:
        https://openalex.org/countries/CN
    Extract the trailing 2-letter ISO code and map via CC2NAME.
    """
    print("Fetching total AI publication counts from OpenAlex...")
    base_url = (
        f"https://api.openalex.org/works"
        f"?filter=concepts.id:{AI_CONCEPT_ID},"
        f"publication_year:{YEAR_FROM}-{YEAR_TO},"
        f"type:article"
        f"&group_by=authorships.countries"
        f"&per-page=200"
    )

    counts: dict[str, int] = {}
    page = 1

    while True:
        paged_url = f"{base_url}&page={page}"
        try:
            r = requests.get(paged_url, timeout=30)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  Error on page {page}: {e}")
            break

        data     = r.json()
        group_by = data.get("group_by", [])
        if not group_by:
            break

        for entry in group_by:
            raw_key = entry.get("key", "")          # e.g. "https://openalex.org/countries/CN"
            count   = entry.get("count", 0)
            # Extract ISO2 code from URL suffix
            cc = raw_key.split("/")[-1].upper() if "/" in raw_key else raw_key.upper()
            name = CC2NAME.get(cc)
            if name is None:
                # Fallback: use key_display_name so no country is silently dropped
                name = entry.get("key_display_name", cc)
            if name:
                counts[name] = counts.get(name, 0) + count

        print(f"  Page {page}: {len(group_by)} groups, running total {sum(counts.values()):,}")

        meta          = data.get("meta", {})
        groups_count  = meta.get("groups_count", 0)
        fetched_so_far = page * 200
        if fetched_so_far >= groups_count:
            break
        page += 1
        time.sleep(0.5)

    print(f"  Fetched AI counts for {len(counts)} countries.\n")
    return counts


# ── Step 2: count bias papers per country from openalex_enriched.csv ──────────

def count_bias_papers_by_country() -> dict[str, int]:
    """
    Each paper can credit multiple unique countries (author-country level).
    We deduplicate at the country-per-paper level (country credited once per paper).
    """
    enriched = pd.read_csv(ENRICHED_CSV, low_memory=False)
    papers   = pd.read_csv(PAPERS_CSV,   low_memory=False)

    # Filter to 2015–2024 to match the AI baseline
    papers_filtered = papers[(papers["Year"] >= YEAR_FROM) & (papers["Year"] <= YEAR_TO)]
    valid_sns       = set(papers_filtered["SN"].tolist())

    enriched_filtered = enriched[enriched["SN"].isin(valid_sns)]

    counts: dict[str, int] = {}

    for _, row in enriched_filtered.iterrows():
        raw = row.get("openalex_countries", "")
        if not isinstance(raw, str) or not raw.strip():
            # Fall back to Author Regions from papers_new.csv
            sn = row["SN"]
            match = papers[papers["SN"] == sn]
            if not match.empty:
                raw = str(match.iloc[0].get("Author Regions", ""))

        seen = set()
        for country in raw.split(";"):
            c = country.strip()
            if c and c not in seen:
                seen.add(c)
                counts[c] = counts.get(c, 0) + 1

    return counts


# ── Step 3: build comparison table and normalize ──────────────────────────────

def build_table(ai_counts: dict, bias_counts: dict) -> pd.DataFrame:
    all_countries = set(ai_counts.keys()) | set(bias_counts.keys())

    rows = []
    for country in sorted(all_countries):
        ai   = ai_counts.get(country, 0)
        bias = bias_counts.get(country, 0)
        if ai == 0 and bias == 0:
            continue
        share_pct = (bias / ai * 100) if ai > 0 else None
        rows.append({
            "country":           country,
            "total_ai_papers":   ai,
            "bias_papers":       bias,
            "bias_share_pct":    round(share_pct, 4) if share_pct is not None else None,
        })

    df = pd.DataFrame(rows)
    # Compute z-score of share to identify over/under-representation
    valid = df["bias_share_pct"].dropna()
    mu, sigma = valid.mean(), valid.std()
    df["share_zscore"] = (df["bias_share_pct"] - mu) / sigma
    df = df.sort_values("bias_papers", ascending=False).reset_index(drop=True)
    return df, mu, sigma


# ── Step 4: plotting ──────────────────────────────────────────────────────────

DOMAIN_COLORS = {
    "over":  "#2a9d8f",   # teal  — above mean share
    "under": "#e63946",   # red   — below mean share
    "na":    "#adb5bd",   # grey  — no AI baseline
}

def plot_normalization(df: pd.DataFrame, mu: float, sigma: float):
    matplotlib.rcParams.update({
        "font.family": "DejaVu Sans",
        "axes.spines.top": False,
        "axes.spines.right": False,
    })

    # ── Panel A: top-N by bias paper count, coloured by over/under-representation
    top_bias = df[df["bias_papers"] > 0].head(TOP_N).copy()
    top_bias["color"] = top_bias["bias_share_pct"].apply(
        lambda x: DOMAIN_COLORS["over"] if (x is not None and x > mu)
                  else (DOMAIN_COLORS["na"] if x is None else DOMAIN_COLORS["under"])
    )

    # ── Panel B: top-N by share % (countries with ≥3 bias papers to reduce noise)
    top_share = (
        df[(df["bias_papers"] >= 3) & df["bias_share_pct"].notna()]
        .sort_values("bias_share_pct", ascending=False)
        .head(TOP_N)
        .copy()
    )
    top_share["color"] = top_share["bias_share_pct"].apply(
        lambda x: DOMAIN_COLORS["over"] if x > mu else DOMAIN_COLORS["under"]
    )

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    fig.suptitle(
        "Regional Representation in AI Bias Research (2015–2024)\n"
        "Normalized against total AI publication volume (OpenAlex)",
        fontsize=13, fontweight="bold", y=1.02
    )

    # — Panel A
    ax = axes[0]
    y  = np.arange(len(top_bias))
    bars = ax.barh(y, top_bias["bias_papers"], color=top_bias["color"].tolist(),
                   edgecolor="white", linewidth=0.4)
    ax.set_yticks(y)
    ax.set_yticklabels(top_bias["country"], fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("Bias papers in corpus", fontsize=10)
    ax.set_title(f"Top {TOP_N} countries by bias paper count\n"
                 f"(teal = share above mean {mu:.3f}%, red = below)", fontsize=10)
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}"))

    # annotate share %
    for i, (_, row) in enumerate(top_bias.iterrows()):
        share = row["bias_share_pct"]
        label = f"{share:.3f}%" if share is not None else "N/A"
        ax.text(row["bias_papers"] + max(top_bias["bias_papers"]) * 0.01,
                i, label, va="center", fontsize=7.5, color="#333333")

    # — Panel B
    ax2 = axes[1]
    y2  = np.arange(len(top_share))
    ax2.barh(y2, top_share["bias_share_pct"], color=top_share["color"].tolist(),
             edgecolor="white", linewidth=0.4)
    ax2.axvline(mu, color="#333333", linewidth=1.0, linestyle="--", label=f"Mean ({mu:.3f}%)")
    ax2.set_yticks(y2)
    ax2.set_yticklabels(top_share["country"], fontsize=9)
    ax2.invert_yaxis()
    ax2.set_xlabel("Bias research share (% of total AI papers)", fontsize=10)
    ax2.set_title(f"Top {TOP_N} countries by normalized bias research share\n"
                  f"(≥3 bias papers; dashed = global mean)", fontsize=10)
    ax2.legend(fontsize=8)
    ax2.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.3f}%"))

    plt.tight_layout()
    out = FIGURES_DIR / "regional_normalization.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Figure saved: {out}")

    # ── Scatter: log(total AI papers) vs bias share % ──────────────────────────
    df_scatter = df[(df["total_ai_papers"] > 0) & df["bias_share_pct"].notna()].copy()

    fig2, ax3 = plt.subplots(figsize=(10, 7))
    sc = ax3.scatter(
        np.log10(df_scatter["total_ai_papers"]),
        df_scatter["bias_share_pct"],
        c=df_scatter["bias_papers"],
        cmap="YlOrRd",
        s=60, alpha=0.8, edgecolors="gray", linewidth=0.3
    )
    cb = plt.colorbar(sc, ax=ax3)
    cb.set_label("Bias paper count", fontsize=9)

    ax3.axhline(mu, color="#333333", linewidth=1.0, linestyle="--",
                label=f"Mean share ({mu:.3f}%)")
    ax3.set_xlabel("Total AI publications (log₁₀ scale)", fontsize=11)
    ax3.set_ylabel("Bias research share (% of total AI papers)", fontsize=11)
    ax3.set_title("AI Output vs. Bias Research Share by Country (2015–2024)",
                  fontsize=12, fontweight="bold")
    ax3.legend(fontsize=9)
    ax3.spines[["top","right"]].set_visible(False)

    # Label notable countries
    highlight = {"USA", "China", "United Kingdom", "India", "Germany",
                 "South Korea", "Brazil", "South Africa", "Nigeria", "Nepal"}
    for _, r in df_scatter[df_scatter["country"].isin(highlight)].iterrows():
        ax3.annotate(r["country"],
                     xy=(np.log10(r["total_ai_papers"]), r["bias_share_pct"]),
                     xytext=(4, 2), textcoords="offset points",
                     fontsize=7.5, color="#222222")

    plt.tight_layout()
    out2 = FIGURES_DIR / "regional_normalization_scatter.png"
    plt.savefig(out2, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Scatter saved: {out2}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ai_counts   = fetch_ai_counts_by_country()
    bias_counts = count_bias_papers_by_country()

    print("Building comparison table...")
    df, mu, sigma = build_table(ai_counts, bias_counts)
    df.to_csv(OUT_CSV, index=False, quoting=csv.QUOTE_ALL)
    print(f"CSV saved: {OUT_CSV}")
    print(f"\nGlobal mean bias share: {mu:.4f}%  (σ={sigma:.4f}%)")
    print(f"\nTop 15 countries by bias paper count:")
    print(df[["country","total_ai_papers","bias_papers","bias_share_pct","share_zscore"]]
          .head(15).to_string(index=False))

    print("\nMost over-represented (z-score > 1):")
    over = df[(df["share_zscore"] > 1) & (df["bias_papers"] >= 3)].sort_values(
        "share_zscore", ascending=False)
    print(over[["country","total_ai_papers","bias_papers","bias_share_pct","share_zscore"]]
          .head(10).to_string(index=False))

    print("\nMost under-represented (below global mean, ≥50 AI papers, sorted by AI output):")
    under = df[
        (df["bias_share_pct"].notna()) &
        (df["bias_share_pct"] < mu) &
        (df["total_ai_papers"] >= 50)
    ].sort_values("total_ai_papers", ascending=False)
    print(under[["country","total_ai_papers","bias_papers","bias_share_pct","share_zscore"]]
          .head(15).to_string(index=False))

    # Also show zero-bias large AI producers
    print("\nLarge AI producers with ZERO bias papers (≥1000 AI papers):")
    zero_bias = df[(df["bias_papers"] == 0) & (df["total_ai_papers"] >= 1000)].sort_values(
        "total_ai_papers", ascending=False)
    print(zero_bias[["country","total_ai_papers","bias_papers"]].head(15).to_string(index=False))

    plot_normalization(df, mu, sigma)
    print("\nDone.")
