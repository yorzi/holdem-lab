require "test_helper"

class Settings::ProfilesControllerTest < ActionDispatch::IntegrationTest
  PASSWORD = "correct horse battery staple"

  setup do
    ImportedDecisionRecord.delete_all
    Session.delete_all
    User.delete_all
    @user = User.create!(email_address: "learner@example.com", password: PASSWORD, password_confirmation: PASSWORD)
  end

  test "requires authentication to view the profile" do
    get profile_settings_path

    assert_redirected_to new_session_path
  end

  test "renders the profile in English and Chinese" do
    sign_in_as(@user)

    get profile_settings_path
    assert_response :success
    assert_select "[data-account-page='profile']"
    assert_select "input[name='user[display_name]']"
    assert_select "a[href='#{profile_export_path}']", text: /Download JSON export/
    assert_select "input[name='current_password'][type='password']"
    assert_select "input[name='confirmation']"
    assert_select "input[name='_method'][value='delete']"

    get profile_settings_path(locale: :zh)
    assert_response :success
    assert_select "html[lang='zh-Hans']"
    assert_select "[data-account-page='profile']", /账户资料/
    assert_select "a[href='#{profile_export_path(locale: :zh)}']", text: /下载 JSON 导出/
    assert_select "[aria-labelledby='profile-delete-title']", /删除账户/
    assert_select "input[type='submit'][value='永久删除账户']"
    assert_select "form[action='#{profile_settings_path(locale: :zh)}'] input[name='confirmation']"
  end

  test "updates a trimmed display name without accepting an email parameter" do
    sign_in_as(@user)

    patch profile_settings_path, params: {
      user: { display_name: "  Ada Lovelace  ", email_address: "other@example.com" }
    }

    assert_redirected_to profile_settings_path
    @user.reload
    assert_equal "Ada Lovelace", @user.display_name
    assert_equal "learner@example.com", @user.email_address

    get root_path
    assert_select "a[href='#{profile_settings_path}']", text: "Ada Lovelace"
  end

  test "keeps the profile form when the display name is too long" do
    @user.update!(display_name: "Original")
    sign_in_as(@user)

    patch profile_settings_path, params: { user: { display_name: "x" * 121 } }

    assert_response :unprocessable_entity
    assert_select "[data-account-page='profile']"
    assert_select "[role='alert']", /maximum is 120/
    assert_equal "Original", @user.reload.display_name
  end

  test "exports only the signed-in account and its owned imported progress" do
    sign_in_as(@user)
    @user.update!(display_name: "Ada Lovelace")
    ImportedDecisionRecord.create!(
      user: @user,
      installation_id: "install-owned",
      client_id: "decision-owned",
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: '{"id":"decision-owned","userReason":"owned reason"}',
      payload_digest: "owned-digest"
    )
    ImportedDecisionRecord.create!(
      installation_id: "install-anon",
      client_id: "decision-anon",
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: '{"id":"decision-anon"}',
      payload_digest: "anon-digest"
    )

    get profile_export_path

    assert_response :success
    assert_equal "holdem-lab-account-export-v1", response.headers["X-Holdem-Export-Format"]
    assert_match(/attachment/, response.headers["Content-Disposition"])

    export = JSON.parse(response.body)
    assert_equal "holdem-lab-account-export-v1", export["format"]
    assert_equal "learner@example.com", export.dig("account", "email_address")
    assert_equal "Ada Lovelace", export.dig("account", "display_name")
    assert_equal 1, export["sessions"].length
    assert_equal [ "decision-owned" ], export["progress_records"].map { |record| record["id"] }
    assert_equal "owned reason", export.dig("progress_records", 0, "payload", "userReason")
    refute_includes response.body, "password_digest"
    refute_includes response.body, "decision-anon"
  end

  test "does not delete anything when the password or confirmation is invalid" do
    sign_in_as(@user)
    owned = imported_record(user: @user, installation_id: "install-owned", client_id: "decision-owned")
    anonymous = imported_record(installation_id: "install-anon", client_id: "decision-anon")
    other_user = User.create!(email_address: "other@example.com", password: PASSWORD, password_confirmation: PASSWORD)
    other = imported_record(user: other_user, installation_id: "install-other", client_id: "decision-other")

    [
      { current_password: "wrong password", confirmation: "DELETE" },
      { current_password: PASSWORD, confirmation: "delete" }
    ].each do |params|
      delete profile_settings_path, params: params

      assert_response :unprocessable_entity
      assert_select "[data-account-page='profile']"
      assert_select "[role='alert']", /could not verify/i
    end

    assert User.exists?(@user.id)
    assert_equal 1, Session.where(user: @user).count
    assert ImportedDecisionRecord.exists?(owned.id)
    assert ImportedDecisionRecord.exists?(anonymous.id)
    assert ImportedDecisionRecord.exists?(other.id)
  end

  test "deletes only the signed-in account and its server-owned records" do
    sign_in_as(@user)
    account_id = @user.id
    session_id = cookies[:session_id]
    owned = imported_record(user: @user, installation_id: "install-owned", client_id: "decision-owned")
    anonymous = imported_record(installation_id: "install-anon", client_id: "decision-anon")
    other_user = User.create!(email_address: "other@example.com", password: PASSWORD, password_confirmation: PASSWORD)
    other = imported_record(user: other_user, installation_id: "install-other", client_id: "decision-other")

    assert_difference("User.count", -1) do
      delete profile_settings_path, params: { current_password: PASSWORD, confirmation: "DELETE" }
    end

    assert_redirected_to root_path
    assert_empty cookies[:session_id]
    assert_not User.exists?(account_id)
    assert_not Session.exists?(session_id)
    assert_not ImportedDecisionRecord.exists?(owned.id)
    assert ImportedDecisionRecord.exists?(anonymous.id)
    assert ImportedDecisionRecord.exists?(other.id)

    get root_path
    assert_response :success
    assert_select "a[href='#{new_session_path}']", text: /Sign In/
  end

  private

  def sign_in_as(user)
    post session_path, params: { email_address: user.email_address, password: PASSWORD }
    assert_response :redirect
  end

  def imported_record(user: nil, installation_id:, client_id:)
    ImportedDecisionRecord.create!(
      user:,
      installation_id:,
      client_id:,
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: { id: client_id }.to_json,
      payload_digest: "digest-#{client_id}"
    )
  end
end
