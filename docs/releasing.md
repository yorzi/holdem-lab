# Release and documentation guide

Publish a reviewed source candidate without mixing private operator data into it.

After reading this guide, you will know the source boundary, release checks and
when a static documentation site would be useful.

## Standalone source boundary

Holdem Lab begins with a curated source snapshot and new Git history. Prior
private Git objects, historical prototypes, attachment-derived RFI tables,
operator ciphertext, databases, old operational logs and internal business plans
are not included. The original author is retained in the MIT license.

Rules, evaluator, RNG and replay contracts keep their explicit versions. Browser
storage, application namespace, export identifiers and public branding use the
new project name. No prior application's browser data is read or migrated.
Some content has owner approval while source packets still await independent
review. The source extraction does not change those review states.

## Check a release candidate

- Run bin/setup --skip-server and bin/ci on the exact source revision.
- Verify the README flow without local credentials or an existing database.
- Check file links, content digests, licenses and all tracked files.
- Scan the complete reachable history and current source with redacted secret
  output. Never publish .env, keys, operator vaults, databases or account exports.
- Record actual local results separately from remote CI, hosting, human review
  and user outcomes. No green test grants source rights or production readiness.
- Deploy only to an explicitly configured operator-owned environment. A source
  release does not require deployment, analytics or a paid account.

GitHub private vulnerability reporting is the security channel. Normal CI has
read-only repository permissions and does not need deployment secrets.

## Documentation site decision

Use the repository guides for now. README, product, setup, development and
architecture cover the current onboarding needs without a second build system.

A curated static site becomes useful when stable releases need versioned docs,
search/navigation becomes a repeated problem, or contributor feedback shows a
clear onboarding gap. GitHub Pages can serve those guides independently of a
Rails server. It cannot run the trainer or database. Label screenshots and
static explanations clearly; do not present them as a live app.

No Pages build, hosting workflow, custom domain or documentation service is
required by this baseline. Keep one source per topic when adding a site later.

## Next steps

See [product release gates](release-gates.md), [third-party notices](../THIRD_PARTY_NOTICES.md),
and [CONTRIBUTING.md](../CONTRIBUTING.md).
