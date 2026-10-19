require "test_helper"

# The container runs bin/rails content:import on boot, which verifies the digest
# of every asset the canonical registry references. A file excluded from the
# image therefore does not fail a test — it crash-loops the container until the
# Kamal healthcheck times out, which is exactly how it reached production once.
class DeploymentImageContractTest < ActiveSupport::TestCase
  REGISTRY_FILES = %w[
    data/sources/source-registry-v1.json
    data/sources/source-reference-registry-v1.json
    data/exercises/exercise-templates-v1.json
    data/strategy/strategy-registry-v1.json
  ].freeze

  test "every asset the canonical registry verifies is present and shipped in the image" do
    patterns = dockerignore_patterns
    assert patterns.any?, "expected .dockerignore to contain exclusion patterns"

    referenced_paths.each do |path|
      assert Rails.root.join(path).file?, "#{path} is referenced by the canonical registry but missing from the repository"

      excluded_by = patterns.select { |pattern| excludes?(pattern, path) }
      assert_empty excluded_by,
        "#{path} is verified at boot by Content::CanonicalRegistry but .dockerignore keeps it out " \
        "of the image (#{excluded_by.join(", ")}). The container would crash-loop on deploy."
    end
  end

  test "the boot path imports every mirror the publication gate depends on" do
    seeds = Rails.root.join("db/seeds.rb").read
    entrypoint = Rails.root.join("bin/docker-entrypoint").read

    # A published lesson needs registry snapshots and the curriculum graph, not
    # just the asset mirror; importing less makes published scope fail closed.
    assert_match(/Content::RegistryMirror\.new\.import!/, seeds)
    assert_match(/Content::Mirror\.new\.import!/, seeds)
    assert_match(/Content::CatalogMirror\.new\.import!/, seeds)

    # db:prepare seeds only a brand new database, so an existing volume needs
    # the explicit import to pick up a release's content.
    assert_match(%r{bin/rails content:import}, entrypoint)
  end

  private

  def referenced_paths
    paths = REGISTRY_FILES.flat_map do |file|
      records = JSON.parse(Rails.root.join(file).read).fetch("records", [])
      records.flat_map { |record| record.values_at("asset_path", "runtime_path") }
    end

    paths.compact.uniq.tap { |list| assert list.any?, "expected registry files to reference assets" }
  end

  def dockerignore_patterns
    Rails.root.join(".dockerignore").read.lines.filter_map do |line|
      line = line.strip
      next if line.empty? || line.start_with?("#", "!")

      line.delete_prefix("/").delete_suffix("/")
    end
  end

  def excludes?(pattern, path)
    path == pattern || path.start_with?("#{pattern}/") || File.fnmatch?(pattern, path, File::FNM_PATHNAME)
  end
end
