# Standalone public baseline

Date: 2026-10-19 (Asia/Shanghai)

This project starts with a reviewed source snapshot and new Git history under
the original author's MIT license. No earlier private Git objects, operational
logs, business plans, prototype code, attachment-derived RFI tables, deployment
vaults, credentials, databases, exports or local environment files were copied.

Branding, Ruby namespace, browser-storage prefixes, export identifiers, repository
links and social cards use Holdem Lab. Existing rules/evaluator/RNG/replay
versions and source review states remain explicit. The code does not read or
migrate another application's browser-local records.

## Local validation

- `bin/setup --skip-server`: passed with a new database and no copied credentials.
  Installed locked npm dependencies; prepared SQLite and all content mirrors.
  Host Ruby/Node and installed gem cache were reused, not a clean-OS install.
- `bin/ci`: passed in 30.48 seconds on this machine. Rails: 133 runs / 1152
  assertions; browser system: 24 runs / 156 assertions; Vitest: 19 files / 136
  tests. No failures/errors/skips in the Rails suites. Type checking, Vite build,
  frontend boundaries, all data validators, content import/verify and read-only
  publication readiness passed.
- RuboCop: 106 files, zero offenses. Brakeman: zero warnings. Root Bundler/npm
  audits: no vulnerabilities reported.
- Markdown relative file targets checked, with no missing target.
- Gitleaks source-snapshot scan: no matches. The complete new reachable Git
  history is scanned separately before push. No old Git object was imported.
- English and Chinese social-card PNGs regenerated from renamed SVGs and visually
  inspected. They contain the new project name.

## Real development startup

`bin/dev` started Rails at 127.0.0.1:3100 and Vite at 127.0.0.1:3036, with the
Tailwind watcher in the same foreground Foreman group.

Browser smoke used a fresh isolated browser context. Home, three English
lessons, Chinese home/learn/practice, both privacy pages and robots returned 200
without an analytics tag or old branding. A synthetic reason and legal Check
created a `holdem-lab:progress:v2` decision; Review Queue showed it, replay
reported a match, and the record survived reload. No old application's storage
prefix was created. Chinese practice had zh-Hans and the new title. The checked
resource inventory contained local origins only.

All task-started development services were stopped with Ctrl-C and Foreman
reported their exit. No preview service, watcher, tunnel or log subscription is
required to use the published source.

## Evidence limits

These are local checks. Remote CI and repository visibility are verified after
push; a local green result alone does not prove them. No hosted application,
Docker build, mail delivery, live analytics, recovery drill, independent domain
review, manual assistive-technology review or learning-outcome study is claimed.
No external infrastructure was changed. The initial source commit uses the
maintainer's GitHub noreply address rather than a private email.
