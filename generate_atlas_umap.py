"""
Generate UMAP embeddings (2D + 3D) + HDBSCAN clusters for the Bias Research Atlas.
Output: dashboard/public/atlas_data.csv
"""

import csv
from collections import Counter
import numpy as np

print("Loading data…")

# ── 1. Load papers_new.csv (domain, title, DOI, year, authors, regions)
papers = {}
with open("evaluation/analysis/papers_new.csv") as f:
    for row in csv.DictReader(f):
        sn = row["SN"].strip()
        papers[sn] = {
            "SN": sn,
            "title": row.get("Paper Title", "").strip(),
            "DOI": row.get("DOI", "").strip(),
            "domain": row.get("Domain", "").strip(),
            "year": row.get("Year", "").strip(),
            "authors": row.get("Authors", "").strip(),
            "author_regions": row.get("Author Regions", "").strip(),
        }

# ── 2. Load openalex_enriched.csv
enriched = {}
with open("openalex_enriched.csv") as f:
    for row in csv.DictReader(f):
        sn = row["SN"].strip()
        enriched[sn] = {
            "abstract": row.get("abstract", "").strip(),
            "keywords": row.get("keywords", "").strip(),
            "cited_by_count": row.get("cited_by_count", "0").strip() or "0",
            "is_oa": row.get("is_oa", "").strip(),
            "oa_status": row.get("oa_status", "").strip(),
            "oa_url": row.get("oa_url", "").strip(),
            "openalex_countries": row.get("openalex_countries", "").strip(),
            "openalex_authors": row.get("openalex_authors", "").strip(),
        }

# ── 3. Merge
merged = []
for sn, p in papers.items():
    e = enriched.get(sn, {})
    abstract = e.get("abstract", "")
    keywords = e.get("keywords", "")
    title = p["title"]
    # Use abstract only (consistent with semantic_similarity.py analysis)
    # Papers without abstracts (SNs 1, 362, 387) are excluded from embedding
    if not abstract:
        continue
    # embed_text = f"{title}. {abstract}" if abstract else (f"{title}. Keywords: {keywords}" if keywords else title)  # previous: title+abstract
    merged.append({
        "SN": sn,
        "title": title,
        "DOI": p["DOI"],
        "domain": p["domain"],
        "year": p["year"],
        "authors": p["authors"],
        "author_regions": p["author_regions"],
        "abstract": abstract,
        "keywords": keywords,
        "cited_by_count": int(e.get("cited_by_count", "0") or "0"),
        "is_oa": e.get("is_oa", ""),
        "oa_status": e.get("oa_status", ""),
        "oa_url": e.get("oa_url", ""),
        "openalex_countries": e.get("openalex_countries", ""),
        "openalex_authors": e.get("openalex_authors", ""),
        "embed_text": abstract,  # previously: embed_text
    })

print(f"Merged {len(merged)} papers. {sum(1 for m in merged if m['abstract'])} have abstracts.")

# ── 4. Sentence embeddings (3 models) + 2D UMAP per model
from sentence_transformers import SentenceTransformer
import umap

EMBED_MODELS = [
    ("all-mpnet-base-v2", "mpnet"),    # best domain separation — used as default
    ("all-MiniLM-L6-v2",  "minilm"),
    ("allenai-specter",    "specter"),
]

texts = [m["embed_text"] for m in merged]
all_coords_2d: dict[str, np.ndarray] = {}
all_coords_3d: dict[str, np.ndarray] = {}
all_embeddings: dict[str, np.ndarray] = {}

for model_id, key in EMBED_MODELS:
    print(f"Encoding with {model_id}…")
    sbert = SentenceTransformer(model_id)
    emb = sbert.encode(texts, show_progress_bar=True, batch_size=32, normalize_embeddings=True)
    print(f"  Embeddings: {emb.shape}")
    all_embeddings[key] = emb

    print(f"  UMAP 2D ({key})…")
    r2 = umap.UMAP(n_components=2, n_neighbors=10, min_dist=0.0, metric="cosine", random_state=42)
    c2 = r2.fit_transform(emb)
    all_coords_2d[key] = c2
    print(f"    X[{c2[:,0].min():.2f},{c2[:,0].max():.2f}] Y[{c2[:,1].min():.2f},{c2[:,1].max():.2f}]")

    print(f"  UMAP 3D ({key})…")
    r3 = umap.UMAP(n_components=3, n_neighbors=10, min_dist=0.0, metric="cosine", random_state=42)
    c3 = r3.fit_transform(emb)
    all_coords_3d[key] = c3
    print(f"  3D done.")

