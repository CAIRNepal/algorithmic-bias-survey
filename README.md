# 🧠 BiasAtlas — an interactive atlas of AI bias research

**Live atlas:** [https://biasatlas.cair-nepal.org](https://biasatlas.cair-nepal.org).&nbsp; **Companion paper:** *Whose fairness? Structural concentration in the foundations of AI bias research*

BiasAtlas is an interactive, continuously updatable map of the AI bias research
landscape. It lets anyone explore who produces research on AI bias, where, in
collaboration with whom, and on which themes — and to track how that structure
shifts over time. The atlas accompanies our study of 692 publications
(2012–2026) and turns a static bibliometric snapshot into a living resource the
community can browse, query, and contribute to.

This work is part of [_**Bridging Minds and Machines: Human Perspectives and Responsible AI for an Inclusive Future**_](https://www.cair-nepal.org/research/projects/bridging-minds-and-machines-human-perspectives-and-responsible-ai-for-an-inclusive-future/) project.

**Authors**: Abhash Shrestha, Subigya Gautam, Anu Sapkota, Sanju Tiwari and Tek Raj Chhetri


---

## What you can explore

- **Semantic map of the field** — a UMAP projection of Sentence-BERT abstract
  embeddings, coloured by thematic domain, so related work sits together.
- **Five thematic domains** — General Fairness & Bias Mitigation, Health &
  Clinical AI, LLMs & NLP, Recommender Systems, and Graph-Based Fairness & Bias
  Mitigation.
- **Geographic & institutional structure** — country- and institution-level
  contributions, distinguishing participation (all-author) from leadership
  (first-author).
- **Collaboration network** — co-authorship structure and within- versus
  cross-region collaboration.
- **Citation dynamics** — within-corpus and global (OpenAlex) citation
  influence per domain and per paper.
- **Temporal evolution** — how volume and thematic focus have changed year on
  year.
- **Continuously growing corpus** — new publications are added over time to
  keep the atlas current (see [Contributing](#contributing) to nominate one).




## 📄 Citation

If you use BiasAtlas or the underlying corpus, please cite:

```bibtex
@article{shrestha_biasatlas,
  title   = {Whose fairness? Structural concentration in the foundations of AI bias research},
  author  = {Shrestha, Abhash and Gautam, Subigya and Sapkota, Anu and Tiwari, Sanju and Chhetri, Tek Raj},
  year    = {2026},
  note    = {Interactive atlas: https://biasatlas.cair-nepal.org},
}
```

## Authors

- **Abhash Shrestha** — Center for AI Research (CAIR) Nepal *(corresponding)*
- **Subigya Gautam** — Center for AI Research (CAIR) Nepal
- **Anu Sapkota** — Center for AI Research (CAIR) Nepal
- **Sanju Tiwari** — Sharda University, Delhi-NCR; Shodhguru Innovation and Research Labs
- **Tek Raj Chhetri** — Center for AI Research (CAIR) Nepal; McGovern Institute for Brain Research, MIT *(corresponding | Supervisor)*

**Contact:** abhash.shrestha@cair-nepal.org · tekraj.chhetri@cair-nepal.org

## Contributing

Contributions are welcome — to nominate a publication for the corpus, open an issue with the paper's title, DOI, and thematic domain. To add papers yourself and open a PR, or to contribute code/pipeline changes, see [CONTRIBUTING.md](CONTRIBUTING.md) for the step-by-step process and common pitfalls.

## 📜 License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). 
