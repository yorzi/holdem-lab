require "test_helper"

class UserTest < ActiveSupport::TestCase
  PASSWORD = "correct horse battery staple"

  test "normalizes email addresses and authenticates with the password" do
    user = User.create!(email_address: "  PLAYER@EXAMPLE.COM ", password: PASSWORD, password_confirmation: PASSWORD)

    assert_equal "player@example.com", user.email_address
    assert_equal user, User.authenticate_by(email_address: "PLAYER@example.com", password: PASSWORD)
  end

  test "requires a strong enough password" do
    user = User.new(email_address: "player@example.com", password: "too-short", password_confirmation: "too-short")

    assert_not user.valid?
    assert_includes user.errors[:password], "is too short (minimum is 12 characters)"
  end

  test "rejects malformed and duplicate email addresses" do
    User.create!(email_address: "player@example.com", password: PASSWORD, password_confirmation: PASSWORD)

    duplicate = User.new(email_address: "PLAYER@example.com", password: PASSWORD, password_confirmation: PASSWORD)
    malformed = User.new(email_address: "not-an-email", password: PASSWORD, password_confirmation: PASSWORD)

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:email_address], "has already been taken"
    assert_not malformed.valid?
    assert_includes malformed.errors[:email_address], "is invalid"
  end
end
