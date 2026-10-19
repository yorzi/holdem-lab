require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module HoldemLab
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Anonymous progress import is local-development infrastructure, not a
    # production API. Environments must opt in explicitly.
    config.x.local_progress_import_enabled = false

    # Privacy-minimal DOM events are a local inspection contract only. No
    # environment has a collector or network transport by default.
    config.x.telemetry_enabled = false

    # Production SEO URLs should not depend on the request Host header. Local
    # environments fall back to their current request host for testability.
    config.x.public_base_url = ENV["PUBLIC_BASE_URL"].presence&.chomp("/")

    # Measurement is off unless an environment configures it. Both identifiers
    # are public — they are served in the HTML to every visitor — so they are
    # reviewed configuration, not vault secrets. ENV is here so a developer can
    # point a local browser at a throwaway GA4 debug stream without editing an
    # environment file. Production also requires explicit configuration.
    config.x.analytics.measurement_id = ENV["GA_MEASUREMENT_ID"].presence
    config.x.analytics.google_site_verification = ENV["GOOGLE_SITE_VERIFICATION"].presence
    config.x.analytics.bing_site_verification = ENV["BING_SITE_VERIFICATION"].presence

    # Candidate content is useful for local review; production must read only
    # the database-backed graph that passed every publication gate.
    config.x.content_runtime_scope = "review_preview"

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    config.i18n.load_path += Dir[Rails.root.join("config/locales/**/*.yml")]
    config.i18n.default_locale = :en
    config.i18n.available_locales = %i[en zh]
    config.i18n.fallbacks = { en: [ :en ], zh: [ :en ] }
  end
end
