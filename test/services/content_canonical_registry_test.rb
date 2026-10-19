require "test_helper"

class ContentCanonicalRegistryTest < ActiveSupport::TestCase
  test "loads versioned layers and validates catalog cross-references" do
    registry = Content::CanonicalRegistry.new
    snapshots = registry.snapshots

    assert_equal "holdem-canonical-content-v1", registry.contract_id
    assert_equal %w[exercises sources source_references strategy], snapshots.map { |snapshot| snapshot.fetch(:layer) }
    assert_equal [ 7, 13, 9, 1 ], snapshots.map { |snapshot| snapshot.fetch(:record_count) }
    assert snapshots.all? { |snapshot| snapshot.fetch(:registry_digest).match?(/\A[a-f0-9]{64}\z/) }
    assert registry.validate_catalog!(Content::Catalog.new.data)

    exercise = Content::Catalog.new.exercise!(id: "exercise-position-q1-v1")
    assert_equal "exercise-template-rules-fact-v1",
      registry.exercise_template_for(exercise).fetch("template_id")
    assert_equal "poker_tda_rules_2024", registry.source!("poker_tda_rules_2024").fetch("source_id")
    assert_equal "position-heads-up-order",
      registry.source_reference_for(Content::Catalog.new.source_reference!(id: "source-ref-position-heads-up-order-v1")).fetch("claim_id")
  end

  test "rejects a catalog exercise whose canonical template contract drifts" do
    data = JSON.parse(JSON.generate(Content::Catalog.new.data))
    data.fetch("exercises").first["answer_contract"] = "modeling_boundary"

    error = assert_raises(Content::CanonicalRegistry::Error) do
      Content::CanonicalRegistry.new.validate_catalog!(data)
    end

    assert_match(/does not match .*type or answer contract/, error.message)
  end
end
