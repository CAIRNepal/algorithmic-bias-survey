---
license: cc-by-4.0
task_categories:
  - text-classification
  - other
tags:
  - bibliometrics
  - ai-fairness
  - algorithmic-bias
  - scientometrics
pretty_name: AI Bias Research Landscape
size_categories:
  - n<1K
---

# Dataset Card: AI Bias Research Landscape

## Dataset Summary

This dataset contains 692 curated bibliographic records of peer-reviewed and
preprint publications on artificial intelligence (AI) and algorithmic bias,
published between 2012 and 2026. Each record includes publication metadata
(paper title, DOI, authors, author regions, affiliations, publication year,
and research domain), author ORCID identifiers, and OpenAlex-derived
metadata, including OpenAlex IDs, citation counts, referenced works,
open-access status, and open-access URLs. Six records lack a DOI and
therefore do not contain OpenAlex-sourced identifiers, citation counts, or
open-access data; abstracts for these six records were curated manually
rather than retrieved from OpenAlex. The dataset is provided in CSV format.

This dataset is the underlying corpus for an interactive atlas of AI bias
research, available at **https://biasatlas.cair-nepal.org**, and for the
accompanying paper *"Whose fairness? Structural concentration in AI bias
research"* (under review).

## Dataset Structure

### Data Instances

Each row is one publication. The dataset has 692 rows and 21 columns.

### Data Fields

| Column | Description |
|---|---|
| `SN` | Sequential record identifier (1–692) |
| `Paper Title` | Title of the publication, as curated |
| `DOI` | Digital Object Identifier, as recorded during corpus curation (missing for 6 records) |
| `Authors` | Semicolon-separated author names, in publication order |
| `Author Regions` | Semicolon-separated author countries/regions, aligned by position with `Authors` |
| `Affiliations` | Semicolon-separated author institutional affiliations, aligned by position with `Authors` |
| `Year` | Publication year |
| `Domain` | Manually assigned thematic domain (one of five: General Fairness & Bias Mitigation, Health & Clinical AI, LLMs & NLP, Recommender Systems, Graph-Based Fairness & Bias Mitigation) |
| `Focus Region` | Primary geographic focus of the study, used as a fallback where `Author Regions` is unavailable |
| `Source` | Provenance tag for how the record was identified (e.g., `Original`, `FAccT`) |
| `ORC ID` | Semicolon-separated author ORCID identifiers, aligned by position with `Authors` (`N/A` where unavailable) |
| `corpus_doi` | DOI as originally recorded during corpus curation, used to match against OpenAlex |
| `openalex_id` | OpenAlex work identifier, where a matching record was found |
| `doi` | DOI as returned by the OpenAlex API for the matched record |
| `title` | Publication title as returned by OpenAlex (may differ slightly in formatting from `Paper Title`) |
| `year` | Publication year as returned by OpenAlex |
| `cited_by_count` | Total citation count from OpenAlex (all academic literature); 0 where no OpenAlex match exists |
| `abstract` | Paper abstract; retrieved via the OpenAlex API where available, manually curated for the 6 records with no OpenAlex match |
| `referenced_works` | Semicolon-separated OpenAlex work IDs cited by this paper, used to construct an internal citation network across the corpus |
| `is_oa` | Boolean open-access flag from OpenAlex |
| `oa_status` | Open-access status category from OpenAlex (e.g., `gold`, `green`, `closed`) |
| `oa_url` | URL to an open-access version of the paper, where available |

### Data Splits

No splits — the dataset is a single flat table.

## Dataset Creation

### Curation Rationale

The corpus was assembled to characterize the geographic, institutional, and
thematic structure of AI bias research — who produces it, where, and in
which application areas — rather than to catalogue bias-mitigation methods
themselves.

### Source Data

Records were identified by systematically querying IEEE Xplore, the ACM
Digital Library, Scopus, ScienceDirect, and Engineering Village, using
search strings centered on bias, artificial intelligence, and
decision-making. This was supplemented by citation snowballing (via
Connected Papers and Litmaps) and by directly searching the ACM Conference
on Fairness, Accountability, and Transparency (FAccT) proceedings, given the
venue's direct relevance to AI bias research.

Inclusion criteria required peer-reviewed status (or, for 69 records,
arXiv preprints — 10 of which are FAccT papers confirmed peer-reviewed) and
explicit focus on AI bias. The search was limited to publications from 2015
onward to ensure relevance to contemporary AI systems, with one exception:
Dwork et al. (2012), a foundational fairness paper identified through
citation snowballing and retained given its centrality to the field.

Each record was manually screened for topical relevance and assigned to one
of five thematic domains. Abstracts were retrieved via the OpenAlex API
where a DOI match existed; for the 6 records without a matching DOI,
abstracts were collected manually.

### Annotations

Thematic domain assignment (`Domain`) and geographic focus (`Focus Region`)
were assigned manually during corpus curation, not derived from an
automated classifier. A separate semantic-clustering analysis (SBERT
embeddings + UMAP + HDBSCAN) was used in the accompanying paper to validate
these manual domain assignments post hoc; domain labels were never used to
inform the clustering itself.

## Considerations for Using the Data

### Discussion of Biases and Limitations

- **Database and language coverage.** The corpus is drawn primarily from
  English-language, Global-North-indexed sources (IEEE Xplore, ACM Digital
  Library, Scopus, ScienceDirect, Engineering Village), supplemented with
  FAccT proceedings and citation snowballing. This sampling strategy likely
  under-represents research published in other languages, regional venues,
  and outlets not covered by major indexing services. Geographic
  disparities observed using this dataset cannot be fully disentangled from
  database coverage.
- **Domain labels are analytical groupings, not strict categories.**
  Semantic clustering shows substantial but incomplete correspondence with
  the five manually assigned domains; some overlap between domains should
  be expected.
- **Citation counts are a point-in-time snapshot** from the OpenAlex API at
  time of curation and will not reflect citations accrued afterward.
- **6 records have no DOI** and consequently no OpenAlex-sourced citation
  count, open-access status, or referenced-works data; their `abstract`
  field was populated manually rather than from OpenAlex.

### Personal and Sensitive Information

The dataset contains author names, affiliations, and ORCID identifiers —
all already public bibliographic information associated with the cited
publications. No additional personal data is included.

## Additional Information

### Licensing Information

CC-BY-4.0. *(Confirm this matches your intended license before publishing —
this reflects that the dataset is aggregated bibliographic metadata, not
full-text content, but you should verify this is what you want.)*

### Citation Information

```bibtex
@article{shrestha_whose_fairness,
  title   = {Whose fairness? Structural concentration in AI bias research},
  author  = {Shrestha, Abhash and Gautam, Subigya and Sapkota, Anu and Tiwari, Sanju and Chhetri, Tek Raj},
  journal = {Under review},
  year    = {2026}
}
```

### Links

- Interactive atlas / dashboard: https://biasatlas.cair-nepal.org
- Code repository: https://github.com/CAIRNepal/biasatlas

### Dataset Curators

Abhash Shrestha, Subigya Gautam, Anu Sapkota, Sanju Tiwari, Tek Raj Chhetri
— Center for Artificial Intelligence (AI) Research Nepal.
