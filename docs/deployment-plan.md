# Optional self-hosting

Run your own server only after completing the operator-specific production gates.

After reading this guide, you will know which settings belong to your deployment
and which local checks cannot establish production readiness.

## Local use first

The [local setup](getting-started.md) needs no Docker, cloud provider or secrets.
Production hosting is optional. This repository operates no required shared
backend and promises no hosted trainer.

## Configure your deployment

1. Choose a Docker-capable host with local persistent storage. Replace the
   documentation-only IP, SSH user, registry/image and domain in config/deploy.yml.
2. Set PUBLIC_BASE_URL to your HTTPS origin, without a path, query or credentials.
   Its host is allowed automatically. RAILS_ALLOWED_HOSTS adds exact aliases.
   A production boot without an origin fails; asset compilation can use Rails'
   SECRET_KEY_BASE_DUMMY without real secrets.
3. Generate your own SECRET_KEY_BASE and store it privately. Supply it and
   KAMAL_REGISTRY_PASSWORD through a private secret manager or ignored operator
   files. Never pass secret values as CLI arguments or inline exports. The
   example does not require a master key or inherited encrypted credentials.
4. Keep /rails/storage on a persistent local volume. The entrypoint runs
   db:prepare and all content mirrors. Plan consistent SQLite backups and prove
   a restore before keeping accounts. Do not publish databases or backups.
5. Configure real mail delivery, contact/privacy information, retention/export
   and account security for your users. Production progress import stays closed.
   Review published content gates separately; never force-publish to fix a 404.
6. For optional GitHub Actions deployment, use the production environment secrets
   SECRET_KEY_BASE, KAMAL_REGISTRY_PASSWORD and SSH_PRIVATE_KEY. Set SSH_KNOWN_HOSTS
   from a trusted host-key check. Set ENABLE_DEPLOY=true only after configuration;
   manually run CI on main with its deploy input checked. All quality jobs must
   pass. Pushes and normal PRs do not deploy.

script/materialise_kamal_secrets.rb writes only declared values to ignored .kamal
files with mode 0600. bin/secrets is an optional SOPS/age helper; its vaults and
.sops.yaml remain ignored, including ciphertext. Neither helper is used by local
setup. Keep operator backups in private storage outside the public repository.

## Verify operator outcomes

The repository tests are not a Docker build, production deployment, live email
check, TLS/DNS proof, security audit or restore drill. Verify each separately.
Default analytics is disabled; read the [analytics guide](analytics-and-search-console.md)
before opting in with your own account. Recheck persistent resources and provider
billing when retiring your own server; stopping compute does not delete storage.

## Next steps

Use the [release gates](release-gates.md) and [security policy](../SECURITY.md).
GitHub Pages can serve static docs, but not this Rails process or its database.
