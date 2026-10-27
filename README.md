# Holdem Lab

A local-first educational app for No-Limit Texas Hold'em: learn a concept,
practice with virtual chips, then review the decision and its original context.
English by default, with an independently authored Simplified Chinese edition.

**Early-stage, maintainer-led software.** No hosted service is promised by this repository. Virtual chips only,
no real money, live-table assistance, HUD, automated betting, prizes, or profit
claims. Strategy feedback is approximate, not verified solver output.

[中文说明](README.zh-CN.md) · [Product guide](docs/product.md) ·
[Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

## Run locally

Install **Ruby 4.0.2**, **Node 24.21.0**, Bundler, npm, and native build tools.
The versions are pinned in `.ruby-version` and `.nvmrc`.

```bash
git clone https://github.com/yorzi/holdem-lab.git
cd holdem-lab
bin/setup --skip-server
bin/dev
```

Open **http://127.0.0.1:3100**. Stop the foreground process group with **Ctrl-C**.
Setup installs locked dependencies, prepares SQLite, and imports/verifies the
content mirrors. No `.env`, private keys, cloud account, Docker, external mail,
LLM, solver, or analytics provider is required. Installation needs registry access.
See [setup and troubleshooting](docs/getting-started.md) for details.

## What you can try

- `/learn`: Position, Pot Odds, and Decision Quality lessons with retrieval
  questions, feedback, and session summaries.
- `/practice`: seeded heads-up practice, Quiz/Random Spot, Street Focus,
  card-recognition drills, and a local Review Queue with deterministic replay.
- `/zh`: Chinese lessons and trainer display copy.
- `/sign-up` and `/settings/profile`: local accounts, profile, account export,
  and deletion. Anonymous practice works without registration.

Saved practice records live in browser storage. Account support does not imply
background uploads or cross-device sync; production import is disabled.
Analytics is off by default in every environment. Independent domain review,
manual assistive-technology checks, and learning-effectiveness evidence remain
separate from automated tests. See the [product guide](docs/product.md).

## Develop

```bash
bin/ci
```

The complete gate includes Rails and browser tests, Vitest, type checking,
builds, content validation, and security scans. System tests need Chrome or
Chromium; dependency audits need network access. See [focused checks](docs/development.md).

Rails 8.1 + SQLite owns pages, accounts, and persistence. Vite Ruby builds the
React trainer. The pure TypeScript engine in `app/frontend/holdem/` owns game
state and versioned replay. `data/` holds content/provenance contracts.
The repository contains only the current application, tests, and curated guides.

## Contribute and reuse

Read [CONTRIBUTING.md](CONTRIBUTING.md), report vulnerabilities through
[SECURITY.md](SECURITY.md), and follow the [engineering boundaries](AGENTS.md).
Original project code and documentation are [MIT licensed](LICENSE); external
references and dependencies retain their own rights and notices. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See the [roadmap](ROADMAP.md) for scope and the [release guide](docs/releasing.md)
for verification and optional static documentation hosting.
