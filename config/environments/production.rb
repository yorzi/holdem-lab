require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.x.local_progress_import_enabled = false
  # Forks must explicitly configure their own collector and review its privacy
  # boundary. No default measurement id or product-event collection ships.
  config.x.telemetry_enabled = ENV["PRODUCT_TELEMETRY_ENABLED"] == "true"
  config.x.content_runtime_scope = "published"
  config.x.public_base_url = ENV["PUBLIC_BASE_URL"].presence&.chomp("/")
  public_origin = URI(config.x.public_base_url) if config.x.public_base_url
  if public_origin
    unless public_origin.scheme == "https" && public_origin.host.present? &&
        public_origin.userinfo.nil? && public_origin.query.nil? && public_origin.fragment.nil? && public_origin.path.empty?
      raise "PUBLIC_BASE_URL must be an HTTPS origin without a path, query, or credentials"
    end
  elsif !ENV["SECRET_KEY_BASE_DUMMY"]
    raise "Set PUBLIC_BASE_URL to your HTTPS origin"
  end

  # Blank disables the tag entirely, including its network loader and banner.
  config.x.analytics.measurement_id = ENV["GA_MEASUREMENT_ID"].presence
  # Unset because ownership is verified by DNS TXT on the Domain property,
  # which covers apex, www, and http alike. Fill this in only if a URL-prefix
  # property is added, and then keep it deployed for as long as it exists.
  config.x.analytics.google_site_verification = ENV.fetch("GOOGLE_SITE_VERIFICATION", "").presence
  config.x.analytics.bing_site_verification = ENV.fetch("BING_SITE_VERIFICATION", "").presence
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Turn on fragment caching in view templates.
  config.action_controller.perform_caching = true

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Store uploaded files on the local file system (see config/storage.yml for options).
  config.active_storage.service = :local

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = true

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = true

  # Skip http-to-https redirect for the default health check endpoint.
  config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  config.cache_store = :solid_cache_store

  # Replace the default in-process and non-durable queuing backend for Active Job.
  config.active_job.queue_adapter = :solid_queue
  config.solid_queue.connects_to = { database: { writing: :queue } }

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Set host to be used by links generated in mailer templates.
  config.action_mailer.default_url_options = { host: public_origin.host, protocol: "https", port: public_origin.port } if public_origin

  # Specify outgoing SMTP server. Remember to add smtp/* credentials via bin/rails credentials:edit.
  # config.action_mailer.smtp_settings = {
  #   user_name: Rails.application.credentials.dig(:smtp, :user_name),
  #   password: Rails.application.credentials.dig(:smtp, :password),
  #   address: "smtp.example.com",
  #   port: 587,
  #   authentication: :plain
  # }

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Enable DNS rebinding protection and other `Host` header attacks.
  # Exact deployment host plus optional aliases; never trust arbitrary hosts.
  extra_hosts = ENV.fetch("RAILS_ALLOWED_HOSTS", "").split(",").map(&:strip).compact_blank
  unless extra_hosts.all? { |host| host.match?(/\A[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\z/i) }
    raise "RAILS_ALLOWED_HOSTS must contain exact hostnames only"
  end
  config.hosts = [ public_origin&.host || "example.invalid", *extra_hosts ]
  #
  # Skip DNS rebinding protection for the default health check endpoint.
  config.host_authorization = { exclude: ->(request) { request.path == "/up" } }
end
