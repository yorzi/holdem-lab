require "test_helper"

class ContentPublicationWorkflowTest < ActiveSupport::TestCase
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

  test "reports stable blockers for a review-preview lesson" do
    stage_pending_review!

    readiness = workflow.readiness_for(slug: "position", locale: :en)

    assert_not readiness.fetch(:ready)
    assert_equal [ "domain_review_not_approved" ], readiness.fetch(:blocker_codes)
    assert_equal 11, readiness.fetch(:blockers).length
    assert_equal %w[asset lesson concept concept concept exercise exercise exercise source_reference source_reference source_reference],
      readiness.fetch(:blockers).map { |blocker| blocker.fetch(:record_type) }
  end

  test "reports every locale asset without mutating the mirror" do
    stage_pending_review!

    report = workflow.readiness_report

    assert_equal 6, report.length
    assert_equal %w[en zh], report.filter_map { |item| item.fetch(:locale) if item.fetch(:slug) == "position" }
    assert report.all? { |item| item.fetch(:blocker_codes) == [ "domain_review_not_approved" ] }
    assert_equal({ "review_preview" => 6 }, ContentAsset.group(:publication_status).count)
  end

  test "refuses to promote a lesson while any review gate is blocked" do
    stage_pending_review!

    error = assert_raises(Content::PublicationWorkflow::BlockedError) do
      workflow.promote!(slug: "position", locale: :en)
    end

    assert_equal [ "domain_review_not_approved" ], error.readiness.fetch(:blocker_codes)
    assert_equal "review_preview", ContentAsset.find_by!(asset_id: "lesson-position-en-v1").publication_status
    assert_equal "review_preview", Content::Lesson.find_by!(slug: "position").publication_status
  end

  test "reports status blockers for records outside the review-preview scope" do
    asset = ContentAsset.find_by!(asset_id: "lesson-position-en-v1")
    asset.update!(publication_status: "draft")

    readiness = workflow.readiness_for(slug: "position", locale: :en)

    assert_includes readiness.fetch(:blocker_codes), "record_not_review_preview"
    assert_not_includes readiness.fetch(:blocker_codes), "missing_lesson_graph"
  end

  test "reports canonical registry drift as a stable publication blocker" do
    Content::RegistrySnapshot.find_by!(layer: "sources").update_columns(registry_digest: "0" * 64)

    readiness = workflow.readiness_for(slug: "position", locale: :en)

    assert_includes readiness.fetch(:blocker_codes), "canonical_registry_drifted"
    blocker = readiness.fetch(:blockers).find { |item| item.fetch(:code) == "canonical_registry_drifted" }
    assert_equal "canonical_registry", blocker.fetch(:record_type)
    assert_equal [ "sources" ], blocker.fetch(:layers)
  end

  test "reports per-record canonical binding drift as a stable blocker" do
    Content::Exercise.find_by!(exercise_id: "exercise-position-q1-v1").update_columns(
      canonical_registry_digest: "0" * 64
    )

    readiness = workflow.readiness_for(slug: "position", locale: :en)

    assert_includes readiness.fetch(:blocker_codes), "canonical_record_binding_drifted"
    blocker = readiness.fetch(:blockers).find { |item| item.fetch(:code) == "canonical_record_binding_drifted" }
    assert_equal "exercise", blocker.fetch(:record_type)
    assert_equal "exercise-position-q1-v1", blocker.fetch(:record_id)
  end

  test "requires review metadata after domain approval" do
    approve_candidate_records
    ContentAsset.update_all(domain_review_reviewer: nil)

    readiness = workflow.readiness_for(slug: "position", locale: :en)

    assert_includes readiness.fetch(:blocker_codes), "domain_review_metadata_missing"
    assert_not readiness.fetch(:ready)
  end

  test "promotes only the selected locale asset after all gates pass" do
    approve_candidate_records

    result = workflow.promote!(slug: "position", locale: :en)

    assert result.fetch(:ready)
    assert_empty result.fetch(:blocker_codes)
    assert_equal "published", ContentAsset.find_by!(asset_id: "lesson-position-en-v1").publication_status
    assert_equal "review_preview", ContentAsset.find_by!(asset_id: "lesson-position-zh-v1").publication_status
    assert_equal "published", Content::Lesson.find_by!(slug: "position").publication_status
    assert_equal 1, Content::Query.new.published_lessons(locale: :en).length
    assert_empty Content::Query.new.published_lessons(locale: :zh)
  end

  private

  def workflow
    @workflow ||= Content::PublicationWorkflow.new
  end

  # The shipped content files are now published and domain-approved, so the
  # blocked paths below have to stage their own pre-approval fixture instead of
  # leaning on the repository happening to hold unpublished records.
  def stage_pending_review!
    pending_attributes = {
      publication_status: "review_preview",
      domain_review_status: "pending",
      domain_review_reviewer: nil,
      domain_reviewed_at: nil
    }

    ContentAsset.update_all(pending_attributes)
    Content::Lesson.update_all(pending_attributes)
    Content::Concept.update_all(pending_attributes)
    Content::Exercise.update_all(pending_attributes)
    Content::SourceReference.update_all(pending_attributes)
  end

  def approve_candidate_records
    review_attributes = {
      publication_status: "review_preview",
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
