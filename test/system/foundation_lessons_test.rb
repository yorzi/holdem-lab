require "application_system_test_case"

class FoundationLessonsTest < ApplicationSystemTestCase
  test "visitor completes the Pot Odds lesson with evidence coverage in the summary" do
    visit pot_odds_lesson_path
    page.execute_script(<<~JS)
      window.__hmTelemetryEvents = []
      window.addEventListener('holdem:telemetry', (event) => window.__hmTelemetryEvents.push(event.detail))
    JS
    fill_in "Before feedback, explain your denominator.", with: "The denominator is the pot after adding my call."
    select "4 · Confident", from: "Confidence before feedback"

    within "#pot-odds-q1" do
      choose "25%"
      click_on "Check answer"
    end
    within "#pot-odds-q2" do
      choose "28.6%"
      click_on "Check answer"
    end
    within "#pot-odds-q3" do
      choose "A defensible equity estimate against an explicit opponent range"
      click_on "Check answer"
    end

    within "#pot-odds-session-summary" do
      assert_text "3 / 3"
      assert_text "The denominator is the pot after adding my call."
      assert_text "4 / 5 before feedback"
      assert_text "recomputed from the formula stated above"
      assert_link "Continue to Decision Quality"
    end

    events = page.evaluate_script("window.__hmTelemetryEvents")
    assert_equal [ "session_complete" ], events.map { |event| event.fetch("name") }
    assert_equal %w[lessonSlug name schemaVersion scoreBand], events.last.keys.sort
  end

  test "visitor completes the Decision Quality lesson without turning outcome into a verdict" do
    visit decision_quality_lesson_path
    fill_in "Before feedback, define a fair review.", with: "Freeze the information, assumptions, action, and confidence before the result."

    within "#decision-quality-q1" do
      choose "The outcome is negative; decision quality still requires a decision-time review"
      click_on "Check answer"
    end
    within "#decision-quality-q2" do
      choose "A calibration signal to compare across repeated attempts"
      click_on "Check answer"
    end
    within "#decision-quality-q3" do
      choose "The decision-time state, assumptions, legal actions, reason, confidence, and versions"
      click_on "Check answer"
    end

    within "#decision-quality-session-summary" do
      assert_text "3 / 3"
      assert_text "Freeze the information, assumptions, action, and confidence before the result."
      assert_text "retrieval practice and confidence calibration"
      assert_link "Open your Review Queue"
    end
  end
end
