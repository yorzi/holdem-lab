require "test_helper"

class Content::RegistryControllerTest < ActionDispatch::IntegrationTest
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

  test "renders a read-only registry summary in test" do
    get content_registry_url

    assert_response :success
    assert_select "[data-content-registry]"
    assert_select "h1", /Candidate content registry/
    assert_select "table", count: 2
    assert_select "[data-publication-readiness] tbody tr", count: 3
    assert_select "body", /published: 6/
    assert_select "body", /Published English lessons available to the read-only query: 3/
  end
end
