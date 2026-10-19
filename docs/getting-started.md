# Run Holdem Lab locally

Set up the current Rails application without cloud services or private keys.

After reading this guide, you will know how to install dependencies, start the
app, try its core loop, and recover from common setup problems.

## Install the prerequisites

Use Ruby **4.0.2** from `.ruby-version`, Node **24.14.0** from `.nvmrc`, Bundler,
npm, Git, and a C/C++ build toolchain for native gems. Use your preferred Ruby
and Node version managers. Check the active versions before setup:

```bash
ruby --version
node --version
bundle --version
npm --version
```

macOS needs Xcode Command Line Tools. On Debian/Ubuntu, install build tools,
Git, SQLite development headers, and libyaml development headers before building
Ruby and gems. The `sqlite3` gem supplies the SQLite runtime; you do not need a
PostgreSQL or Redis server. Chrome/Chromium is needed only for browser tests.
libvips is needed if you work on image processing. Local verification currently
covers macOS; the CI workflow targets Ubuntu. Windows users should use WSL2.

## Clone and set up

From a terminal with the declared Ruby and Node active:

```bash
git clone https://github.com/yorzi/holdem-lab.git
cd holdem-lab
bin/setup --skip-server
bin/dev
```

Open [http://127.0.0.1:3100](http://127.0.0.1:3100).
`bin/setup` installs the locked Ruby and npm dependencies, prepares SQLite,
and imports/verifies the versioned content mirrors. It is safe to rerun on an
existing development database. `bin/setup --reset` **deletes and recreates** that
database; export anything you need first.

`bin/dev` runs Rails on `127.0.0.1:3100`, Vite on `127.0.0.1:3036`, and the
Tailwind watcher together. Keep it in the foreground; **Ctrl-C** stops the group.
No cloud account, Docker, SOPS identity, Rails master key, mail provider, payment
account, LLM, solver, or analytics account is needed. Dependency installation
uses the RubyGems and npm registries; it is not an offline bootstrap.

## Try the product

1. Open `/learn` and choose Position, Pot Odds, or Decision Quality.
2. Answer the lesson's retrieval questions and inspect the session summary.
3. Open `/practice`, enter a reason and confidence, and make a legal decision.
4. Open Review Queue to inspect the saved decision and deterministic replay.
5. Open `/zh` for the independently authored Simplified Chinese edition.

The first practice does not require registration. Practice records use this
browser's local storage; refreshing restarts the active hand but preserves
compatible saved reviews. Clearing site data or using a different origin/browser
does not carry that history over. Account sign-up/sign-in, profile, export, and
deletion are implemented locally; automatic cloud sync is not.

## Configure local overrides

An `.env` file is optional. `bin/dev` uses Foreman to read it; standalone
`bin/rails` and `bin/ci` do not automatically load it. See [`.env.example`](../.env.example).
For a different web port:

```bash
PORT=3200 bin/dev
```

Then use `http://127.0.0.1:3200`. Vite still uses 3036, so stop other copies of
the project before starting another. `localhost` and `127.0.0.1` have separate
cookies and local-storage origins. Use one consistently.

Local password-reset messages appear in `log/development.log`; no mail is sent
to a provider. Treat those links as credentials and never attach the log to an
issue. Analytics is disabled unless you explicitly configure a measurement ID.

## Troubleshoot setup

| Symptom | Action |
| --- | --- |
| Ruby 2.6 or incompatible Bundler | Activate Ruby 4.0.2, reopen the shell, and check `ruby --version` again. |
| Missing Vite/React packages | Run `bin/setup --skip-server`; it includes `npm ci`. |
| Blank lessons or content mirror drift | Run `bin/rails content:import content:verify`, then refresh. Do not bypass publication checks. |
| Port already in use | Stop the earlier process or change `PORT`; Vite also needs 3036 available. |
| Missing CSS | Keep the Tailwind process in `bin/dev` running. For tests, run `bin/rails tailwindcss:build`. |
| Registry/DNS error during install | Restore network access and rerun setup; do not delete the lockfiles. |
| Password link points to another port | Start through `bin/dev`, using the same `PORT` and host as the browser. |
| `Blocked hosts` through a tunnel | Add only its exact hostname to `RAILS_ALLOWED_HOSTS`; see `.env.example`. Development mode is not a public deployment. |

## Next steps

Read the [product guide](product.md), [development checks](development.md), or
[contribution guide](../CONTRIBUTING.md). Use the [deployment guide](deployment-plan.md)
only if you intend to operate your own public server.
