require "test_helper"

class ContentRegistryMirrorTest < ActiveSupport::TestCase
  setup do
    Content::RegistrySnapshot.delete_all
  end

  test "imports and verifies one snapshot per canonical layer" do
    mirror = Content::RegistryMirror.new

    result = mirror.import!

    assert_equal({ created: 4, updated: 0, unchanged: 0, retired: 0 }, result)
    assert_equal %w[exercises source_references sources strategy], Content::RegistrySnapshot.order(:layer).pluck(:layer)
    assert_equal 13, Content::RegistrySnapshot.find_by!(layer: "sources").record_count
    assert mirror.verify!
  end

  test "re-importing unchanged registries is a no-op" do
    mirror = Content::RegistryMirror.new
    mirror.import!

    assert_equal({ created: 0, updated: 0, unchanged: 4, retired: 0 }, mirror.import!)
    assert mirror.verify!
  end

  test "detects a tampered registry digest snapshot" do
    mirror = Content::RegistryMirror.new
    mirror.import!
    Content::RegistrySnapshot.find_by!(layer: "sources").update_columns(registry_digest: "0" * 64)

    error = assert_raises(Content::RegistryMirror::Error) { mirror.verify! }

    assert_match(/Canonical registry mirror mismatch/, error.message)
  end

  test "requires explicit retirement for a removed layer" do
    mirror = Content::RegistryMirror.new
    mirror.import!
    reduced = ReducedRegistry.new(Content::CanonicalRegistry.new, without: "strategy")

    error = assert_raises(Content::RegistryMirror::Error) do
      Content::RegistryMirror.new(registry: reduced).import!
    end
    assert_match(/strategy/, error.message)

    result = Content::RegistryMirror.new(registry: reduced).import!(retire_missing: true)

    assert_equal 1, result.fetch(:retired)
    assert_equal "retired", Content::RegistrySnapshot.find_by!(layer: "strategy").status
    assert Content::RegistryMirror.new(registry: reduced).verify!
  end

  class ReducedRegistry
    def initialize(registry, without:)
      @registry = registry
      @without = without
    end

    def contract_id
      @registry.contract_id
    end

    def snapshots
      @registry.snapshots.reject { |snapshot| snapshot.fetch(:layer) == @without }
    end
  end
end
