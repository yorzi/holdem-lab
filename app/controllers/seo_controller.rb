class SeoController < ApplicationController
  STATIC_PUBLIC_PATHS = %w[/ /methodology /practice /privacy].freeze
  SITEMAP_LOCALES = { en: "en", zh: "zh-Hans" }.freeze

  allow_unauthenticated_access only: %i[sitemap robots]

  def robots
    render plain: <<~ROBOTS
      User-agent: *
      Allow: /

      Disallow: /api/
      Disallow: /content/registry
      Disallow: /passwords/
      Disallow: /settings/
      Disallow: /sign-in
      Disallow: /sign-up
      Disallow: /zh/passwords/
      Disallow: /zh/settings/
      Disallow: /zh/sign-in
      Disallow: /zh/sign-up

      Sitemap: #{public_base_url}/sitemap.xml
    ROBOTS
  end

  def sitemap
    @sitemap_entries = sitemap_entries
    render template: "seo/sitemap", formats: :xml, content_type: "application/xml"
  end

  private

  def sitemap_entries
    static_entries + learn_entries + lesson_entries
  end

  def static_entries
    STATIC_PUBLIC_PATHS.flat_map do |path|
      entries_for({ en: path, zh: localized_path(path, :zh) })
    end
  end

  def learn_entries
    paths = {}
    sitemap_locales.each do |locale|
      paths[locale] = localized_path("/learn", locale) if content_runtime.lessons(locale: locale).any?
    end

    entries_for(paths)
  end

  def lesson_entries
    paths_by_slug = Hash.new { |hash, slug| hash[slug] = {} }
    reviewed_by_slug = {}
    sitemap_locales.each do |locale|
      content_runtime.lessons(locale: locale).each do |page|
        asset = page.fetch(:asset)
        slug = asset.fetch("slug")
        paths_by_slug[slug][locale] = asset.fetch("route_path")
        # The editorial review date is the only honest "last modified" we hold.
        reviewed = asset.dig("domain_review", "reviewed_at")
        reviewed_by_slug[slug] = reviewed if reviewed.present?
      end
    end

    paths_by_slug.sort.flat_map { |slug, paths| entries_for(paths, lastmod: reviewed_by_slug[slug]) }
  end

  def entries_for(paths_by_locale, lastmod: nil)
    return [] if paths_by_locale.empty?

    alternate_urls = paths_by_locale.transform_values { |path| absolute_url_for_path(path) }
    alternates = alternate_urls.map do |locale, url|
      { hreflang: SITEMAP_LOCALES.fetch(locale), href: url }
    end
    alternates << { hreflang: "x-default", href: alternate_urls.fetch(:en) } if alternate_urls.key?(:en)

    paths_by_locale.sort_by { |locale, _path| locale.to_s }.map do |locale, path|
      { loc: absolute_url_for_path(path), alternates: alternates, lastmod: lastmod }
    end
  end

  def sitemap_locales
    SITEMAP_LOCALES.keys
  end

  def localized_path(path, locale)
    return path if locale == I18n.default_locale

    path == "/" ? "/#{locale}" : "/#{locale}#{path}"
  end

  def absolute_url_for_path(path)
    "#{public_base_url}#{path}"
  end

  def public_base_url
    configured_url = Rails.application.config.x.public_base_url.presence
    return configured_url.chomp("/") if configured_url

    "#{request.protocol}#{request.host_with_port}".chomp("/")
  end

  def content_runtime
    @content_runtime ||= Content::Runtime.new(scope: Rails.application.config.x.content_runtime_scope)
  end
end
