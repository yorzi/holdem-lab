require "test_helper"

class ContentRuntimeTest < ActiveSupport::TestCase
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

  test "review preview runtime serves manifest-backed candidate pages" do
    page = runtime(scope: :review_preview).lesson!(slug: "position", locale: :en)

    assert_equal "review_preview", page.fetch(:scope)
    assert_equal "lesson-position-en-v1", page.fetch(:asset).fetch("id")
    assert_equal "curriculum-lesson-position-v1", page.fetch(:curriculum).fetch("id")
    assert_equal "pending", page.fetch(:source_packet).dig("domain_review", "status")
  end

  test "published runtime serves only a fully published graph" do
    publish_candidate_records

    page = runtime(scope: :published).lesson!(slug: "position", locale: :en)

    assert_equal "published", page.fetch(:scope)
    assert_equal "published", page.fetch(:asset).fetch("publication_status")
    assert_equal "approved", page.fetch(:source_packet).dig("domain_review", "status")
    assert_equal "reviewer-1", page.fetch(:source_packet).dig("domain_review", "reviewer")
    assert_equal 3, runtime(scope: :published).lessons(locale: :en).length
  end

  test "published runtime returns not found while the graph is only a candidate" do
    # Demote the shipped records so the not-found path is exercised on purpose.
    Content::Lesson.update_all(publication_status: "review_preview")
    Content::Concept.update_all(publication_status: "review_preview")
    Content::Exercise.update_all(publication_status: "review_preview")
    Content::SourceReference.update_all(publication_status: "review_preview")
    ContentAsset.update_all(publication_status: "review_preview")

    error = assert_raises(Content::Runtime::NotFound) do
      runtime(scope: :published).lesson!(slug: "position", locale: :en)
    end

    assert_match(/No published lesson/, error.message)
    assert_empty runtime(scope: :published).lessons(locale: :en)
  end

  test "published runtime rejects a database asset that no longer matches its manifest" do
    publish_candidate_records
    ContentAsset.find_by!(asset_id: "lesson-position-en-v1").update!(asset_digest: "0" * 64)

    error = assert_raises(Content::Runtime::Error) do
      runtime(scope: :published).lesson!(slug: "position", locale: :en)
    end

    assert_match(/does not match its manifest/, error.message)
  end

  private

  def runtime(scope:)
    Content::Runtime.new(scope: scope)
  end

  def publish_candidate_records
    review_attributes = {
      publication_status: "published",
      domain_review_status: "approved",
      domain_review_reviewer: "reviewer-1",
      domain_reviewed_at: "2026-08-21"
    }

    ContentAsset.update_all(review_attributes)
    Content::Lesson.update_all(review_attributes)
    Content::Concept.update_all(review_attributes)
    Content::Exercise.update_all(review_attributes)
    Content::SourceReference.update_all(review_attributes)
  end
end
