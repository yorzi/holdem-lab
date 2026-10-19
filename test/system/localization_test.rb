require "application_system_test_case"

class LocalizationTest < ApplicationSystemTestCase
  test "zh practice mounts a fully localized trainer" do
    visit "/zh/practice"

    assert_selector "html[lang='zh-Hans']"
    assert_text "练习这个决定"
    assert_text "一次只做一个决定"
    assert_text "实战练习"
    assert_text "练习牌桌"

    click_on "识牌练习"

    assert_text "把牌读准，不用犹豫。"
    assert_text "识牌练习"
    assert_selector "[role='tablist'][aria-label='识牌练习']"
  end
end
