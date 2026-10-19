# Content manifest

`lesson-manifest-v1.json` is the first M14 candidate content layer. It records
the authored lesson assets and their separate publication/review states. Rails
resolves lesson routes and source packets through `Content::Manifest`, while
`ContentAsset` provides a SQLite integrity mirror without silently turning
these records into published content.

`curriculum-v1.json` is the first structured curriculum graph. It connects
three lessons to nine stable concepts, nine retrieval exercises, and nine
source-reference ids. Exercise records deliberately point to the existing
authored view DOM ids and answer values; reusable exercise contract fields are
owned by `data/exercises/exercise-templates-v1.json`, and source-reference
claim/provenance fields are owned by
`data/sources/source-reference-registry-v1.json`. Neither registry replaces
lesson prose or invents a strategy baseline.

Each record keeps separate:

- stable lesson identity, locale, content version, route, and authored view;
- exact view SHA-256 digest for integrity checks;
- source-packet provenance;
- authoring mode (`original_authored_synthesis` or
  `independent_authored_sibling`);
- rights status, technical review, domain review, and publication status.

The Chinese records are independent authored siblings. Their English source
packet references preserve provenance and scope; they are not machine-
translated runtime content. The six current asset records are marked published with product-owner approval;
their source packets still record pending independent domain review. Owner
approval is not independent validation. Development reads review preview and
production applies the complete published-scope graph checks.

Run `npm run validate:content` after changing a manifest record or its view.
The validator checks JSON shape, route/locale pairing, source-packet links,
view existence, digest integrity, review fields, and the publication gate.

Use `bin/rails content:import` to create or update the SQLite mirror. It mirrors
both the six lesson assets and the four curriculum record types
(`Content::Lesson`, `Content::Concept`, `Content::Exercise`, and
`Content::SourceReference`). A second run is a no-op;
`bin/rails content:verify` compares the manifest, authored view digests,
curriculum graph fields, and mirrored fields and fails on drift. Missing records
are not deleted implicitly; `RETIRE_MISSING=1 bin/rails content:import` is the
explicit deprecation path.

Run `npm run validate:catalog` after changing the curriculum graph. It checks
stable ids, lesson/asset/packet relationships, concept prerequisites, exercise
DOM contracts, source-packet claim provenance, and publication gates.

`canonical-content-v1.json` is the cross-layer contract for the current content
slice. It indexes `data/exercises/exercise-templates-v1.json`,
`data/sources/source-registry-v1.json`,
`data/sources/source-reference-registry-v1.json`, and
`data/strategy/strategy-registry-v1.json`. `npm run validate:canonical` checks
their stable ids, rights/integrity/domain/publication separation, source and
quality-packet provenance, curriculum exercise coverage, runtime digests, and
the rule that approximate strategy metadata cannot become solver data.
`Content::CanonicalRegistry` repeats only the runtime-critical cross-reference
and digest checks in Rails. `Content::RegistryMirror` stores one versioned
snapshot per layer; `content:import` and `content:verify` include these
snapshots, and `RETIRE_MISSING=1` is required to retire a removed layer.
Exercise instances still come from the curriculum graph, source registries
remain provenance-only, and no strategy record is added to product runtime.
The SQLite curriculum mirror stores the canonical template/reference binding
and layer digest so a changed canonical record cannot silently pass `verify`.

`Content::Query` reads the SQLite candidate mirror without changing it. Its
review-preview query returns only complete lesson graphs; its published query
requires the asset, lesson, concepts, exercises, and source references to all
be published and to carry completed domain-review metadata. The development/
test-only `/content/registry` page exposes the same mirror as a read-only QA
summary, including one readiness row per English lesson. `Content::PublicationWorkflow`
uses stable, language-neutral blocker codes (`domain_review_not_approved`,
`rights_not_ready`, `technical_review_not_passed`, and related graph/status
codes) and `bin/rails content:readiness` prints the report without mutation.
It is not available in production.

`Content::PublicationWorkflow#promote!` is an internal-only, transactional
guard for a later authorized publisher. It updates the selected locale asset
and its shared curriculum graph only after every gate passes, and raises a
structured `BlockedError` otherwise. No route, admin interface, or production
authorization is implied by this method. Current candidate records remain
blocked because independent domain review is still pending.

`Content::Runtime` makes the serving boundary explicit: development and test
use the manifest-backed `review_preview` scope, while production uses the
database-backed `published` scope. The published runtime requires a complete
published graph, verifies the database asset against the manifest view path and
SHA-256 digest, and returns no lesson when the graph or canonical registry
snapshot is absent or inconsistent.
Promoting a record remains a separate internal operation; a runtime scope does
not create publication approval or production deployment evidence.

The current schema remains a minimal candidate registry. It now provides
read-only review-preview and published-scope queries, a versioned canonical
registry snapshot mirror, explicit per-record contract/provenance bindings, the
readiness workflow, and a validated first contract for the broader data layers.
It does not yet provide admin editing, make every content field canonical, or
claim any published strategy data.
