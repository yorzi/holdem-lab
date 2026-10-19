# Contributing to Holdem Lab

Start with the [local setup guide](docs/getting-started.md) and
[product guide](docs/product.md). Bug reports, reproducible rule failures,
accessibility improvements, and clearer English or Chinese explanations are useful.
This is a maintainer-led project with no promised support response time.

## Propose a change

Search existing issues, then describe the problem and intended behavior. Discuss
large features before building them. Keep pull requests focused and explain what
changed, why, and which checks you ran. Be respectful and critique the work.

For a trainer bug, include the seed, rule/evaluator/replay versions, actions,
expected behavior, and observed result. Use synthetic examples. Never attach
real account exports, password-reset links, private reasoning, or a database.
Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

## Preserve the boundaries

- The pure TypeScript engine owns all game state. Rails, UI components, and
  models must not implement a second rules engine.
- Randomness is seeded and versioned. Failed actions leave the input unchanged.
  Add regression coverage for rule changes and verify pot conservation.
- Review records preserve their original context. Add review notes rather than
  rewriting a decision. Keep incompatible versions explicit.
- Strategy estimates must disclose their method and limits. Never label an
  estimate as solver output or claim optimal play without verifiable evidence.
- Keep real-money play, live-table assistance, automated betting, and prizes
  outside the project. These are project scope decisions; the MIT license is
  the license for the source.
- New content needs source locators, asset-level rights, review status, and
  manifest digests. Passing a validator does not grant rights or domain approval.
- Do not add analytics payloads or network collectors without a separate privacy
  review. The default installation makes no analytics requests.

[AGENTS.md](AGENTS.md) contains the full engineering constraints;
[architecture](docs/architecture.md) explains the dependency boundaries.
Read historical plans for context, not as a claim about current behavior.

## Verify your work

```bash
bin/ci
```

This includes Rails, browser system tests, Vitest, type checking, builds,
content validation, RuboCop, and dependency/security scans. It needs Chrome or
Chromium for system tests and network access for dependency audits. See the
[development guide](docs/development.md) for focused commands. State any checks
you could not run; local checks do not prove CI, deployment, or learning outcomes.

Keep documentation with the code it describes. Current topic owners are in
[docs/README.md](docs/README.md). Record substantial implementation validation in
`.logs/`, without private paths, infrastructure identifiers, or credentials.
Bind temporary servers to `127.0.0.1` and stop them when finished.

## License and content

Submit only material you have the right to contribute. Contributions to the
project's original code and documentation are under [MIT](LICENSE).
Linked rulebooks, papers, solver datasets, dependency licenses, and trademarks
remain subject to their respective rights. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
