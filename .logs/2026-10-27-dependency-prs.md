# Dependency PR integration

Date: 2026-10-27 (Asia/Shanghai)

Scope: all 18 open dependency PRs at the start of this task, based on
`b8e2e71`. No review submissions, conversation comments or inline review
threads were present. The PR commits are preserved as merge parents.

| PRs | Integrated updates |
| --- | --- |
| #1 | Rails 8.1.4 |
| #2, #3, #6, #8 | Checkout 7, Cache 6, Setup Node 7, Upload Artifact 7 |
| #4 | Selenium WebDriver 4.51.0 |
| #5, #9 | React and React DOM 19.3.1, both type packages 19.3.0 |
| #7, #11, #13 | jsdom 30.1.3, Vite 8.3.4, Vitest 5.0.5 |
| #10, #17 | Solid Cable 4.1.0, Solid Queue 1.7.0 |
| #12, #16, #18, #19 | Thruster 0.1.27, Brakeman 8.1.0, Bootsnap 1.26.0, SQLite3 2.10.1 |

## Compatibility and security fixes

- Combined the React/React DOM upgrades and resolved overlapping npm and
  Bundler lockfile changes without dropping the other PRs' upgrades.
- Added the explicit `ruby-vips ~> 2.0` dependency required by image_processing
  2.x. PR #14's failed CI log showed Rails boot failing with the missing Vips
  processor. Bundler normalized and installed the final lockfile.
- Pinned CI runners to Ubuntu 24.04. PR #19's failure annotations showed
  Ruby 4.0.2 unavailable after `ubuntu-latest` moved to Ubuntu 26.04.
- Raised `.nvmrc` to Node 24.21.0, an installed Node 24 patch satisfying
  jsdom 30's Node >=24.15 requirement, and updated installation guidance.
- Reset the Selenium viewport before each system test. PR #10 failed when a
  mobile test left the shared window narrow, hiding a desktop-only paragraph.
  A temporary synthetic test that resized to 390px then ran the existing
  desktop practice test failed before the setup fix and passed afterward.
  The original CI order, seed 9420, also passed after the fix.
- Updated Crass from 1.0.7 to 1.0.8 after the first full audit reported
  GHSA-pq4g-8rxf-4g29. No advisory was ignored.

## Commands and results

Commands used Ruby 4.0.2 and, after the Node compatibility fix, Node 24.21.0.

- `bundle install`: passed; installed the resolved locked dependencies.
- `npm ci`: passed on Node 24.21.0, with zero audit findings. The optional
  fsevents install-script warning remains; it did not fail installation.
  An initial sandboxed npm install stalled and was terminated before checks.
- `bundle update crass --conservative`: passed; only Crass was upgraded.
- First `bin/ci`: all steps except the Crass vulnerability audit passed.
- Focused temporary viewport reproducer: 1 run / 3 assertions; failed before
  the isolation fix, then passed with zero failures/errors/skips.
- `bin/rails test:system --seed 9420`: 24 runs / 156 assertions, zero
  failures/errors/skips.
- Final `bin/ci`: passed. Rails: 133 runs / 1152 assertions; system: 24 runs /
  156 assertions; Vitest: 19 files / 136 tests. Zero failures/errors/skips.
  RuboCop: 106 files, zero offenses. Bundler/npm audits: no vulnerabilities
  reported. Brakeman: zero warnings. Typecheck, frontend boundaries, build,
  every data validator, content mirror import/verification and readiness passed.
- `git diff --check`: passed. All 18 PR heads are ancestors of the integration
  branch. Workflow YAML parsed and its explicit deployment gate was checked.
- `gitleaks git . --redact --log-opts='b8e2e71..HEAD'` and
  `git diff | gitleaks stdin --redact`: no leaks found.

## Remote follow-through and refreshed security evidence

The initial push at `e04075c` merged and closed all 18 PRs. Main CI run
`40434347263` passed browser, JavaScript audit and lint checks, but its fresh
Ruby advisory database reported seven Net::SSH advisories against 7.3.3.
The earlier local audit had used an older advisory database, so its green
result did not establish current dependency safety.

- `bundle update net-ssh --conservative`: upgraded only Net::SSH to 7.3.8.
- `bin/bundler-audit check --update`: passed against advisory DB revision
  `3df20d31748fbafd1f6c75ade50e5d1d266257ee`, with no vulnerabilities found.
- Both `config/ci.rb` and the GitHub workflow now run that explicit refresh.
- A further complete `bin/ci` passed in 37.40 seconds with the refreshed
  advisory database and the same Rails/system/Vitest counts recorded above.
- Net::SSH 7.3.8 and SSHKit loaded together; `bundle exec kamal version`
  returned 2.12.0. These are local loading checks, not an SSH connection or
  a deployment test.
- Follow-up `git diff --check` and `git diff | gitleaks stdin --redact` passed.

## Evidence limits and cleanup

These are local results; remote main CI must be checked separately after push.
The workflow deployment gate remains manual and opt-in. No deployment,
provider integration, payment, content approval or learning outcome is claimed.
Browser test servers used loopback and exited with their test processes.
No development server, watcher, tunnel or subscription was started.
