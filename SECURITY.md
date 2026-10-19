# Security policy

This is an early-stage educational application. Security fixes target the
current `main` branch; there are no maintained release series or response-time
guarantees. A passing scan is not a security audit.

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/yorzi/holdem-lab/security/advisories/new)
(**Security → Report a vulnerability**). If it is temporarily unavailable, open
a public issue requesting a private reporting channel without including the
vulnerability, credentials, or exploit details.

Do not post credentials, session cookies, reset tokens, user records, database
files, or exploitable account details in an issue or pull request. Include
the affected revision, reproducible steps using synthetic data, and impact.

## Running your own instance

Local development binds to loopback and uses SQLite on your machine. Development
mode has debug pages and review-preview content; do not expose it as a public
service. Public hosting needs HTTPS, your own secret key, exact allowed hosts,
backups, and an operator-owned privacy policy. Production import stays disabled.

Keep keys, `.env`, databases, account exports, backups, and deployment vaults
out of Git, issue attachments, images, and build artifacts. If a credential was
exposed, revoke or rotate it first; deleting a file does not remove its history.
See the [release guide](docs/releasing.md).
