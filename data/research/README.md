# Holdem Lab research data

This directory contains planning-stage research registries. It is not runtime
strategy data and it is not evidence that any third-party content has been
licensed, downloaded, reviewed, or published.

## Files

- `poker_knowledge_sources.json` records rules, datasets, specifications,
  research papers, open-source tools, safety guidance, and platform-integrity
  policies.
- `poker_training_products.json` records direct competitors and learning-product
  analogues as a dated market snapshot.

## Evidence rules

Every knowledge-source record states:

- what the source can support;
- what it cannot support;
- its authority tier;
- its rights status;
- the only currently permitted project use;
- the last date on which the official source was checked.

`candidate_import` means “worth evaluating.” It does not mean “approved for
production.” Before any remote asset enters `data/content`, `data/exercises`,
`data/strategy`, fixtures, or a database mirror, the project must:

1. identify the exact asset and upstream version;
2. verify rights at the asset level, including embedded or aggregated data;
3. download a reproducible snapshot;
4. record its SHA-256 digest and retrieval date;
5. run domain and factual review;
6. assign a publication status separately from its rights status.

An open-source repository license may cover code and documentation without
covering every third-party hand history or media item collected by that
repository. Mixed datasets therefore remain blocked until their component
provenance is reviewed.

## Authority tiers

- `A_primary`: official rules, standards, first-party policies, or canonical
  project repositories.
- `B_peer_reviewed`: peer-reviewed research or its authoritative index.
- `C_industry_primary`: first-party product claims, pricing, or documentation.
- `D_community_signal`: qualitative discovery only; never a strategy or market
  statistic.

## Usage statuses

- `link_and_cite`: summarize conservatively and link; do not copy the source.
- `candidate_import`: eligible for a separate rights, integrity, and review
  workflow.
- `cross_check_only`: use as an independent test/reference implementation, not
  as the product's runtime authority.
- `research_only`: inspect for planning or R&D; do not publish its outputs as a
  Holdem Lab baseline.
- `do_not_copy`: license or provenance is incompatible with the intended
  product path; clean-room study of underlying public research may still be
  possible.

Run `npm run validate:research` after editing either registry.
