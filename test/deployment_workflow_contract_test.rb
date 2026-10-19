# frozen_string_literal: true

require "test_helper"
require "fileutils"
require "open3"
require "rbconfig"
require "tmpdir"
require "yaml"

class DeploymentWorkflowContractTest < ActiveSupport::TestCase
  test "production deployment is one gated job in the existing CI workflow" do
    workflow = Rails.root.join(".github/workflows/ci.yml").read

    assert_includes workflow, "workflow_dispatch:"
    assert_includes workflow, "inputs.deploy == true"
    assert_includes workflow, "vars.ENABLE_DEPLOY == 'true'"
    refute_includes workflow, "github.event_name == 'push' ||"
    assert_includes workflow, "name: Deploy (Kamal)"
    assert_includes workflow, "needs: [ scan_ruby, scan_js, lint, test, system-test ]"
    assert_includes workflow, "environment: production"
    assert_includes workflow, "group: deploy-production"
    assert_includes workflow, "uses: docker/setup-buildx-action@v4"
    assert_includes workflow, "secrets.SSH_PRIVATE_KEY"
    assert_includes workflow, "vars.SSH_KNOWN_HOSTS"
    assert_includes workflow, "ruby script/materialise_kamal_secrets.rb"
    assert_includes workflow, "VERSION: ${{ github.sha }}"
    assert_includes workflow, "bundle exec kamal deploy"
    refute_includes workflow, "toJSON(secrets)"
  end

  test "workflow passes every Kamal secret declared by deploy config" do
    workflow = Rails.root.join(".github/workflows/ci.yml").read
    deploy = YAML.load_file(Rails.root.join("config/deploy.yml"))
    declared = (Array(deploy.dig("env", "secret")) + Array(deploy.dig("registry", "password"))).uniq

    refute_empty declared
    declared.each do |name|
      assert_includes workflow, "#{name}: ${{ secrets.#{name} }}",
        "#{name} is declared in config/deploy.yml but not passed by the deploy job"
    end
  end

  test "secret materialisation is allowlisted and rejects missing values" do
    Dir.mktmpdir("holdem-kamal-secrets") do |root|
      root_path = Pathname.new(root)
      FileUtils.mkdir_p(root_path.join("config"))
      FileUtils.cp(Rails.root.join("config/deploy.yml"), root_path.join("config/deploy.yml"))

      env = {
        "KAMAL_SECRETS_ROOT" => root,
        "KAMAL_REGISTRY_PASSWORD" => "fixture-registry-value",
        "SECRET_KEY_BASE" => "fixture-session-value"
      }
      output, error, result = Open3.capture3(env, RbConfig.ruby, Rails.root.join("script/materialise_kamal_secrets.rb").to_s)

      assert result.success?, "materialisation failed: #{output}#{error}"
      generated = root_path.join(".kamal/secrets").read
      assert_equal %w[SECRET_KEY_BASE KAMAL_REGISTRY_PASSWORD], generated.lines.map { |line| line.split("=", 2).first }
      refute_includes generated, "fixture-registry-value"
      refute_includes generated, "fixture-session-value"
      assert_equal "fixture-registry-value", root_path.join(".kamal/kamal-registry-password").read
      assert_equal "fixture-session-value", root_path.join(".kamal/secret-key-base").read

      _, missing_error, missing_result = Open3.capture3(
        env.except("SECRET_KEY_BASE"),
        RbConfig.ruby,
        Rails.root.join("script/materialise_kamal_secrets.rb").to_s
      )
      refute missing_result.success?
      assert_includes missing_error, "SECRET_KEY_BASE"
    end
  end
end
