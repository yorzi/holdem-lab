# Optional analytics

Keep a local installation free of external measurement and configure a collector
only for an operator-owned deployment.

After reading this guide, you will know the disabled defaults, the allowed event
boundary, and what must be reviewed before enabling a provider.

## Defaults

No environment has a default GA4 measurement ID. A blank GA_MEASUREMENT_ID means
no Google Analytics tag, network loader or consent banner. Production also
requires PRODUCT_TELEMETRY_ENABLED=true to bridge the five product DOM events.
Development/test DOM dispatch alone sends nothing over the network.

Google/Bing site-verification values default blank. No account IDs, search
properties, service-account addresses or former-host settings are distributed.
Local use needs none of them.

## Allowlisted events

The bridge rebuilds each payload field by field and drops unknown events/fields:

| Event | Allowed product fields |
| --- | --- |
| lesson_view | lesson_slug |
| practice_start | mode |
| decision_locked | mode, street |
| session_complete | lesson_slug, score_band |
| review_open | no product identifiers |

Inspect app/frontend/telemetry/events.ts and the shared analytics partial before
changing this contract. It must not collect cards, chip amounts, snapshots,
reasoning text, email, account/record/installation IDs, or raw password-reset URLs.
Page locations/referrers strip query/fragment and reset tokens. Consent code
honors GPC, gates the configured consent-required regions, and allows opt-out.
There is no tag manager, advertising storage, session recorder or heatmap.

## Enable only your own collector

If you host the app and choose measurement, configure your own GA_MEASUREMENT_ID.
For the product bridge also set PRODUCT_TELEMETRY_ENABLED=true. Review the event
allowlist, consent/privacy text, provider retention and access roles first.
Adapt the privacy page to the actual operator and settings; source code cannot
verify a provider's account configuration or its legal suitability.

The code manually emits Turbo-aware page_view events. Disable the provider's
automatic browser-history page views and form-interaction measurement, then
inspect actual request payloads and count navigations once. Merely changing a
provider setting does not prove propagation or fix production measurements.

If you configure search verification, use your own property and public origin.
The runtime sitemap and robots use PUBLIC_BASE_URL; no inherited domain is
required. Do not reuse another application's measurement identifiers.

## Next steps

See [self-hosting](deployment-plan.md), [security reporting](../SECURITY.md), and
[product release gates](release-gates.md). Root tests cover local rendering and
payload contracts, not live provider behavior.
