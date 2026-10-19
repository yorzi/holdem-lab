require "test_helper"

class SeoControllerTest < ActionDispatch::IntegrationTest
  test "sitemap lists public bilingual URLs and localized alternates" do
    get "/sitemap.xml"

    assert_response :success
    assert_equal "application/xml", response.media_type
    assert_empty Nokogiri::XML(response.body).errors
    assert_includes response.body, "<loc>#{root_url}</loc>"
    assert_includes response.body, "<loc>#{root_url(locale: :zh)}</loc>"
    assert_includes response.body, "<loc>#{methodology_url}</loc>"
    assert_includes response.body, "<loc>#{practice_url}</loc>"
    assert_includes response.body, "<loc>#{position_lesson_url}</loc>"
    assert_includes response.body, "hreflang=\"zh-Hans\""
    assert_includes response.body, "hreflang=\"x-default\""
    refute_includes response.body, "/content/registry"
    # Lesson URLs carry the editorial review date as lastmod.
    assert_includes response.body, "<lastmod>2026-08-25</lastmod>"
  end

  test "published-only sitemap does not advertise review-preview lessons" do
    previous_scope = Rails.application.config.x.content_runtime_scope
    Rails.application.config.x.content_runtime_scope = "published"

    get "/sitemap.xml"

    assert_response :success
    refute_includes response.body, "/learn"
    assert_includes response.body, "<loc>#{root_url}</loc>"
  ensure
    Rails.application.config.x.content_runtime_scope = previous_scope
  end

  test "robots points crawlers to this instance and excludes private paths in both locales" do
    get "/robots.txt"

    assert_response :success
    assert_includes response.body, "Sitemap: #{root_url}sitemap.xml"
    assert_includes response.body, "Disallow: /settings/"
    assert_includes response.body, "Disallow: /sign-in"
    assert_includes response.body, "Disallow: /zh/settings/"
    assert_includes response.body, "Disallow: /zh/passwords/"
  end

  test "robots uses the configured public origin rather than a request host" do
    previous = Rails.application.config.x.public_base_url
    Rails.application.config.x.public_base_url = "https://learning.example.org"

    get "/robots.txt"

    assert_response :success
    assert_includes response.body, "Sitemap: https://learning.example.org/sitemap.xml"
    refute_includes response.body, "holdem-lab.example"
  ensure
    Rails.application.config.x.public_base_url = previous
  end
end
