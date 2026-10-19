require "test_helper"

class PasswordsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  PASSWORD = "correct horse battery staple"

  setup do
    clear_enqueued_jobs
    Session.delete_all
    User.delete_all
    @user = User.create!(email_address: "learner@example.com", password: PASSWORD, password_confirmation: PASSWORD)
  end

  test "renders the password reset form without authentication" do
    get new_password_path

    assert_response :success
    assert_select "[data-auth-page='password-reset']"
  end

  test "queues reset instructions for a known email" do
    assert_enqueued_emails 1 do
      post passwords_path, params: { email_address: "LEARNER@example.com" }
    end

    assert_redirected_to new_session_path
    follow_redirect!
    assert_select "[role='status']", /reset instructions/i
  end

  test "does not reveal whether an unknown email exists" do
    assert_no_enqueued_emails do
      post passwords_path, params: { email_address: "missing@example.com" }
    end

    assert_redirected_to new_session_path
    follow_redirect!
    assert_select "[role='status']", /reset instructions/i
  end

  test "rejects an invalid reset token" do
    get edit_password_path(token: "invalid-token")

    assert_redirected_to new_password_path
    follow_redirect!
    assert_select "[role='alert']", /invalid or has expired/i
  end

  test "resets the password and destroys existing sessions" do
    post session_path, params: { email_address: @user.email_address, password: PASSWORD }
    assert_equal 1, Session.where(user: @user).count
    token = @user.password_reset_token

    put password_path(token: token), params: {
      password: "new correct horse battery",
      password_confirmation: "new correct horse battery"
    }

    assert_redirected_to new_session_path
    assert_empty Session.where(user: @user)
    assert_equal @user, User.authenticate_by(email_address: @user.email_address, password: "new correct horse battery")
    assert_nil User.authenticate_by(email_address: @user.email_address, password: PASSWORD)
  end

  test "keeps the reset form when passwords do not match" do
    token = @user.password_reset_token

    put password_path(token: token), params: {
      password: "new correct horse battery",
      password_confirmation: "different password"
    }

    assert_response :unprocessable_entity
    assert_select "[data-auth-page='password-update']"
    assert_select "[role='alert']", /did not match/i
    assert_equal @user, User.authenticate_by(email_address: @user.email_address, password: PASSWORD)
  end
end
