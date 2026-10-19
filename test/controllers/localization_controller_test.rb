require "test_helper"

class LocalizationControllerTest < ActionDispatch::IntegrationTest
  test "english remains the default locale and canonical url" do
    get root_url

    assert_response :success
    assert_select "html[lang='en']", count: 1
    assert_select "meta[name='holdem-locale'][content='en']", count: 1
    assert_select "link[rel='canonical'][href='#{root_url}']", count: 1
    assert_select "link[rel='alternate'][hreflang='zh-Hans'][href='#{root_url(locale: :zh)}']", count: 1
  end

  test "zh renders an authored sibling page and keeps its locale canonical" do
    get "/zh/learn"

    assert_response :success
    assert_select "html[lang='zh-Hans']", count: 1
    assert_select "meta[name='holdem-locale'][content='zh']", count: 1
    assert_select "meta[name='description'][content*='德州扑克']", count: 1
    assert_select "meta[property='og:locale'][content='zh_CN']", count: 1
    assert_select "meta[property='og:image'][content$='/og-image-zh.png']", count: 1
    assert_select "h1", /一次建立一个可靠概念/
    assert_select "link[rel='canonical'][href='#{learn_url(locale: :zh)}']", count: 1
    assert_select "link[rel='alternate'][hreflang='en'][href='#{learn_url(locale: nil)}']", count: 1
    assert_select "footer details[data-testid='footer-language-menu'] a[href='/learn']", text: /English/, minimum: 1
  end

  test "zh position lesson preserves the exercise contract and no-js answers" do
    get position_lesson_url(locale: :zh)

    assert_response :success
    assert_select "article[data-lesson-slug='position']"
    assert_select "article[data-content-curriculum-id='curriculum-lesson-position-v1']"
    assert_select "article[data-content-exercise-ids*='exercise-position-q1-v1']"
    assert_select "fieldset[data-lesson-session-target='question']", count: 3
    assert_select "noscript", minimum: 3
    assert_select "body", /位置首先是行动顺序/
    assert_select "article[data-evidence-coverage*='公开的赛事规则']", count: 1
    assert_select "body", /翻牌前由按钮位／小盲先行动/
  end

  test "locale switch preserves the current public path" do
    get "/zh/learn/decision-quality"

    assert_response :success
    assert_select "footer details[data-testid='footer-language-menu'] a[href='/learn/decision-quality']", text: /English/, minimum: 1
    assert_select "footer details[data-testid='footer-language-menu'] a[href='/zh/learn/decision-quality']", text: /简体中文/, minimum: 1
  end

  test "canonical URLs omit query parameters while locale switches preserve them" do
    get "/zh/learn?source=navigation"

    assert_response :success
    assert_select "link[rel='canonical'][href='#{learn_url(locale: :zh)}']", count: 1
    assert_select "footer details[data-testid='footer-language-menu'] a[href='/learn?source=navigation']", text: /English/, minimum: 1
    assert_select "footer details[data-testid='footer-language-menu'] a[href='/zh/learn?source=navigation']", text: /简体中文/, minimum: 1
  end

  test "configured public base URL owns canonical and share URLs" do
    previous_base_url = Rails.application.config.x.public_base_url
    Rails.application.config.x.public_base_url = "https://holdem-lab.example"

    get "/zh"

    assert_response :success
    assert_select "link[rel='canonical'][href='https://holdem-lab.example/zh']", count: 1
    assert_select "link[rel='alternate'][hreflang='en'][href='https://holdem-lab.example/']", count: 1
    assert_select "meta[property='og:image'][content='https://holdem-lab.example/og-image-zh.png']", count: 1
  ensure
    Rails.application.config.x.public_base_url = previous_base_url
  end

  test "zh lessons are written in Chinese rather than mixed with English jargon" do
    jargon = %w[
      Position Postflop Preflop button
      equity range threshold action
      confidence calibration outcome decision
    ]

    [ position_lesson_url(locale: :zh), pot_odds_lesson_url(locale: :zh), decision_quality_lesson_url(locale: :zh) ].each do |url|
      get url

      assert_response :success
      # Strip markup, then the two places English is legitimately expected:
      # cited paper titles and the tool name "solver".
      text = css_select("article").text
      text = text.gsub(/Retrieval-practice systematic review|Confidence-calibration study|Poker TDA[^<]*|solver/, " ")

      jargon.each do |term|
        assert_no_match(/\b#{Regexp.escape(term)}\b/i, text,
          "#{url} still shows untranslated \"#{term}\" to Chinese readers")
      end
    end
  end
end
