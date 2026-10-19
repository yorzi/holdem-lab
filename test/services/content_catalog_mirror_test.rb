require "test_helper"

class ContentCatalogMirrorTest < ActiveSupport::TestCase
  setup do
    Content::Exercise.delete_all
    Content::Concept.delete_all
    Content::Lesson.delete_all
    Content::SourceReference.delete_all
  end

  test "imports the curriculum graph into four stable-id tables" do
    result = Content::CatalogMirror.new.import!

    assert_equal({ created: 3, updated: 0, unchanged: 0, retired: 0 }, result.fetch(:lessons))
    assert_equal({ created: 9, updated: 0, unchanged: 0, retired: 0 }, result.fetch(:concepts))
    assert_equal({ created: 9, updated: 0, unchanged: 0, retired: 0 }, result.fetch(:exercises))
    assert_equal({ created: 9, updated: 0, unchanged: 0, retired: 0 }, result.fetch(:source_references))
    assert_equal 3, Content::Lesson.count
    assert_equal 9, Content::Concept.count
    assert_equal 9, Content::Exercise.count
    assert_equal 9, Content::SourceReference.count

    position = Content::Lesson.find_by!(lesson_id: "curriculum-lesson-position-v1")
    assert_equal %w[
      concept-position-preflop-action-order
      concept-position-postflop-action-order
      concept-position-information-timing
    ], position.json_array(:concept_ids)
    assert_equal 3, position.concepts.count
    exercise = Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1")
    assert_equal "button", exercise.view_answer_value
    assert_equal "single_choice_retrieval", exercise.exercise_type
    assert_equal "rules_fact", exercise.answer_contract
    assert_equal "exercise-template-rules-fact-v1", exercise.canonical_template_id
    assert_equal "holdem-exercise-templates-v1", exercise.canonical_registry_id

    source_reference = Content::SourceReference.find_by!(
      source_reference_id: "source-ref-position-heads-up-order-v1"
    )
    assert_equal "poker_tda_rules_2024", source_reference.json_array(:source_ids).first
    assert_equal "external_claim", source_reference.kind
    assert_equal "verified", source_reference.integrity_status
    assert_equal "passed", source_reference.technical_review_status
    assert_equal "holdem-source-reference-registry-v1", source_reference.canonical_registry_id
  end

  test "re-importing an unchanged curriculum graph is a no-op" do
    mirror = Content::CatalogMirror.new
    mirror.import!

    result = mirror.import!

    assert_equal({ created: 0, updated: 0, unchanged: 3, retired: 0 }, result.fetch(:lessons))
    assert_equal({ created: 0, updated: 0, unchanged: 9, retired: 0 }, result.fetch(:concepts))
    assert_equal({ created: 0, updated: 0, unchanged: 9, retired: 0 }, result.fetch(:exercises))
    assert_equal({ created: 0, updated: 0, unchanged: 9, retired: 0 }, result.fetch(:source_references))
    assert Content::CatalogMirror.new.verify!
  end

  test "detects a tampered curriculum record" do
    mirror = Content::CatalogMirror.new
    mirror.import!
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(answer_code: "tampered")

    error = assert_raises(Content::CatalogMirror::Error) { mirror.verify! }

    assert_match(/Content catalog mirror mismatch/, error.message)
  end

  test "detects a tampered canonical record binding" do
    mirror = Content::CatalogMirror.new
    mirror.import!
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(
      canonical_registry_digest: "0" * 64
    )

    error = assert_raises(Content::CatalogMirror::Error) { mirror.verify! }

    assert_match(/canonical_registry_digest/, error.message)
  end

  test "rejects stale records unless explicit retirement is requested" do
    mirror = Content::CatalogMirror.new
    mirror.import!
    reduced_catalog = ReducedCatalog.new(Content::Catalog.new.data).without_lesson("position")
    reduced_mirror = Content::CatalogMirror.new(catalog: reduced_catalog)

    error = assert_raises(Content::CatalogMirror::Error) { reduced_mirror.import! }
    assert_match(/curriculum-lesson-position-v1/, error.message)

    result = reduced_mirror.import!(retire_missing: true)

    assert_equal 1, result.fetch(:lessons).fetch(:retired)
    assert_equal "retired", Content::Lesson.find_by!(lesson_id: "curriculum-lesson-position-v1").publication_status
  end

  test "published records require rights and review gates" do
    Content::CatalogMirror.new.import!
    exercise = Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1")
    # Withdraw the shipped approval so the gate itself is under test.
    exercise.domain_review_status = "pending"
    exercise.domain_review_reviewer = nil
    exercise.domain_reviewed_at = nil
    exercise.publication_status = "published"
    exercise.technical_review_status = "pending"

    assert_not exercise.valid?
    assert_includes exercise.errors[:publication_status], "requires approved domain review"
    assert_includes exercise.errors[:publication_status], "requires passed technical review"
  end

  class ReducedCatalog
    attr_reader :data

    def initialize(data)
      @data = JSON.parse(JSON.generate(data))
    end

    def without_lesson(slug)
      lesson = data.fetch("lessons").find { |item| item.fetch("slug") == slug }
      concept_ids = lesson.fetch("concept_ids")
      exercise_ids = lesson.fetch("exercise_ids")
      source_reference_ids = lesson.fetch("source_reference_ids")
      data["lessons"] = data.fetch("lessons").reject { |item| item.fetch("slug") == slug }
      data["concepts"] = data.fetch("concepts").reject { |item| concept_ids.include?(item.fetch("id")) }
      data["exercises"] = data.fetch("exercises").reject { |item| exercise_ids.include?(item.fetch("id")) }
      data["source_references"] = data.fetch("source_references").reject do |item|
        source_reference_ids.include?(item.fetch("id"))
      end
      self
    end

    def lessons
      data.fetch("lessons")
    end

    def concepts
      data.fetch("concepts")
    end

    def exercises
      data.fetch("exercises")
    end

    def source_references
      data.fetch("source_references")
    end
  end
end
