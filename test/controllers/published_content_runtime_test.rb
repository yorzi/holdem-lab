require "test_helper"

class PublishedContentRuntimeTest < ActionDispatch::IntegrationTest
  setup do
    @previous_scope = Rails.application.config.x.content_runtime_scope
    Rails.application.config.x.content_runtime_scope = "published"

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

  teardown do
    Rails.application.config.x.content_runtime_scope = @previous_scope
  end

  test "published scope does not expose review-preview content" do
    demote_candidate_records

    get learn_url

    assert_response :not_found

    get position_lesson_url

    assert_response :not_found
  end

  test "published scope renders a fully approved graph through the canonical lesson route" do
    publish_candidate_records

    get learn_url

    assert_response :success
    assert_select "article[data-content-publication-status='published']", count: 3
    assert_select "a[href='#{position_lesson_path}']", text: /Open the Position lesson/

    get position_lesson_url

    assert_response :success
    assert_select "article[data-content-publication-status='published']", count: 1
    assert_select "h1", /Position is action order/
    # Editorial workflow state is internal; it must never surface as page copy.
    assert_select "body", { count: 0, text: /Review preview/ }
    assert_select "body", { count: 0, text: /domain review/ }
  end

  private

  # The shipped content files are published, so the fail-closed path has to
  # stage unpublished records itself rather than assume the repository holds any.
  def demote_candidate_records
    ContentAsset.update_all(publication_status: "review_preview")
    Content::Lesson.update_all(publication_status: "review_preview")
    Content::Concept.update_all(publication_status: "review_preview")
    Content::Exercise.update_all(publication_status: "review_preview")
    Content::SourceReference.update_all(publication_status: "review_preview")
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
