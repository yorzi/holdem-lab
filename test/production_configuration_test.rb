require "test_helper"
require "open3"
require "rbconfig"

class ProductionConfigurationTest < ActiveSupport::TestCase
  test "a production fork boots without private credentials and never inherits measurement or hosts" do
    output, error, result = production_config

    assert result.success?, error
    config = JSON.parse(output.lines.last)
    assert_nil config.fetch("measurement_id")
    assert_equal false, config.fetch("telemetry")
    assert_equal false, config.fetch("import_enabled")
    assert_equal "https://learning.example.org", config.fetch("origin")
    assert_equal [ "learning.example.org" ], config.fetch("hosts")
    assert_equal "published", config.fetch("content_scope")
  end

  test "production requires its own HTTPS origin while asset builds need none" do
    _, error, result = production_config("PUBLIC_BASE_URL" => nil, "SECRET_KEY_BASE_DUMMY" => nil)
    refute result.success?
    assert_includes error, "Set PUBLIC_BASE_URL"

    _, error, result = production_config("PUBLIC_BASE_URL" => nil)
    assert result.success?, error
  end

  test "production rejects origin paths and wildcard host aliases" do
    _, error, result = production_config("PUBLIC_BASE_URL" => "https://learning.example.org/other")
    refute result.success?
    assert_includes error, "PUBLIC_BASE_URL must be an HTTPS origin"

    _, error, result = production_config("RAILS_ALLOWED_HOSTS" => "*.example.org")
    refute result.success?
    assert_includes error, "RAILS_ALLOWED_HOSTS must contain exact hostnames"
  end

  private

  def production_config(overrides = {})
    env = {
      "RAILS_ENV" => "production", "SECRET_KEY_BASE_DUMMY" => "1",
      "RAILS_MASTER_KEY" => nil, "SECRET_KEY_BASE" => nil,
      "PUBLIC_BASE_URL" => "https://learning.example.org", "RAILS_ALLOWED_HOSTS" => nil,
      "GA_MEASUREMENT_ID" => nil, "PRODUCT_TELEMETRY_ENABLED" => nil,
      "GOOGLE_SITE_VERIFICATION" => nil, "BING_SITE_VERIFICATION" => nil
    }.merge(overrides)
    script = <<~RUBY
      c = Rails.application.config
      puts JSON.generate(measurement_id: c.x.analytics.measurement_id,
        telemetry: c.x.telemetry_enabled, import_enabled: c.x.local_progress_import_enabled,
        origin: c.x.public_base_url, hosts: c.hosts, content_scope: c.x.content_runtime_scope)
    RUBY
    Open3.capture3(env, RbConfig.ruby, Rails.root.join("bin/rails").to_s, "runner", script)
  end
end
