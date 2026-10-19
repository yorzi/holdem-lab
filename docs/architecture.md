# Architecture

Understand which layer owns each decision in the running application.

After reading this guide, you will know where to change behavior without
creating a second rules engine or losing decision context.

## Runtime boundaries

Rails 8.1 and SQLite form one product monolith. Rails serves normal pages with
ERB, Turbo and Stimulus; React mounts the interactive trainer through Vite Ruby.
There is one JavaScript build entrypoint and one canonical TypeScript engine.

```text
Rails SSR / Turbo / Stimulus
React trainer -> TypeScript application -> pure TypeScript domain
                                       -> read-only strategy advisory
React repository adapter -> same-origin Rails JSON -> Active Record / SQLite
```

The domain under `app/frontend/holdem/domain/` owns dealing, seeded shuffle,
legal actions, betting limits, pots, street advancement, showdown and settlement.
It does not depend on Rails, React, DOM, network, browser storage, a model SDK,
or the system clock. Illegal actions return structured errors without changing
the input state. No Ruby rule engine duplicates or repairs its results.

The current engine supports heads-up, 100BB, 52 cards and virtual chips. Before
adding more players, design and test action order, side pots, all-ins and
settlement in the engine. Do not patch those behaviors in UI components.

## Deterministic records and replay

A game uses an explicit seed, fixed RNG algorithm and Fisher-Yates shuffle.
Business hand code never uses Math.random(). `holdem-rules-v2`,
`holdem-evaluator-v1`, RNG, `holdem-replay-v2` and `holdem-progress-v2` remain
separate version contracts. Rules IDs did not change with the project name.

A DecisionRecord preserves the original decision, legal actions, complete action
history, reason/confidence, feedback, seed, versions and before/after snapshots.
Replay rebuilds the hand from its seed and actions; it never deals a fresh hand.
An incompatible old record is rejected for current replay, not silently migrated.
Subsequent review notes must not overwrite the original decision context.

The new application's browser keys use `holdem-lab:`. It does not automatically
read or upload another application's browser storage. `LocalProgressRepository`
owns local persistence; UI components depend on repository interfaces.

## Feedback and evidence

The strategy layer reads state and returns educational analysis. It cannot
change cards, actions, evidence labels, or publication status. Persisted labels
are language-neutral: benchmark_strategy, approximate_analysis, solver_data.
Only verifiable licensed solver provenance can justify the last label.

Current feedback uses a transparent deterministic sampling approximation.
Assumptions and limitations accompany it; unavailable EV stays null. Pot-odds
arithmetic does not supply an opponent range or estimate equity. A language
model is not the authority for either game rules or strategy conclusions.

## Content and publication

Versioned original content and provenance live in data/. Content::Manifest,
Content::CanonicalRegistry and Content::Catalog define the authored assets,
canonical references and curriculum graph. Their three mirror services import
idempotently into SQLite and detect missing or changed digests.

Content::Query and Content::Runtime provide review-preview reads in development
and published-scope reads in production. Published reads require linked records
and canonical snapshots to pass their gates. Content::PublicationWorkflow has
read-only readiness reporting and an internal transactional promote guard; no
public management route exposes it. /content/registry is development/test only.

Some lesson assets have product-owner approval while source packets still say
independent domain review is pending. These are distinct evidence claims.
Validators prove structure, hashes, links and executable examples, not outside
rights, independent approval or learning effectiveness.

## Accounts, import and privacy

Native Rails authentication uses sessions and CSRF. Profile, account export and
password-confirmed account deletion are local features. The explicit Rails
progress importer is available only in development/test; production returns
404 import_disabled. A local outbox is not automatic cross-device sync.

The five-event DOM contract has no network transport itself. No default GA4 ID
ships, and production product telemetry requires explicit opt-in. Optional
collector fields are allowlisted; cards, reasons, snapshots, account identifiers
and raw reset URLs must not reach third parties. See the analytics guide.

## SQLite and self-hosting

SQLite stores the early application data. Production primary/cache/queue/cable
configuration uses separate files on local persistent storage. Keep write
transactions short; do not share WAL files through a network filesystem or
multiple write hosts. Prove consistent backups and isolated restores before
handling real accounts. Sustained write contention, multi-host writes or HA
requirements justify a separate PostgreSQL migration decision.

Authentication does not imply production import, retention/export completeness,
mail delivery or hosting readiness. Payments and entitlements are future work,
not installed integrations. See the self-hosting guide and release gates.

## Next steps

Use [development checks](development.md), [content contracts](../data/content/README.md),
and the [import contract](local-progress-import.md) for implementation details.
