require "test_helper"

class AnalyticsRenderingTest < ActionDispatch::IntegrationTest
  setup do
    @analytics = Rails.application.config.x.analytics
    @previous = {
      measurement_id: @analytics.measurement_id,
      google: @analytics.google_site_verification,
      bing: @analytics.bing_site_verification,
      telemetry: Rails.application.config.x.telemetry_enabled
    }
  end

  teardown do
    @analytics.measurement_id = @previous[:measurement_id]
    @analytics.google_site_verification = @previous[:google]
    @analytics.bing_site_verification = @previous[:bing]
    Rails.application.config.x.telemetry_enabled = @previous[:telemetry]
  end

  test "an unconfigured environment ships no tag, no banner, and no verification token" do
    get root_url

    assert_response :success
    assert_no_match(/googletagmanager\.com/, response.body)
    assert_select "[data-analytics-consent-banner]", count: 0
    assert_select "meta[name='google-site-verification']", count: 0
  end

  test "a configured measurement id renders the consent-gated tag and its banner" do
    @analytics.measurement_id = "G-TESTONLY01"

    get root_url

    assert_response :success
    assert_includes response.body, "G-TESTONLY01"
    assert_includes response.body, "googletagmanager.com/gtag/js?id="
    # The script is inert until consent resolves; it must not be the async
    # loader tag that a copy-pasted snippet would produce.
    assert_select "script[src*='googletagmanager.com']", count: 0
    assert_select "[data-analytics-consent-banner]", count: 1
    assert_select "[data-analytics-consent-accept]", count: 1
    assert_select "[data-analytics-consent-decline]", count: 1
  end

  test "the banner links to the page that explains what is measured" do
    @analytics.measurement_id = "G-TESTONLY01"

    get root_url

    assert_select "[data-analytics-consent-banner] a[href='#{privacy_path}']", count: 1
  end

  test "the product-event bridge follows the telemetry contract switch" do
    @analytics.measurement_id = "G-TESTONLY01"

    Rails.application.config.x.telemetry_enabled = false
    get root_url
    assert_includes response.body, "var productEvents = false;"

    Rails.application.config.x.telemetry_enabled = true
    get root_url
    assert_includes response.body, "var productEvents = true;"
  end

  test "search-engine verification tokens render as meta tags in the head" do
    @analytics.google_site_verification = "google-token"
    @analytics.bing_site_verification = "bing-token"

    get root_url

    assert_select "head meta[name='google-site-verification'][content='google-token']", count: 1
    assert_select "head meta[name='msvalidate.01'][content='bing-token']", count: 1
  end

  test "verification tokens render without a measurement id, because ownership is separate" do
    @analytics.google_site_verification = "google-token"

    get root_url

    assert_select "meta[name='google-site-verification']", count: 1
    assert_no_match(/googletagmanager\.com/, response.body)
  end
end
