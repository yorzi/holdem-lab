module ApplicationHelper
  SUPPORTED_LOCALE_CODES = %i[en zh].freeze

  def current_locale
    I18n.locale
  end

  def locale_html_tag
    current_locale == :zh ? "zh-Hans" : current_locale.to_s
  end

  def default_locale?
    current_locale == I18n.default_locale
  end

  def site_nav_active?(section)
    normalized_path = request.path.sub(%r{\A/zh}, "")

    case section.to_sym
    when :learn
      normalized_path == "/learn" || normalized_path.start_with?("/learn/")
    when :practice
      normalized_path == "/practice"
    when :methodology
      normalized_path == "/methodology"
    else
      false
    end
  end

  def locale_switch_path(locale, preserve_query: true)
    localized_path = locale_path_for(locale)
    return localized_path unless preserve_query

    query = request.query_parameters.to_query
    query.empty? ? localized_path : "#{localized_path}?#{query}"
  end

  def canonical_url
    absolute_url_for(locale_path_for(current_locale))
  end

  def absolute_url_for(path)
    normalized_path = path.to_s
    normalized_path = "/#{normalized_path}" unless normalized_path.start_with?("/")
    "#{public_base_url}#{normalized_path}"
  end

  def seo_title
    content_for(:title).presence || t("site.title")
  end

  def seo_description
    content_for(:description).presence || t("site.description")
  end

  def seo_robots
    content_for(:robots).presence || "index, follow"
  end

  def seo_og_type
    content_for(:og_type).presence || "website"
  end

  def seo_image_url
    image_path = current_locale == :zh ? "/og-image-zh.png" : "/og-image.png"
    absolute_url_for(image_path)
  end

  def seo_og_locale
    current_locale == :zh ? "zh_CN" : "en_US"
  end

  def seo_alternate_og_locale
    current_locale == :zh ? "en_US" : "zh_CN"
  end

  def structured_data_script(data)
    tag.script(raw(json_escape(data.to_json)), type: "application/ld+json")
  end

  def site_structured_data
    organization_id = "#{public_base_url}/#organization"

    {
      "@context" => "https://schema.org",
      "@graph" => [
        {
          "@type" => "Organization",
          "@id" => organization_id,
          "name" => t("site.title"),
          "url" => public_base_url,
          "logo" => {
            "@type" => "ImageObject",
            "url" => absolute_url_for("/icon.png")
          }
        },
        {
          "@type" => "WebSite",
          "@id" => "#{public_base_url}/#website",
          "url" => public_base_url,
          "name" => t("site.title"),
          "description" => t("site.description"),
          "inLanguage" => locale_html_tag,
          "publisher" => { "@id" => organization_id }
        }
      ]
    }
  end

  def breadcrumb_structured_data(items)
    {
      "@context" => "https://schema.org",
      "@type" => "BreadcrumbList",
      "itemListElement" => items.each_with_index.map do |(name, url), index|
        {
          "@type" => "ListItem",
          "position" => index + 1,
          "name" => name,
          "item" => url
        }
      end
    }
  end

  def course_list_structured_data(courses)
    {
      "@context" => "https://schema.org",
      "@type" => "ItemList",
      "itemListElement" => courses.each_with_index.map do |course, index|
        {
          "@type" => "ListItem",
          "position" => index + 1,
          "item" => {
            "@type" => "Course",
            "name" => course.fetch(:name),
            "description" => course.fetch(:description),
            "url" => course.fetch(:url),
            "inLanguage" => locale_html_tag,
            "isAccessibleForFree" => true,
            "provider" => { "@type" => "Organization", "name" => t("site.title"), "url" => public_base_url }
          }
        }
      end
    }
  end

  def learning_resource_structured_data(name:, description:, url:, time_required: nil, reviewed_at: nil)
    {
      "@context" => "https://schema.org",
      "@type" => "LearningResource",
      "name" => name,
      "description" => description,
      "url" => url,
      "inLanguage" => locale_html_tag,
      "isAccessibleForFree" => true,
      "learningResourceType" => "Lesson",
      "educationalLevel" => "Beginner",
      "about" => { "@type" => "Thing", "name" => "No-Limit Texas Hold'em" },
      "provider" => { "@type" => "Organization", "name" => t("site.title"), "url" => public_base_url }
    }.tap do |data|
      data["timeRequired"] = time_required if time_required
      # The review date is a real editorial record, not a build timestamp.
      data["dateModified"] = reviewed_at if reviewed_at.present?
    end
  end

  def faq_structured_data(entries)
    {
      "@context" => "https://schema.org",
      "@type" => "FAQPage",
      "mainEntity" => entries.map do |question, answer|
        {
          "@type" => "Question",
          "name" => question,
          "acceptedAnswer" => { "@type" => "Answer", "text" => answer }
        }
      end
    }
  end

  private

  def public_base_url
    configured_url = Rails.application.config.x.public_base_url.presence
    return configured_url.chomp("/") if configured_url

    "#{request.protocol}#{request.host_with_port}".chomp("/")
  end

  def locale_path_for(locale)
    target = normalize_locale(locale)
    unprefixed_path = request.path.sub(%r{\A/zh(?=/|$)}, "")
    unprefixed_path = "/" if unprefixed_path.empty?
    target == I18n.default_locale ? unprefixed_path : "/#{target}#{unprefixed_path == "/" ? "" : unprefixed_path}"
  end

  def normalize_locale(locale)
    candidate = locale.to_s.downcase.to_sym
    return candidate if SUPPORTED_LOCALE_CODES.include?(candidate)

    I18n.default_locale
  end
end
