# frozen_string_literal: true

# Build the ignored Kamal secrets files from the current deploy environment.
# The names are derived from config/deploy.yml so the workflow cannot silently
# omit a new env.secret or registry.password declaration.

require "fileutils"
require "yaml"

module MaterialiseKamalSecrets
  ROOT = ENV.fetch("KAMAL_SECRETS_ROOT") { File.expand_path("..", __dir__) }

  module_function

  def call
    names = declared_names
    missing = names.select { |name| ENV[name].to_s.empty? }
    abort "Missing required Kamal transport secrets: #{missing.join(', ')}" if missing.any?

    names.each { |name| write_value_file(name, ENV.fetch(name)) }
    write_secrets_file(names)
    puts "Materialised #{names.size} allowlisted Kamal transport secrets."
  end

  def declared_names
    config = YAML.load_file(File.join(ROOT, "config/deploy.yml"))
    (Array(config.dig("env", "secret")) + Array(config.dig("registry", "password"))).uniq
  end

  def value_path(name)
    File.join(".kamal", name.downcase.tr("_", "-"))
  end

  def write_value_file(name, value)
    path = File.join(ROOT, value_path(name))
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, value)
    File.chmod(0o600, path)
  end

  def write_secrets_file(names)
    body = names.map { |name| "#{name}=$(cat #{value_path(name)})" }.join("\n")
    path = File.join(ROOT, ".kamal/secrets")
    File.write(path, "#{body}\n")
    File.chmod(0o600, path)
  end
end

MaterialiseKamalSecrets.call if $PROGRAM_NAME == __FILE__
