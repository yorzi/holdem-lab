require "test_helper"

class ContentCatalogTest < ActiveSupport::TestCase
  test "exposes the ordered lesson graph and stable exercise ids" do
    catalog = Content::Catalog.new

    assert_equal %w[position pot-odds decision-quality], catalog.lessons.map { |lesson| lesson.fetch("slug") }
    position = catalog.lesson!(slug: "position")
    exercise = catalog.exercise!(id: "exercise-position-q1-v1")

    assert_equal "curriculum-lesson-position-v1", position.fetch("id")
    assert_equal position.fetch("exercise_ids"), catalog.exercises_for(slug: "position").map { |item| item.fetch("id") }
    assert_equal "concept-position-preflop-action-order", exercise.fetch("concept_id")
    assert_equal "button", exercise.fetch("view_answer_value")
  end

  test "keeps English and independently authored Chinese concept display copy" do
    concept = Content::Catalog.new.concept!(id: "concept-position-information-timing")

    assert_match(/Information timing/, concept.dig("display", "en", "title"))
    assert_match(/信息时机/, concept.dig("display", "zh", "title"))
  end

  test "rejects an unknown curriculum id" do
    error = assert_raises(Content::Catalog::Error) do
      Content::Catalog.new.exercise!(id: "exercise-does-not-exist")
    end

    assert_match(/Unknown curriculum exercise/, error.message)
  end
end
