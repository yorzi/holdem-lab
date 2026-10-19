require "test_helper"

class SessionsControllerTest < ActionDispatch::IntegrationTest
  PASSWORD = "correct horse battery staple"

  setup do
    Session.delete_all
    User.delete_all
    @user = User.create!(email_address: "learner@example.com", password: PASSWORD, password_confirmation: PASSWORD)
  end

  test "renders the sign-in form without authentication" do
    get new_session_path

    assert_response :success
    assert_select "[data-auth-page='sign-in']"
    assert_select "form[action='#{session_path}']"
    assert_equal [ "Sign In", "Sign Up" ], css_select("[data-auth-page='sign-in'] nav[aria-label='Account'] > *").map { |node| node.text.strip }
    assert_select "[data-auth-page='sign-in'] nav[aria-label='Account'] a[href='#{new_registration_path}']", text: "Sign Up", count: 1
    assert_select "[data-auth-page='sign-in'] nav[aria-label='Account'] [aria-current='page']", text: "Sign In", count: 1
    assert_select "header a[href='#{new_registration_path}']", count: 0
    assert_select "meta[name='robots'][content='noindex, nofollow']", count: 1
  end

  test "preserves the zh locale through the sign-in flow" do
    get new_session_path(locale: :zh)

    assert_response :success
    assert_select "html[lang='zh-Hans']"
    assert_select "form[action='#{session_path(locale: :zh)}']"
    assert_select "a[href='#{new_registration_path(locale: :zh)}']", text: /创建账户/

    post session_path(locale: :zh), params: { email_address: @user.email_address, password: PASSWORD }

    assert_redirected_to root_path(locale: :zh)
  end

  test "starts a session with valid credentials" do
    post session_path, params: { email_address: @user.email_address, password: PASSWORD }

    assert_redirected_to root_path
    assert cookies[:session_id].present?
    assert_equal 1, Session.where(user: @user).count

    get root_path

    assert_select "form[action='#{session_path}'] button", /Sign out/
  end

  test "does not start a session with invalid credentials" do
    post session_path, params: { email_address: @user.email_address, password: "wrong password" }

    assert_redirected_to new_session_path
    assert_nil cookies[:session_id]
    assert_empty Session.where(user: @user)
  end

  test "destroys the current session on sign out" do
    post session_path, params: { email_address: @user.email_address, password: PASSWORD }
    assert_equal 1, Session.where(user: @user).count

    delete session_path

    assert_redirected_to new_session_path
    assert_empty cookies[:session_id]
    assert_empty Session.where(user: @user)
  end
end
