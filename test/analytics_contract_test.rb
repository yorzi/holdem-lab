require "test_helper"

# The measurement decisions that fail silently. The GA4 snippet only renders
# when a measurement id is configured, which no test environment has, so an
# integration test cannot reach the JavaScript below — and every fault it
# guards produces a page that still loads, still looks right, and is simply
# wrong about who was asked for consent or what was sent to Google.
class AnalyticsContractTest < ActiveSupport::TestCase
  ANALYTICS_HEAD = Rails.root.join("app/views/shared/_analytics_head.html.erb")
  TELEMETRY_EVENTS = Rails.root.join("app/frontend/telemetry/events.ts")

  # Every EEA member plus the UK and Switzerland, by the IANA zone a browser in
  # that country actually reports — including the outlying zones that are not
  # under Europe/ (Portuguese and Spanish islands, French overseas departments,
  # Cyprus), which are the ones most likely to be forgotten.
  CONSENT_REQUIRED_ZONES = %w[
    Europe/Vienna Europe/Brussels Europe/Sofia Europe/Zagreb Europe/Prague
    Europe/Copenhagen Europe/Tallinn Europe/Helsinki Europe/Paris Europe/Berlin
    Europe/Athens Europe/Budapest Europe/Dublin Europe/Rome Europe/Riga
    Europe/Vilnius Europe/Luxembourg Europe/Malta Europe/Amsterdam
    Europe/Warsaw Europe/Lisbon Europe/Bucharest Europe/Bratislava
    Europe/Ljubljana Europe/Madrid Europe/Stockholm
    Europe/Oslo Europe/Reykjavik Europe/Vaduz
    Europe/London Europe/Zurich
    Atlantic/Azores Atlantic/Madeira Atlantic/Canary Atlantic/Reykjavik
    Africa/Ceuta Asia/Nicosia Asia/Famagusta
    Indian/Mayotte Indian/Reunion
    America/Martinique America/Guadeloupe America/Cayenne
  ].freeze

  # Zones where the banner must not interrupt the visit. Analytics loads by
  # default and the privacy page still offers a working opt-out.
  IMPLIED_CONSENT_ZONES = %w[
    America/New_York America/Chicago America/Los_Angeles America/Denver
    America/Toronto America/Vancouver America/Sao_Paulo America/Mexico_City
    Asia/Shanghai Asia/Hong_Kong Asia/Taipei Asia/Tokyo Asia/Seoul
    Asia/Singapore Asia/Kolkata Asia/Bangkok Asia/Jakarta Asia/Manila
    Australia/Sydney Australia/Perth Pacific/Auckland
    Africa/Lagos Africa/Nairobi Africa/Johannesburg
  ].freeze

  test "every EEA, UK, and Swiss zone is asked before the tag loads" do
    CONSENT_REQUIRED_ZONES.each do |zone|
      assert_match consent_zone_pattern, zone,
        "#{zone} is in the EEA/UK/CH — a visitor there must be asked before GA4 loads"
    end
  end

  test "zones outside the EEA, UK, and Switzerland are not gated" do
    IMPLIED_CONSENT_ZONES.each do |zone|
      refute_match consent_zone_pattern, zone,
        "#{zone} is outside the EEA/UK/CH — gating it costs analytics data for no legal benefit"
    end
  end

  test "an unreadable time zone falls back to asking rather than tracking" do
    body = source[/function consentRequired\(\) \{(.+?)\n      \}/m, 1]
    refute_nil body, "consentRequired() not found in _analytics_head.html.erb"
    assert_match(/return !zone \|\|/, body,
      "an empty time zone must be treated as consent-required")
    assert_match(/catch \(_error\) \{\s*return true;/m, body,
      "a thrown Intl lookup must fail toward asking, not toward tracking")
  end

  # A reset token in page_location would hand Google a working credential and
  # print it in a report a human can read.
  test "a password reset token never reaches the page location" do
    pattern, replacement = password_scrub
    assert_equal "/passwords/:token/edit", "/passwords/abc123SECRET/edit".sub(pattern, replacement)
    assert_equal "/zh/passwords/:token/edit", "/zh/passwords/abc123SECRET/edit".sub(pattern, replacement)
  end

  # The bridge rebuilds each event field by field, so an event added to the DOM
  # contract without being added here is collected by the browser and then
  # silently dropped — reported as "we have no data" rather than as a bug.
  test "the GA4 bridge forwards exactly the events the DOM contract dispatches" do
    contract_events = TELEMETRY_EVENTS.read.scan(/readonly name: '([a-z_]+)'/).flatten.to_set
    bridged_events = source.scan(/case "([a-z_]+)":/).flatten.to_set

    assert_equal 5, contract_events.size, "the DOM telemetry contract should declare five events"
    assert_equal contract_events, bridged_events,
      "app/frontend/telemetry/events.ts and the GA4 bridge disagree about which events exist"
  end

  test "an unknown event or field is dropped instead of forwarded" do
    assert_match(/default:\s*\n\s*return null;/, source,
      "an unrecognised event name must not reach Google")
    assert_match(/var params = productEventParams\(detail\);\s*\n\s*if \(!params\) return;/, source,
      "the bridge must send the rebuilt parameters, never the raw event detail")
    refute_match(/gtag\("event", detail\.name, detail\)/, source,
      "forwarding the raw detail object would send whatever a future caller attaches")
  end

  test "no tag manager and no advertising storage" do
    refute_match(/googletagmanager\.com\/gtm\.js|dataLayer\.push\(\{'gtm/, source,
      "a GTM container can inject tags outside this consent flow")
    assert_match(/ad_storage: "denied"/, source)
    assert_match(/ad_user_data: "denied"/, source)
    assert_match(/ad_personalization: "denied"/, source)
  end

  # gtag stamps `dl` and `dr` from its ambient state, not from the parameters of
  # the manual page_view. Without the set() call it keeps crediting automatic
  # events — engagement time above all — to the first page of the visit, and it
  # reconstructs the referrer from the raw previous URL. Both were live bugs.
  #
  # test/frontend/analytics/page-location.test.ts drives the real function and
  # asserts what the ambient state becomes; this only pins the ordering, which
  # is the part a reader of the ERB has to get right.
  test "Turbo navigations repoint the ambient page before the manual page view" do
    body = source[/function trackPageView\(\) \{(.+?)\n      \}/m, 1]
    refute_nil body, "trackPageView() not found in _analytics_head.html.erb"

    assert_operator body.index('window.gtag("set", ambient)'), :<,
      body.index('window.gtag("event", "page_view", page)'),
      "the ambient page must be repointed before the manual page_view is sent"
    assert_match(/ambient\.page_referrer = page\.page_referrer;/, body,
      "the referrer has to be pinned in the ambient state, not only on the event")
    assert_match(/config\.send_page_view = false;/, source)
    assert_match(/window\.addEventListener\("turbo:load", bindPreferences\)/, source)
  end

  test "Global Privacy Control is honoured before the region check" do
    body = source[/function resolveConsent\(\) \{(.+?)\n      \}/m, 1]
    refute_nil body, "resolveConsent() not found in _analytics_head.html.erb"
    assert_operator body.index("globalPrivacyControl"), :<, body.index("consentRequired()"),
      "GPC is a binding opt-out and must be evaluated before the region inference"
  end

  private

  def source
    @source ||= ANALYTICS_HEAD.read
  end

  def consent_zone_pattern
    @consent_zone_pattern ||= begin
      literal = source[/var consentRequiredZones = \/(.+?)\/;/, 1]
      refute_nil literal, "consentRequiredZones regex not found in _analytics_head.html.erb"
      # The literal is JavaScript; the subset used here (anchors, alternation,
      # groups, escaped slashes) is identical in Ruby once \/ is unescaped.
      Regexp.new(literal.gsub('\\/', "/"))
    end
  end

  def password_scrub
    literal, replacement = source.match(/pathname\.replace\(\/(.+?)\/, "(.+?)"\)/)&.captures
    refute_nil literal, "the password path scrub was not found in _analytics_head.html.erb"
    [ Regexp.new(literal.gsub('\\/', "/")), replacement ]
  end
end
