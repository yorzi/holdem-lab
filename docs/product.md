# Product guide

Understand the learning loop, supported behavior, and current limits.

After reading this guide, you will know what to try locally and which claims
the application can support.

## Learn, practice, review

Holdem Lab is an adult educational project for No-Limit Texas Hold'em.
It teaches a narrow concept, asks you to make a decision with a stated reason,
and preserves the decision context so you can review it later.

Start with three server-rendered lessons: heads-up position, immediate-call pot
odds, and decision quality versus outcome. Each includes retrieval questions,
feedback, sources, and an in-page summary. English is the default; `/zh` is an
independently authored Chinese sibling. Pages and the trainer share the locale
but store language-neutral codes and versions.

The React trainer supports heads-up hands with virtual chips, seeded scenarios,
legal actions, Quiz/Random Spot, Street Focus, and a local Review Queue. Current
card-recognition drills check starting-hand notation and best-five hand identity
against the rules/evaluator. See [local setup](getting-started.md) to try them.

## Understand feedback and replay

The pure TypeScript engine controls dealing, action order, bets, pots, and
showdown. Seeds and explicit rules/evaluator/RNG/replay versions make a hand
replayable. Incompatible old records are preserved rather than silently
reinterpreted as current records.

Strategy feedback is an educational approximation with stated assumptions,
not verified solver output or a guarantee of optimal play. Unknown EV values
remain null. Pot odds price a call; they do not supply an opponent range or
estimate your equity. Results vary, and one outcome cannot establish decision
quality or learning effectiveness.

## Know where records live

Anonymous practice records remain in browser local storage. The active hand
restarts on refresh; compatible saved decisions remain available for review.
Rails has native authentication, profile, owner-scoped account export, and
password-confirmed account deletion. It also has an explicit development/test
import contract and a local outbox adapter, not automatic cross-device sync.
Production import is disabled. Account deletion does not clear browser records.

The default source checkout loads no analytics tag or external collector.
Optional GA4 integration is operator-configured; its data and consent boundaries
are documented in the [analytics runbook](analytics-and-search-console.md).

## Separate code from review evidence

Content comes from versioned manifests, registries, authored views, and a SQLite
integrity mirror. Production uses the published scope; development uses review
preview. `bin/rails content:readiness` reports blockers without changing status.

Some lesson asset records carry product-owner approval dated 2026-08-25, while
source packets still record pending independent domain review. Owner approval
is not independent poker-domain validation. Automated tests verify structure,
references, and executable examples, not learning outcomes or outside rights.
Read [release gates](release-gates.md) before changing publication states.

## Project scope

There is no real money, redeemable asset, prize system, connection to a real
table, HUD, live-game advice, or automated betting. Six-player strategy tables and unreviewed attachment-derived drills are not
distributed by this project. There is no payment integration or supported hosted
service commitment. No hosted trainer is promised by this source repository.

## Next steps

Use [CONTRIBUTING.md](../CONTRIBUTING.md) to propose changes and
[architecture.md](architecture.md) to inspect implementation boundaries.
The [roadmap](../ROADMAP.md) separates current behavior from future work.
