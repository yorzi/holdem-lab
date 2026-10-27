# Develop and verify changes

Run focused checks and the complete local verification gate.

After reading this guide, you will know where code lives, which checks apply,
and what those checks do not prove.

## Find the current code

| Path | Responsibility |
| --- | --- |
| `app/controllers`, `app/models`, `app/services`, `app/views` | Rails pages, auth, persistence, and content runtime |
| `app/frontend/holdem/domain` | Pure TypeScript rules, seeded RNG, cards, pots, evaluator |
| `app/frontend/holdem/application` | Use cases, records, and replay |
| `app/frontend/holdem/persistence` | Local repository, outbox, and explicit Rails importer |
| `app/frontend/holdem/ui` | React trainer island |
| `app/frontend/controllers` | Stimulus behavior for server-rendered pages |
| `data/` | Authored content manifests, registries, provenance, and golden cases |
| `test/frontend`, `test/system`, `test/controllers`, `test/services` | Vitest and Rails coverage |

Rails + SQLite is the product monolith; Vite Ruby is the only JavaScript build
entrypoint. Ordinary pages use ERB/Turbo/Stimulus. React owns the trainer UI;
the pure TypeScript engine owns game state. See [architecture](architecture.md).

## Run focused checks

From the repository root, after `bin/setup --skip-server`:

```bash
npm test
npm run typecheck
npm run validate:frontend-boundaries
npm run validate:research
npm run validate:quality
npm run validate:content
npm run validate:catalog
npm run validate:canonical
npm run build
bin/rails test
bin/rails tailwindcss:build
bin/rails test:system
bin/rails content:import content:verify
bin/rails content:readiness
```

System tests launch a temporary Rails test server and headless Chrome. Install
Chrome/Chromium and a matching driver if Selenium cannot locate one; its driver
manager may need a network connection. Do not point tests at a production database.

## Run the full gate

```bash
bin/ci
```

The gate includes setup, tests, browser smoke, type checks, build, data/mirror
validation, RuboCop, Brakeman, Bundler Audit, and npm audit. Audits need network
access. Publication blockers in the read-only readiness report are evidence to
review, not an instruction to force-publish records.

`package.json` keeps `private: true` to prevent accidental npm publication; it
does not control GitHub repository visibility.

CI runs on pull requests and pushes to `main`. It uses no deployment secret for
normal checks. The optional deploy job requires a manual request and the
`ENABLE_DEPLOY=true` repository variable; it is off by default.

CI uses Ubuntu 24.04 so the pinned Ruby remains available when GitHub changes
`ubuntu-latest`. Use the Node version in `.nvmrc`; jsdom 30 requires at least
Node 24.15 on the Node 24 series. System tests reset the browser dimensions
before each test so a mobile test cannot change the next test's viewport.

## Change content carefully

Use `data/content/README.md` and `data/research/README.md` for the contracts.
Updating a referenced asset also requires updating its recorded digest and
checking dependent registries. Do not mark independent domain review complete
because a content validator passes. Do not modify an immutable historical
decision to accommodate a new rule version.

## Next steps

See [CONTRIBUTING.md](../CONTRIBUTING.md) for pull requests and
[SECURITY.md](../SECURITY.md) for private reports. Implementation logs retain
dated local evidence; do not interpret an old green log as a current CI result.
