require "test_helper"

class LearnControllerTest < ActionDispatch::IntegrationTest
  test "learn index exposes all three lesson slices" do
    get learn_url

    assert_response :success
    assert_select "meta[name='holdem-telemetry'][content='true']", count: 1
    assert_select "h1", /Build one reliable concept/
    assert_select "a[href='#{position_lesson_path}']", text: /Open the Position lesson/
    assert_select "a[href='#{pot_odds_lesson_path}']", text: /Open the Pot Odds lesson/
    assert_select "a[href='#{decision_quality_lesson_path}']", text: /Open the Decision Quality lesson/
    assert_select "span", text: "10 min", count: 3
    assert_select "article[data-content-curriculum-id='curriculum-lesson-position-v1']", count: 1
    assert_select "article[data-content-curriculum-id='curriculum-lesson-pot-odds-v1']", count: 1
    assert_select "article[data-content-curriculum-id='curriculum-lesson-decision-quality-v1']", count: 1
  end

  test "position lesson renders source-backed content and all exercises without JavaScript" do
    get position_lesson_url

    assert_response :success
    assert_select "h1", /Position is action order/
    assert_select "article[data-controller='lesson-session']"
    assert_select "article[data-lesson-slug='position']"
    assert_select "article[data-content-curriculum-id='curriculum-lesson-position-v1']"
    assert_select "article[data-content-exercise-ids*='exercise-position-q1-v1']"
    assert_select "fieldset[data-lesson-session-target='question']", count: 3
    assert_select "noscript", minimum: 3
    assert_select "#position-session-summary[hidden]"
    assert_select "a[href='https://www.pokertda.com/view-poker-tda-rules/']", text: /Poker TDA 2024 Rules/
    assert_select "body", /follow published tournament procedure/
    assert_select "body", /does not give you an opening range/
  end

  test "pot odds lesson keeps arithmetic and strategy claims separate" do
    get pot_odds_lesson_url

    assert_response :success
    assert_select "link[rel='canonical'][href='#{pot_odds_lesson_url}']"
    assert_select "article[data-lesson-slug='pot-odds']"
    assert_select "article[data-content-curriculum-id='curriculum-lesson-pot-odds-v1']"
    assert_select "fieldset[data-lesson-session-target='question']", count: 3
    assert_select "body", /required equity = C ÷ \(P \+ C\)/
    assert_select "body", /A threshold is not a call recommendation/
    assert_select "body", /derived from first principles/
  end

  test "decision quality lesson renders the hindsight-resistant review loop" do
    get decision_quality_lesson_url

    assert_response :success
    assert_select "link[rel='canonical'][href='#{decision_quality_lesson_url}']"
    assert_select "article[data-lesson-slug='decision-quality']"
    assert_select "article[data-content-curriculum-id='curriculum-lesson-decision-quality-v1']"
    assert_select "fieldset[data-lesson-session-target='question']", count: 3
    assert_select "body", /How do you review a hand without hindsight\?/
    assert_select "body", /Confidence is a calibration signal, not a score/
    assert_select "a[href='https://eric.ed.gov/?id=EJ1319572']"
  end

  test "lessons publish an answer-first block and FAQ markup that matches the visible copy" do
    [ position_lesson_url, pot_odds_lesson_url, decision_quality_lesson_url ].each do |url|
      get url

      assert_response :success
      scripts = css_select("script[type='application/ld+json']").map { |node| JSON.parse(node.text) }

      lesson = scripts.find { |data| data["@type"] == "LearningResource" }
      assert lesson, "#{url} should publish LearningResource data"
      assert_equal "2026-08-25", lesson["dateModified"]

      faq = scripts.find { |data| data["@type"] == "FAQPage" }
      assert faq, "#{url} should publish FAQ data"
      assert_equal 3, faq.fetch("mainEntity").length

      # Answer engines are told to expect these strings on the page itself.
      faq.fetch("mainEntity").each do |question|
        assert_select "summary", text: question.fetch("name"), count: 1
        assert_select "p", text: question.dig("acceptedAnswer", "text"), count: 1
      end

      # The answer-first block leads with a question and answers it outright.
      assert_select "section[aria-labelledby$='-answer-title'] h2", count: 1 do |heading|
        assert_match(/\?$/, heading.first.text.strip)
      end
    end
  end
end
