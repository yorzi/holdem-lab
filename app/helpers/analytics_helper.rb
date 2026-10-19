# frozen_string_literal: true

# The measurement boundary. Two public identifiers decide whether the site is
# measured at all, and both are configuration rather than secrets: a GA4
# measurement id and a Search Console verification token are served in the HTML
# to every visitor and every crawler by design, so they live in
# config/environments/*.rb next to public_base_url and not in the age-encrypted
# vault. See docs/analytics-and-search-console.md.
module AnalyticsHelper
  # Blank in development and test unless a developer opts in through ENV, which
  # is what keeps the suite and local browsing out of the production property.
  # Nothing here reads Rails.env: one setting decides, and the environment file
  # is where that decision is written down.
  def analytics_measurement_id
    Rails.application.config.x.analytics.measurement_id.presence
  end

  def analytics_enabled?
    analytics_measurement_id.present?
  end

  # Search-engine ownership tokens, rendered as <meta> tags in every
  # environment. A DNS-verified Domain property needs none of these — prefer
  # that — but a URL-prefix property does, and the tag must stay deployed for
  # as long as the property exists or ownership silently lapses.
  def analytics_site_verifications
    {
      "google-site-verification" => Rails.application.config.x.analytics.google_site_verification.presence,
      "msvalidate.01" => Rails.application.config.x.analytics.bing_site_verification.presence
    }.compact
  end

  # The DOM event contract in app/frontend/telemetry/events.ts dispatches only
  # when this is on. It is the switch the analytics bridge listens behind, so
  # turning it on in an environment is what makes product events reportable
  # there — read the review in docs/analytics-and-search-console.md before
  # changing it.
  def analytics_product_events?
    Rails.application.config.x.telemetry_enabled == true
  end
end
