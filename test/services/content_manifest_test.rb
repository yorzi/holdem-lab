require "test_helper"

class ContentManifestTest < ActiveSupport::TestCase
  test "resolves a locale-specific lesson and its source packet from the manifest" do
    manifest = Content::Manifest.new

    assert_equal 6, manifest.lessons.length
    assert_equal "lesson-position-en-v1", manifest.lesson!(slug: "position", locale: :en).fetch("id")
    assert_equal "lesson-position-zh-v1", manifest.lesson!(slug: "position", locale: :zh).fetch("id")
    assert_equal "position-v1", manifest.source_packet_for(manifest.lesson!(slug: "position", locale: :zh)).fetch("id")
  end

  test "rejects an unknown lesson asset" do
    error = assert_raises(Content::Manifest::Error) do
      Content::Manifest.new.lesson!(slug: "unknown", locale: :en)
    end

    assert_match(/Unknown lesson asset/, error.message)
  end

  test "verifies the authored view digest recorded by the manifest" do
    record = Content::Manifest.new.lesson!(slug: "pot-odds", locale: :en)

    assert Content::Manifest.new.verify_asset!(record)
  end
end
