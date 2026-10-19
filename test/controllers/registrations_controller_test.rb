require "test_helper"

class RegistrationsControllerTest < ActionDispatch::IntegrationTest
  PASSWORD = "correct horse battery staple"

  setup do
    Session.delete_all
    User.delete_all
  end

  test "renders the sign-up form without authentication" do
    get new_registration_path

    assert_response :success
    assert_select "[data-auth-page='sign-up']"
    assert_select "form[action='#{registration_path}']"
    assert_equal [ "Sign In", "Sign Up" ], css_select("[data-auth-page='sign-up'] nav[aria-label='Account'] > *").map { |node| node.text.strip }
    assert_select "[data-auth-page='sign-up'] nav[aria-label='Account'] a[href='#{new_session_path}']", text: "Sign In", count: 1
    assert_select "[data-auth-page='sign-up'] nav[aria-label='Account'] [aria-current='page']", text: "Sign Up", count: 1
  end

  test "creates an account and starts a session" do
    assert_difference("User.count", 1) do
      post registration_path, params: {
        user: {
          email_address: "  learner@example.com ",
          password: PASSWORD,
          password_confirmation: PASSWORD
        }
      }
    end

    assert_redirected_to root_path
    assert cookies[:session_id].present?
    assert_equal "learner@example.com", User.order(:id).last.email_address
    assert_equal 1, Session.count
  end

  test "keeps the form and does not create a duplicate normalized email" do
    User.create!(email_address: "learner@example.com", password: PASSWORD, password_confirmation: PASSWORD)

    assert_no_difference("User.count") do
      post registration_path, params: {
        user: {
          email_address: " LEARNER@example.com ",
          password: PASSWORD,
          password_confirmation: PASSWORD
        }
      }
    end

    assert_response :unprocessable_entity
    assert_select "[data-auth-page='sign-up']", /already been taken/
    assert_nil cookies[:session_id]
  end
end
