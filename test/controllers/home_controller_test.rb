require "test_helper"

class HomeControllerTest < ActionDispatch::IntegrationTest
  test "home explains the learning loop and mounts the React smoke island" do
    get root_url

    assert_response :success
    assert_select "h1", /Practice decisions/
    assert_select "[data-hm-react-mount]"
    assert_select "a[href='#{practice_path}']", minimum: 1
    assert_select "header a[href='#{new_session_path}']", text: "Sign In", count: 1
    assert_select "header a[href='#{new_registration_path}']", count: 0
    assert_select "meta[name='theme-color'][content='#1c2b27']"
    assert_select "link[rel='icon'][href='/icon.png'][type='image/png']"
    assert_select "link[rel='icon'][href='/icon.svg'][type='image/svg+xml']"
    assert_select "img[src='/icon.png'][alt=''][aria-hidden='true']"
    assert_select "meta[name='description'][content*='Texas Hold']", count: 1
    assert_select "meta[name='robots'][content='index, follow']", count: 1
    assert_select "meta[property='og:title'][content*='Free Texas Hold']", count: 1
    assert_select "meta[property='og:image'][content$='/og-image.png']", count: 1
    assert_select "meta[name='twitter:card'][content='summary_large_image']", count: 1
    assert_select "script[type='application/ld+json']", count: 2
    scripts = css_select("script[type='application/ld+json']").map { |node| JSON.parse(node.text) }
    assert_equal [ "Organization", "WebSite" ], scripts.first.fetch("@graph").pluck("@type")
    assert_select "section#learning-path"
    assert_select "section#common-questions details", count: 4

    faq = scripts.find { |data| data["@type"] == "FAQPage" }
    assert faq, "home should publish FAQ structured data"
    assert_equal 4, faq.fetch("mainEntity").size
    # Google requires the markup to match what a visitor can actually read on the page.
    faq.fetch("mainEntity").each do |question|
      assert_select "section#common-questions summary", text: question.fetch("name"), count: 1
      assert_select "section#common-questions p", text: question.dig("acceptedAnswer", "text"), count: 1
    end
  end

  test "methodology exposes evidence boundaries" do
    get methodology_url

    assert_response :success
    assert_select "h1", /Trust is a boundary/
    assert_select "body", /Estimated analysis/
    assert_select "meta[name='description'][content*='separates the rules']", count: 1
  end

  test "authenticated navigation keeps account actions in a dropdown" do
    password = "correct horse battery staple"
    user = User.create!(email_address: "nav-learner@example.com", password: password, password_confirmation: password)

    post session_path, params: { email_address: user.email_address, password: password }
    get root_url

    assert_response :success
    assert_select "header details summary[aria-haspopup='menu']", text: "Account", count: 1
    assert_select "header details form[action='#{session_path}'] button", text: /Sign out/, count: 1
    assert_select "header select", count: 0
    assert_select "footer details[data-testid='footer-language-menu']", count: 1
    assert_select "footer details a[href='/'][aria-current='true']", text: "English", count: 1
    assert_select "footer details a[href='/zh']", text: "简体中文", count: 1
    assert_select "footer select", count: 0
  end
end
