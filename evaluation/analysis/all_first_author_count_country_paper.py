#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Country-wise bar charts: Authors vs Papers (All Authors AND First Author).

- Canonicalizes country names (USA/UK/etc.)
- All-authors variant: authors counted as UNIQUE people by default (toggle)
- First-author variant: each paper contributes once (by first author's country)
- Papers counted once per country (unique SN per country)
- Plot Top-N countries or ALL (TOP=None)
- Improved visuals + larger fonts for All-Authors charts

Outputs (in ./figures):
  - country_authors_papers_summary_all_<mode>.csv
  - bar_country_authors_papers_all_<mode>.png/.pdf
  - country_authors_papers_summary_first.csv
  - bar_country_authors_papers_first.png/.pdf
"""

import os, re
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from textwrap import wrap
import seaborn as sns
from pathlib import Path

plt.style.use('seaborn-v0_8')
sns.set_palette("husl")
plt.rcParams.update({
    'font.size': 12,
    'font.family': 'serif',
    'figure.dpi': 300,
    'savefig.dpi': 300
})
# ---------------- Config ----------------
BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "papers_new.csv"
# INPUT_CSV = "papers.csv" 
OUT_DIR   = BASE_DIR / "figures_new"
os.makedirs(OUT_DIR, exist_ok=True)

TOP = 15                       # show top N countries; remainder bucketed as "Other"
KEEP_GLOBAL = False            # drop "Global" bucket by default
COUNT_UNIQUE_AUTHORS = True     # True = unique people per country, False = all author rows (ALL-AUTHORS variant)
SHOW_RATIO_LINE = False        # overlay Authors-per-Paper on a secondary axis

# Font sizes (ALL AUTHORS only gets larger fonts)
ALL_AUTHORS_SIZES = dict(
    title=18, axis=15, ticks=13, values=11, legend=13
)
FIRST_AUTHOR_SIZES = dict(
    title=14, axis=14, ticks=13, values=9, legend=11
)

# tokens treated as empty/unknown (case-insensitive)
_EMPTY_TOKENS = {"", "nan", "none", "null", "na", "n/a", "-"}

# ---------------- Country canonicalization ----------------
def _preclean_country(s) -> str:
    if s is None:
        return ""
    if isinstance(s, float) and np.isnan(s):
        return ""
    s = str(s).strip()
    if s.lower() in _EMPTY_TOKENS:
        return ""
    s = s.replace("’", "'").replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[,\.;:\s]+$", "", s)
    return s

COUNTRY_MAP = {
    # USA
    r"\bu\.?s\.?a\.?\b|\bu\.?s\.?\b|\bunited states( of america)?\b": "USA",
    # UK
    r"\bu\.?k\.?\b|\bunited kingdom\b|\bgreat britain\b|\bbritain\b|\bengland\b|\bscotland\b|\bwales\b|\bnorthern ireland\b": "UK",
    # China & regions
    r"\bpeople'?s republic of china\b|\bprc\b|\bchina\b(?!.*hong\s*kong)": "China",
    r"\bhong\s*kong(\s*sar)?(,\s*china)?\b": "Hong Kong",
    r"\btaiwan\b|republic of china": "Taiwan",
    # Korea
    r"\brepublic of korea\b|\bkorea(?!.*north)\b|\bsouth korea\b": "South Korea",
    r"\bnorth korea\b|\bdprk\b": "North Korea",
    # Middle East
    r"\buae\b|\bunited arab emirates\b": "United Arab Emirates",
    r"\bsaudi arabia\b|kingdom of saudi arabia": "Saudi Arabia",
    # Europe normalizations
    r"\bthe netherlands\b|\bholland\b|\bnetherlands\b": "Netherlands",
    r"\bczech republic\b|\bczechia\b": "Czechia",
    r"\brussian federation\b": "Russia",
    r"\bcôte d['’]ivoire\b|\bcote d['’]ivoire\b|\bivory coast\b": "Côte d’Ivoire",
    # Non-country catch-all
    r"\bglobal\b|\bworldwide\b|\binternational\b": "Global",
}
_COMPILED_COUNTRY = [(re.compile(pat, re.I), canon) for pat, canon in COUNTRY_MAP.items()]

def canonicalize_country(s) -> str | None:
    s = _preclean_country(s)
    if not s:
        return None
    low = s.lower()
    for rx, canon in _COMPILED_COUNTRY:
        if rx.search(low):
            return canon
    return s  # keep as provided (e.g., "Canada")

# ---------------- Helpers ----------------
def split_semicol(s):
    items = [x.strip() for x in str(s).split(";")]
    return [x for x in items if x and x.lower() not in _EMPTY_TOKENS]

def wrap_label(lbl, width=14):
    return "\n".join(wrap(str(lbl), width=width, break_long_words=False, break_on_hyphens=False))

def style_axes(ax):
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

def add_value_labels(ax, bars, fs: int):
    for bar in bars:
        h = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width()/2,
            h + max(1, 0.01*h),
            f"{int(h):,}",
            ha="center", va="bottom", fontsize=fs
        )

def _needs_broken_axis(S, authors_col, papers_col, threshold=2.5):
    """Check if the largest value dwarfs the second-largest enough to warrant a broken axis."""
    all_vals = sorted(
        list(S[authors_col].to_numpy()) + list(S[papers_col].to_numpy()),
        reverse=True
    )
    if len(all_vals) < 2:
        return False, 0, 0
    top, second = all_vals[0], all_vals[1]
    if second == 0:
        return False, 0, 0
    return (top / second) >= threshold, top, second


def plot_summary_bar(
    summary: pd.DataFrame,
    out_png: str,
    out_pdf: str,
    title: str,
    sizes: dict,                  # <-- pass font sizes here
    authors_col="Authors",
    papers_col="Papers",
):
    # Order & Top-N with "Other" bucket for remainder
    S = summary.sort_values([papers_col, authors_col], ascending=[False, False])
    if TOP is not None and len(S) > TOP:
        top_s  = S.head(TOP)
        rest   = S.iloc[TOP:]
        other  = pd.DataFrame(
            {authors_col: [rest[authors_col].sum()], papers_col: [rest[papers_col].sum()]},
            index=["Other"]
        )
        S = pd.concat([top_s, other])

    if S.empty:
        print("No data to plot.")
        return

    labels = S.index.tolist()
    x = np.arange(len(S))
    width = 0.42

    # Check if we need a broken y-axis
    do_break, top_val, second_val = _needs_broken_axis(S, authors_col, papers_col)

    # Figure size scales with #countries
    fig_w = max(10, 0.42 * len(S))
    fig_h = 7 if (TOP is not None or len(S) <= 25) else max(7, 0.36 * len(S))

    if do_break:
        # Broken y-axis: bottom shows 0 to break_low, top shows break_high to top_val
        break_low = int(second_val * 1.25)
        break_high = int(top_val * 0.85)

        fig, (ax_top, ax_bot) = plt.subplots(
            2, 1, sharex=True, figsize=(fig_w, fig_h + 2),
            gridspec_kw={'height_ratios': [1, 3], 'hspace': 0.06}
        )

        # Plot bars on both axes
        for ax in [ax_top, ax_bot]:
            b1 = ax.bar(x - width/2, S[authors_col].to_numpy(), width, label="Authors")
            b2 = ax.bar(x + width/2, S[papers_col].to_numpy(),  width, label="Papers")

        # Set y-limits
        ax_top.set_ylim(break_high, top_val * 1.12)
        ax_bot.set_ylim(0, break_low)

        # Add value labels on appropriate axis
        for i, (auth_val, pap_val) in enumerate(zip(S[authors_col], S[papers_col])):
            for val, offset in [(auth_val, -width/2), (pap_val, width/2)]:
                target_ax = ax_top if val > break_high else ax_bot
                target_ax.text(
                    x[i] + offset, val + max(1, 0.01 * val),
                    f"{int(val):,}", ha="center", va="bottom", fontsize=sizes["values"]
                )

        # Draw break marks
        d = 0.012
        kwargs = dict(transform=ax_top.transAxes, color='k', clip_on=False, linewidth=1)
        ax_top.plot((-d, +d), (0 - d, 0 + d), **kwargs)
        ax_top.plot((1 - d, 1 + d), (0 - d, 0 + d), **kwargs)
        kwargs.update(transform=ax_bot.transAxes)
        ax_bot.plot((-d, +d), (1 - d, 1 + d), **kwargs)
        ax_bot.plot((1 - d, 1 + d), (1 - d, 1 + d), **kwargs)

        # Hide spines at the break
        ax_top.spines['bottom'].set_visible(False)
        ax_bot.spines['top'].set_visible(False)
        ax_top.tick_params(bottom=False)

        # Style both axes
        for ax in [ax_top, ax_bot]:
            style_axes(ax)
            ax.tick_params(axis="y", labelsize=sizes["ticks"])
            ax.margins(x=0.01)

        # X labels on bottom axis only
        wrapped = [wrap_label(lbl, width=14) for lbl in labels]
        ax_bot.set_xticks(x)
        rot = 25 if len(S) <= 25 else 45
        ha = "center" if rot == 0 else "right"
        ax_bot.set_xticklabels(wrapped, rotation=rot, ha=ha, fontsize=sizes["ticks"])

        ax_bot.set_xlabel("Country", fontsize=sizes["axis"])
        # Shared y-label
        fig.text(0.01, 0.5, "Count", va='center', rotation='vertical', fontsize=sizes["axis"])

        ax_top.legend(frameon=False, fontsize=sizes["legend"])
        # Remove duplicate legend on bottom
        ax_bot.get_legend().remove() if ax_bot.get_legend() else None

        ax = ax_bot  # for tight_layout reference
    else:
        fig, ax = plt.subplots(figsize=(fig_w, fig_h))

        # Bars
        b1 = ax.bar(x - width/2, S[authors_col].to_numpy(), width, label="Authors")
        b2 = ax.bar(x + width/2, S[papers_col].to_numpy(),  width, label="Papers")

        add_value_labels(ax, b1, fs=sizes["values"])
        add_value_labels(ax, b2, fs=sizes["values"])

        # X labels (wrap, rotate if many)
        wrapped = [wrap_label(lbl, width=14) for lbl in labels]
        ax.set_xticks(x)
        rot = 25 if len(S) <= 25 else 45
        ha  = "center" if rot == 0 else "right"
        ax.set_xticklabels(wrapped, rotation=rot, ha=ha, fontsize=sizes["ticks"])

        ax.set_ylabel("Count", fontsize=sizes["axis"])
        ax.set_xlabel("Country", fontsize=sizes["axis"])
        style_axes(ax)

        # Secondary axis: Authors per Paper (optional)
        if SHOW_RATIO_LINE:
            with np.errstate(divide="ignore", invalid="ignore"):
                ratio = S[authors_col] / S[papers_col].replace(0, np.nan)
            ax2 = ax.twinx()
            ax2.plot(x, ratio, marker="o", linewidth=1.5, label="Authors per Paper")
            ax2.set_ylabel("Authors per Paper", fontsize=sizes["axis"])
            ax2.tick_params(axis="y", labelsize=sizes["ticks"])
            ax2.margins(x=0.01)
            rmax = np.nanmax(ratio.to_numpy())
            if np.isfinite(rmax):
                ax2.set_ylim(0, max(1.5, rmax * 1.25))
            lines, labels_leg = [], []
            for a in [ax, ax2]:
                h, l = a.get_legend_handles_labels()
                lines += h; labels_leg += l
            ax.legend(lines, labels_leg, loc="upper right", frameon=False, fontsize=sizes["legend"])
        else:
            ax.legend(frameon=False, fontsize=sizes["legend"])

        ax.tick_params(axis="y", labelsize=sizes["ticks"])
        ax.margins(x=0.01)
        ymax = max(S[authors_col].max(), S[papers_col].max())
        ax.set_ylim(0, ymax * 1.15 + 1)

    fig.tight_layout()
    fig.savefig(out_png, dpi=300, bbox_inches="tight")
    fig.savefig(out_pdf, dpi=300, bbox_inches="tight")
    # plt.show()
    plt.close(fig)
    print("Saved:", out_png)
    print("Saved:", out_pdf)

# ---------------- Build ALL-AUTHORS summary ----------------
def build_all_authors(df: pd.DataFrame) -> pd.DataFrame:
    if "SN" not in df.columns:
        df["SN"] = np.arange(1, len(df) + 1)

    focus_clean = (
        df.get("Focus Region", "Unknown")
          .fillna("Unknown").astype(str).str.strip()
          .replace(list(_EMPTY_TOKENS), "Unknown")
    )

    authors_list = df.get("Authors", "").fillna("").astype(str).map(split_semicol)
    regions_raw  = df.get("Author Regions", "").fillna("").astype(str).map(split_semicol)

    def align_regions(row):
        regs = [r if r else row["__focus"] for r in row["__regions_raw"]]
        auths = row["__authors"]
        if len(regs) < len(auths):
            regs += [row["__focus"]] * (len(auths) - len(regs))
        else:
            regs = regs[:len(auths)]
        return regs

    tmp = pd.DataFrame({
        "__authors": authors_list,
        "__regions_raw": regions_raw,
        "__focus": focus_clean,
        "SN": df["SN"].values,
    })
    tmp["__countries"] = tmp.apply(align_regions, axis=1)

    dfe = (
        tmp[["SN", "__authors", "__countries"]]
          .explode(["__authors", "__countries"], ignore_index=True)
          .rename(columns={"__authors": "Author", "__countries": "Country"})
    )

    dfe["Country"] = dfe["Country"].map(canonicalize_country)
    valid = (dfe["Author"].astype(str).str.len() > 0) & dfe["Country"].notna()
    dfe = dfe[valid]
    bad_bucket = dfe["Country"].astype(str).str.strip().str.lower().isin(_EMPTY_TOKENS | {"unknown"})
    dfe = dfe[~bad_bucket]
    if not KEEP_GLOBAL:
        dfe = dfe[dfe["Country"] != "Global"]

    # Metrics per country
    if COUNT_UNIQUE_AUTHORS:
        authors_count = dfe.groupby("Country")["Author"].nunique().rename("Authors")
        mode_suffix = "unique"
    else:
        authors_count = dfe.groupby("Country")["Author"].size().rename("Authors")  # all rows
        mode_suffix = "rows"

    papers_count = (
        dfe.drop_duplicates(subset=["SN", "Country"])
           .groupby("Country")["SN"].nunique()
           .rename("Papers")
    )

    summary = (
        pd.concat([authors_count, papers_count], axis=1)
          .fillna(0).astype(int)
          .sort_values(["Papers", "Authors"], ascending=[False, False])
    )

    out_csv = os.path.join(OUT_DIR, f"country_authors_papers_summary_all_{mode_suffix}.csv")
    summary.to_csv(out_csv, index=True)
    print("Saved:", out_csv)

    # Per-author summary: papers count, countries, is_repeat
    author_summary = (
        dfe.groupby("Author")
           .agg(
               Papers=("SN", "nunique"),
               Countries=("Country", lambda x: "; ".join(sorted(x.dropna().unique())))
           )
           .reset_index()
           .sort_values("Papers", ascending=False)
    )
    author_summary["repeat"] = author_summary["Papers"] > 1
    n_unique = len(author_summary)
    n_repeat = author_summary["repeat"].sum()
    print(f"   Unique authors: {n_unique}  |  Appearing in >1 paper: {n_repeat} ({100*n_repeat/n_unique:.1f}%)")
    out_author_csv = os.path.join(OUT_DIR, "author_frequency.csv")
    author_summary.to_csv(out_author_csv, index=False)
    print("Saved:", out_author_csv)

    scope = "All" if TOP is None else f"Top {TOP}"
    mode  = "Unique Authors" if COUNT_UNIQUE_AUTHORS else "All Author Rows"
    out_png = os.path.join(OUT_DIR, f"bar_country_authors_papers_all_{mode_suffix}.png")
    out_pdf = os.path.join(OUT_DIR, f"bar_country_authors_papers_all_{mode_suffix}.pdf")
    title   = f"Country-wise: Authors and Papers (All Authors • {scope} • {mode})"
    plot_summary_bar(summary, out_png, out_pdf, title, sizes=ALL_AUTHORS_SIZES)
    return summary

# ---------------- Build FIRST-AUTHOR summary ----------------
def build_first_author(df: pd.DataFrame) -> pd.DataFrame:
    if "SN" not in df.columns:
        df["SN"] = np.arange(1, len(df) + 1)

    authors_first = (
        df.get("Authors", "")
          .fillna("")
          .astype(str)
          .str.split(";").str[0].str.strip()
    )
    regions_first = (
        df.get("Author Regions", "")
          .fillna("")
          .astype(str)
          .str.split(";").str[0].str.strip()
    )
    focus_clean = (
        df.get("Focus Region", "Unknown")
          .fillna("Unknown").astype(str).str.strip()
          .replace(list(_EMPTY_TOKENS), "Unknown")
    )

    valid_region = ~regions_first.str.strip().str.lower().isin(_EMPTY_TOKENS)
    country_raw = np.where(valid_region, regions_first, focus_clean)

    dfa = pd.DataFrame({
        "SN": df["SN"].values,
        "FirstAuthor": authors_first.values,
        "Country": country_raw
    })

    dfa["Country"] = dfa["Country"].map(canonicalize_country)
    bad_country = dfa["Country"].isna() | dfa["Country"].astype(str).str.strip().str.lower().isin(_EMPTY_TOKENS | {"unknown"})
    dfa = dfa[(dfa["FirstAuthor"].astype(str).str.len() > 0) & ~bad_country].drop_duplicates(subset="SN")
    if not KEEP_GLOBAL:
        dfa = dfa[dfa["Country"] != "Global"]

    n_authors = dfa.groupby("Country")["FirstAuthor"].nunique().rename("Authors")
    n_papers  = dfa.groupby("Country")["SN"].nunique().rename("Papers")

    summary = (
        pd.concat([n_authors, n_papers], axis=1)
          .fillna(0).astype(int)
          .assign(AuthorsPerPaper=lambda d: d["Authors"] / d["Papers"].replace(0, np.nan))
          .sort_values(["Papers", "Authors"], ascending=[False, False])
    )

    out_csv = os.path.join(OUT_DIR, "country_authors_papers_summary_first.csv")
    summary.to_csv(out_csv, index=True)
    print("Saved:", out_csv)

    scope  = "All" if TOP is None else f"Top {TOP}"
    out_png = os.path.join(OUT_DIR, "bar_country_authors_papers_first.png")
    out_pdf = os.path.join(OUT_DIR, "bar_country_authors_papers_first.pdf")
    title   = f"Country-wise: Authors and Papers (First Author • {scope})"
    plot_summary_bar(summary, out_png, out_pdf, title, sizes=FIRST_AUTHOR_SIZES)
    return summary

# ---------------- Run ----------------
if __name__ == "__main__":
    df = pd.read_csv(INPUT_CSV)
    _ = build_all_authors(df)   # larger fonts here
    _ = build_first_author(df)  # standard fonts here
