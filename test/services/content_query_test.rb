require "test_helper"

class ContentQueryTest < ActiveSupport::TestCase
  setup do
    Content::Exercise.delete_all
    Content::Concept.delete_all
    Content::Lesson.delete_all
    Content::SourceReference.delete_all
    ContentAsset.delete_all
    Content::RegistrySnapshot.delete_all

    Content::Mirror.new.import!
    Content::RegistryMirror.new.import!
    Content::CatalogMirror.new.import!
  end

  test "returns a complete review-preview lesson in graph order" do
    result = Content::Query.new.review_preview_lesson(slug: "position", locale: :en)

    assert_equal "lesson-position-en-v1", result.fetch(:asset).asset_id
    assert_equal "curriculum-lesson-position-v1", result.fetch(:lesson).lesson_id
    assert_equal %w[
      concept-position-preflop-action-order
      concept-position-postflop-action-order
      concept-position-information-timing
    ], result.fetch(:concepts).map(&:concept_id)
    assert_equal %w[
      exercise-position-q1-v1
      exercise-position-q2-v1
      exercise-position-q3-v1
    ], result.fetch(:exercises).map(&:exercise_id)
  end

  test "published scope stays empty while records are review preview" do
    Content::Lesson.update_all(publication_status: "review_preview")
    Content::Concept.update_all(publication_status: "review_preview")
    Content::Exercise.update_all(publication_status: "review_preview")
    Content::SourceReference.update_all(publication_status: "review_preview")
    ContentAsset.update_all(publication_status: "review_preview")

    assert_empty Content::Query.new.published_lessons(locale: :en)
  end

  test "published scope requires every linked record to be published" do
    publish_candidate_records

    assert_equal 3, Content::Query.new.published_lessons(locale: :en).length

    Content::Exercise.where(exercise_id: "exercise-position-q1-v1").update_all(publication_status: "review_preview")

    assert_equal 2, Content::Query.new.published_lessons(locale: :en).length

    Content::Exercise.where(exercise_id: "exercise-pot-odds-q1-v1").update_all(domain_review_status: "pending")

    assert_equal 1, Content::Query.new.published_lessons(locale: :en).length
  end

  test "published scope fails closed when a canonical registry snapshot drifts" do
    publish_candidate_records
    Content::RegistrySnapshot.find_by!(layer: "sources").update_columns(registry_digest: "0" * 64)

    query = Content::Query.new

    assert_not query.canonical_registry_status.fetch(:ready)
    assert_equal "canonical_registry_drifted", query.canonical_registry_status.fetch(:code)
    assert_empty query.published_lessons(locale: :en)
  end

  test "published scope fails closed when a canonical registry snapshot is missing" do
    publish_candidate_records
    Content::RegistrySnapshot.find_by!(layer: "strategy").delete

    query = Content::Query.new

    assert_equal "canonical_registry_snapshot_missing", query.canonical_registry_status.fetch(:code)
    assert_empty query.published_lessons(locale: :en)
  end

  test "published scope fails closed when a canonical exercise binding drifts" do
    publish_candidate_records
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(
      canonical_registry_digest: "0" * 64
    )

    query = Content::Query.new

    assert_not query.canonical_record_binding_valid?(Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1"))
    assert_equal 2, query.published_lessons(locale: :en).length
    assert_nil query.published_lesson(slug: "position", locale: :en)
  end

  test "published scope fails closed when a canonical exercise type drifts" do
    publish_candidate_records
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(
      exercise_type: "unsupported_type"
    )

    query = Content::Query.new

    assert_not query.canonical_record_binding_valid?(
      Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1")
    )
    assert_equal 2, query.published_lessons(locale: :en).length
    assert_nil query.published_lesson(slug: "position", locale: :en)
  end

  test "published scope fails closed when a canonical answer contract drifts" do
    publish_candidate_records
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(
      answer_contract: "unsupported_contract"
    )

    query = Content::Query.new

    assert_not query.canonical_record_binding_valid?(
      Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1")
    )
    assert_equal 2, query.published_lessons(locale: :en).length
    assert_nil query.published_lesson(slug: "position", locale: :en)
  end

  test "published scope requires source-reference integrity and canonical fields" do
    publish_candidate_records
    Content::SourceReference.find_by!(source_reference_id: "source-ref-position-heads-up-order-v1").update_columns(
      integrity_status: "failed"
    )

    query = Content::Query.new

    assert_not query.canonical_record_binding_valid?(
      Content::SourceReference.find_by!(source_reference_id: "source-ref-position-heads-up-order-v1")
    )
    assert_equal 2, query.published_lessons(locale: :en).length
    assert_nil query.published_lesson(slug: "position", locale: :en)
  end

  test "published lesson query is exact by slug and locale" do
    publish_candidate_records

    result = Content::Query.new.published_lesson(slug: "position", locale: :en)
    zh_result = Content::Query.new.published_lesson(slug: "position", locale: :zh)

    assert_equal "lesson-position-en-v1", result.fetch(:asset).asset_id
    assert_equal "lesson-position-zh-v1", zh_result.fetch(:asset).asset_id
    assert_nil Content::Query.new.published_lesson(slug: "missing", locale: :en)
  end

  test "does not return a partial lesson graph" do
    Content::Concept.find_by!(concept_id: "concept-position-information-timing").delete

    assert_nil Content::Query.new.review_preview_lesson(slug: "position", locale: :en)
  end

  test "snapshot exposes counts and locale asset status without publishing" do
    snapshot = Content::Query.new.snapshot

    assert_equal({ "published" => 6 }, snapshot.fetch(:asset_counts))
    assert_equal({ "published" => 3 }, snapshot.fetch(:lesson_counts))
    assert snapshot.fetch(:canonical_registry_status).fetch(:ready)
    assert_equal %w[exercises sources source_references strategy],
      snapshot.fetch(:canonical_registry).fetch(:layers).map { |layer| layer.fetch(:layer) }
    assert_equal 3, snapshot.fetch(:lessons).length
    assert_equal %w[en zh], snapshot.fetch(:lessons).first.fetch(:assets).map { |asset| asset.fetch(:locale) }
  end

  private

  def publish_candidate_records
    review_attributes = {
      publication_status: "published",
      domain_review_status: "approved",
      domain_review_reviewer: "reviewer-1",
      domain_reviewed_at: "2026-08-20"
    }

    ContentAsset.update_all(review_attributes)
    Content::Lesson.update_all(review_attributes)
    Content::Concept.update_all(review_attributes)
    Content::Exercise.update_all(review_attributes)
    Content::SourceReference.update_all(review_attributes)
  end
end
