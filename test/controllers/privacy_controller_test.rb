require "test_helper"

class PrivacyControllerTest < ActionDispatch::IntegrationTest
  # Google Analytics' own terms require a published notice covering the data it
  # collects and the cookies it sets, and AGENTS.md requires the same before any
  # collector exists. This page is that notice; the assertions below pin the
  # claims the app has to keep true.
  test "the English page names what is measured and what is never sent" do
    get privacy_url

    assert_response :success
    assert_select "h1", /What we measure/
    assert_select "body", /Google Analytics 4/
    assert_select "body", /hole cards/
    assert_select "body", /Password reset links/
    assert_select "body", /14 months/
    assert_select "[data-analytics-consent-manage]", count: 1
    assert_select "a[href='#{profile_settings_path}']", minimum: 1
  end

  test "the Chinese sibling is authored, not a fallback to English" do
    get privacy_url(locale: :zh)

    assert_response :success
    assert_select "h1", /我们统计什么/
    assert_select "body", /底牌/
    assert_select "body", /Global Privacy Control/
    assert_select "[data-analytics-consent-manage]", count: 1
    assert_select "html[lang='zh-Hans']"
  end

  test "the privacy page is reachable from every page and advertised to crawlers" do
    get root_url
    assert_select "footer a[href='#{privacy_path}']", count: 1

    get "/sitemap.xml"
    assert_includes response.body, "<loc>#{privacy_url}</loc>"
    assert_includes response.body, "<loc>#{privacy_url(locale: :zh)}</loc>"
  end

  test "both editions declare each other as alternates" do
    get privacy_url

    assert_select "link[rel='canonical'][href='#{privacy_url}']"
    assert_select "link[rel='alternate'][hreflang='zh-Hans'][href='#{privacy_url(locale: :zh)}']"
  end
end
