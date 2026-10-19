require "test_helper"

class Accounts::DeletionTest < ActiveSupport::TestCase
  PASSWORD = "correct horse battery staple"

  setup do
    ImportedDecisionRecord.delete_all
    Session.delete_all
    User.delete_all
    @user = User.create!(email_address: "learner@example.com", password: PASSWORD, password_confirmation: PASSWORD)
  end

  test "requires both the current password and the exact confirmation token" do
    assert_raises(Accounts::Deletion::ConfirmationError) do
      Accounts::Deletion.call(user: @user, password: "wrong password", confirmation: "DELETE")
    end

    assert_raises(Accounts::Deletion::ConfirmationError) do
      Accounts::Deletion.call(user: @user, password: PASSWORD, confirmation: "delete")
    end

    assert User.exists?(@user.id)
  end

  test "deletes the account and dependent server records in one transaction" do
    session = @user.sessions.create!(user_agent: "test", ip_address: "127.0.0.1")
    owned = ImportedDecisionRecord.create!(
      user: @user,
      installation_id: "install-owned",
      client_id: "decision-owned",
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: '{"id":"decision-owned"}',
      payload_digest: "owned-digest"
    )
    anonymous = ImportedDecisionRecord.create!(
      installation_id: "install-anon",
      client_id: "decision-anon",
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: '{"id":"decision-anon"}',
      payload_digest: "anon-digest"
    )

    Accounts::Deletion.call(user: @user, password: PASSWORD, confirmation: "DELETE")

    assert_not User.exists?(@user.id)
    assert_not Session.exists?(session.id)
    assert_not ImportedDecisionRecord.exists?(owned.id)
    assert ImportedDecisionRecord.exists?(anonymous.id)
  end
end
