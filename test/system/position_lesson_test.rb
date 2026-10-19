require "application_system_test_case"

class PositionLessonTest < ApplicationSystemTestCase
  test "visitor completes the Position lesson and receives a session summary" do
    visit position_lesson_path

    assert_text "Position is action order before it is strategy."

    within "#position-q1" do
      choose "The button / small blind"
      click_on "Check answer"
      assert_text "Correct. Heads-up, the button/small blind acts first before the flop."
    end

    within "#position-q2" do
      choose "The big blind"
      click_on "Check answer"
      assert_text "Correct. On every postflop street, the big blind acts first"
    end

    within "#position-q3" do
      choose "Acting last reveals an action before your decision, but does not determine the best action"
      click_on "Check answer"
      assert_text "Correct. Position changes action order and information timing"
    end

    assert_selector "#position-session-summary:not([hidden])"
    within "#position-session-summary" do
      assert_text "3 / 3"
      assert_text "No concepts missed"
      assert_link "Apply the rule in Practice"
      click_on "Retry this lesson"
    end

    assert_selector "#position-session-summary[hidden]", visible: :all
    assert_equal "position-q1", page.evaluate_script("document.activeElement?.closest('fieldset')?.id")
  end

  test "session summary names concepts missed on the first checked answer" do
    visit position_lesson_path

    within "#position-q1" do
      choose "The big blind"
      click_on "Check answer"
    end
    within "#position-q2" do
      choose "The big blind"
      click_on "Check answer"
    end
    within "#position-q3" do
      choose "Acting last reveals an action before your decision, but does not determine the best action"
      click_on "Check answer"
    end

    within "#position-session-summary" do
      assert_text "2 / 3"
      assert_text "Review next: Preflop action order."
    end
  end
end