# Default 2D + 3D = mpnet
coords_2d  = all_coords_2d["mpnet"]
coords_3d  = all_coords_3d["mpnet"]
embeddings = all_embeddings["mpnet"]

# ── 7. HDBSCAN clustering (on 2D coords for stability)
from sklearn.cluster import HDBSCAN
print("HDBSCAN clustering…")
hdb = HDBSCAN(min_cluster_size=10, min_samples=3, metric="euclidean")
cluster_ids = hdb.fit_predict(coords_2d)
n_clusters = len(set(cluster_ids)) - (1 if -1 in cluster_ids else 0)
n_noise = (cluster_ids == -1).sum()
print(f"  {n_clusters} clusters, {n_noise} noise points")

# ── 8. Auto-label clusters from top keywords
STOP_TERMS = {
    "computer science", "political science", "machine learning", "data science",
    "artificial intelligence", "biology", "engineering", "statistics",
    "management science", "knowledge management", "economics", "philosophy",
}
cluster_labels: dict[int, str] = {}
for c in sorted(set(cluster_ids)):
    if c < 0:
        cluster_labels[c] = "Unclustered"
        continue
    kw_list = []
    for i, m in enumerate(merged):
        if cluster_ids[i] != c:
            continue
        for k in (m.get("keywords") or "").split(";"):
            k = k.strip()
            if k and k.lower() not in STOP_TERMS and len(k) > 3:
                kw_list.append(k)
    if kw_list:
        top = [k for k, _ in Counter(kw_list).most_common(3)]
        cluster_labels[c] = " · ".join(top[:2])
    else:
        cluster_labels[c] = f"Cluster {c}"

# ── 9. Write atlas_data.csv
out_path = "dashboard/public/atlas_data.csv"
fieldnames = [
    "SN", "title", "DOI", "domain", "year",
    "authors", "author_regions", "abstract", "keywords",
    "cited_by_count", "is_oa", "oa_status", "oa_url",
    "openalex_countries", "openalex_authors",
    "umap_x", "umap_y",                          # default (mpnet)
    "umap_x_mpnet", "umap_y_mpnet",
    "umap_x_minilm", "umap_y_minilm",
    "umap_x_specter", "umap_y_specter",
    "umap_x3", "umap_y3", "umap_z3",             # default 3D (mpnet)
    "umap_x3_mpnet", "umap_y3_mpnet", "umap_z3_mpnet",
    "umap_x3_minilm", "umap_y3_minilm", "umap_z3_minilm",
    "umap_x3_specter", "umap_y3_specter", "umap_z3_specter",
    "cluster", "cluster_label",
]

with open(out_path, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for i, m in enumerate(merged):
        row = {k: m.get(k, "") for k in fieldnames}
        row["umap_x"]  = round(float(coords_2d[i, 0]), 5)
        row["umap_y"]  = round(float(coords_2d[i, 1]), 5)
        for key in ("mpnet", "minilm", "specter"):
            row[f"umap_x_{key}"]  = round(float(all_coords_2d[key][i, 0]), 5)
            row[f"umap_y_{key}"]  = round(float(all_coords_2d[key][i, 1]), 5)
            row[f"umap_x3_{key}"] = round(float(all_coords_3d[key][i, 0]), 5)
            row[f"umap_y3_{key}"] = round(float(all_coords_3d[key][i, 1]), 5)
            row[f"umap_z3_{key}"] = round(float(all_coords_3d[key][i, 2]), 5)
        row["umap_x3"] = round(float(coords_3d[i, 0]), 5)
        row["umap_y3"] = round(float(coords_3d[i, 1]), 5)
        row["umap_z3"] = round(float(coords_3d[i, 2]), 5)
        row["cluster"]       = int(cluster_ids[i])
        row["cluster_label"] = cluster_labels[int(cluster_ids[i])]
        w.writerow(row)

print(f"\n✅  Wrote {len(merged)} rows → {out_path}")
print("\nCluster labels:")
for c, lbl in sorted(cluster_labels.items()):
    count = (cluster_ids == c).sum()
    print(f"  [{c:2d}] {count:3d}  {lbl}")
