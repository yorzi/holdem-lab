require "test_helper"

class ContentMirrorTest < ActiveSupport::TestCase
  setup do
    ContentAsset.delete_all
  end

  test "imports all lesson assets into SQLite" do
    result = Content::Mirror.new.import!

    assert_equal({ created: 6, updated: 0, unchanged: 0, retired: 0 }, result)
    assert_equal 6, ContentAsset.count
    assert_equal %w[pot-odds-v1], ContentAsset.find_by!(asset_id: "lesson-pot-odds-en-v1").source_packet_id_list
    assert_equal "published", ContentAsset.find_by!(asset_id: "lesson-position-zh-v1").publication_status
    assert Content::Mirror.new.verify!
  end

  test "re-importing an unchanged manifest is a no-op" do
    mirror = Content::Mirror.new
    mirror.import!

    result = mirror.import!

    assert_equal({ created: 0, updated: 0, unchanged: 6, retired: 0 }, result)
    assert Content::Mirror.new.verify!
  end

  test "detects a tampered SQLite mirror" do
    mirror = Content::Mirror.new
    mirror.import!
    ContentAsset.find_by!(asset_id: "lesson-position-en-v1").update_columns(asset_digest: "0" * 64)

    error = assert_raises(Content::Mirror::Error) { mirror.verify! }

    assert_match(/Content mirror mismatch/, error.message)
  end

  test "keeps an asset with incomplete review gates out of published scope" do
    Content::Mirror.new.import!
    asset = ContentAsset.find_by!(asset_id: "lesson-position-en-v1")
    # Withdraw the shipped approval so the gate itself is under test, not the
    # fact that the current content files happen to carry one.
    asset.domain_review_status = "pending"
    asset.domain_review_reviewer = nil
    asset.domain_reviewed_at = nil
    asset.publication_status = "published"

    assert_not asset.valid?
    assert_includes asset.errors[:publication_status], "requires approved domain review"
  end
end
