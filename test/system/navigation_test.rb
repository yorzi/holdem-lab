require "application_system_test_case"

class NavigationTest < ApplicationSystemTestCase
  PASSWORD = "correct horse battery staple"

  test "mobile navigation opens and closes with a truthful accessible state" do
    page.driver.browser.manage.window.resize_to(390, 900)
    visit root_path

    trigger = find("button[aria-controls='main-navigation']")
    assert_equal "false", trigger["aria-expanded"]
    assert_equal "none", navigation_display

    trigger.click

    assert_equal "true", trigger["aria-expanded"]
    assert_equal "block", navigation_display
    assert_link "Learn", href: learn_path
    assert_link "Methodology", href: methodology_path

    trigger.click

    assert_equal "false", trigger["aria-expanded"]
    assert_equal "none", navigation_display
  end

  test "desktop navigation stays visible without the mobile trigger" do
    page.driver.browser.manage.window.resize_to(1280, 900)
    visit root_path

    assert_equal "block", navigation_display
    assert_equal "none", page.evaluate_script("getComputedStyle(document.querySelector(\"button[aria-controls='main-navigation']\")).display")
    assert_link "Sign In", href: new_session_path
    assert_no_link "Sign Up", href: new_registration_path
  end

  test "authenticated account actions open in a dropdown" do
    page.driver.browser.manage.window.resize_to(1280, 900)
    email = "dropdown-#{SecureRandom.hex(4)}@example.com"

    visit new_registration_path
    fill_in "Email address", with: email
    fill_in "Password", with: PASSWORD
    fill_in "Confirm password", with: PASSWORD
    click_button "Create account"

    assert_selector "header details summary", text: "Account"
    find("header details summary").click
    assert_selector "header details[open]"
    assert_link "Account", href: profile_settings_path
    assert_button "Sign out"
  end

  private

  def navigation_display
    page.evaluate_script("getComputedStyle(document.querySelector('#main-navigation')).display")
  end
end
