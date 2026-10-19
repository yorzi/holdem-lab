require "test_helper"

class Api::V1::ImportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    ImportedDecisionRecord.delete_all
    Session.delete_all
    User.delete_all
    @payload = {
      "version" => "holdem-progress-v2",
      "installation_id" => "install-test-001",
      "records" => [ decision_payload ]
    }
  end

  test "associates a new import with the signed-in account" do
    user = User.create!(email_address: "learner@example.com", password: "correct horse battery staple", password_confirmation: "correct horse battery staple")
    sign_in_as(user)

    post api_v1_local_progress_import_url, params: @payload, as: :json

    assert_response :success
    assert_equal user, ImportedDecisionRecord.find_by!(client_id: "decision-001").user
    assert_equal [ "decision-001" ], response.parsed_body["accepted"]
    assert_equal [], response.parsed_body["claimed"]
  end

  test "claims an existing anonymous import only after an explicit signed-in import" do
    post api_v1_local_progress_import_url, params: @payload, as: :json
    assert_response :success

    user = User.create!(email_address: "learner@example.com", password: "correct horse battery staple", password_confirmation: "correct horse battery staple")
    sign_in_as(user)
    post api_v1_local_progress_import_url, params: @payload, as: :json

    assert_response :success
    assert_equal [], response.parsed_body["accepted"]
    assert_equal [], response.parsed_body["duplicates"]
    assert_equal [ "decision-001" ], response.parsed_body["claimed"]
    assert_equal user, ImportedDecisionRecord.find_by!(client_id: "decision-001").user
  end

  test "does not expose or reassign a record owned by another account" do
    owner = User.create!(email_address: "owner@example.com", password: "correct horse battery staple", password_confirmation: "correct horse battery staple")
    sign_in_as(owner)
    post api_v1_local_progress_import_url, params: @payload, as: :json
    assert_response :success
    delete session_path

    other_user = User.create!(email_address: "other@example.com", password: "correct horse battery staple", password_confirmation: "correct horse battery staple")
    sign_in_as(other_user)
    post api_v1_local_progress_import_url, params: @payload, as: :json

    assert_response :conflict
    assert_equal "record_owner_conflict", response.parsed_body.dig("error", "code")
    assert_equal [ "decision-001" ], response.parsed_body["conflicts"]
    assert_equal owner, ImportedDecisionRecord.find_by!(client_id: "decision-001").user
  end

  test "imports a current local record and treats the same client id as a duplicate" do
    assert_difference("ImportedDecisionRecord.count", 1) do
      post api_v1_local_progress_import_url, params: @payload, as: :json
    end

    assert_response :success
    assert_equal "holdem-import-v2", response.parsed_body["version"]
    assert_equal [ "decision-001" ], response.parsed_body["accepted"]
    assert_equal [], response.parsed_body["duplicates"]

    assert_no_difference("ImportedDecisionRecord.count") do
      post api_v1_local_progress_import_url, params: @payload, as: :json
    end

    assert_response :success
    assert_equal [], response.parsed_body["accepted"]
    assert_equal [ "decision-001" ], response.parsed_body["duplicates"]
  end

  test "rejects a changed payload for an existing client id without overwriting it" do
    post api_v1_local_progress_import_url, params: @payload, as: :json
    assert_response :success

    changed = @payload.deep_dup
    changed["records"][0]["userReason"] = "changed after the first import"

    assert_no_difference("ImportedDecisionRecord.count") do
      post api_v1_local_progress_import_url, params: changed, as: :json
    end

    assert_response :conflict
    assert_equal "client_id_conflict", response.parsed_body.dig("error", "code")
    assert_equal [ "decision-001" ], response.parsed_body["conflicts"]
    assert_equal "test reason", JSON.parse(ImportedDecisionRecord.first.payload)["userReason"]
  end

  test "rejects legacy progress and malformed or mismatched record versions" do
    unsupported = @payload.merge("version" => "holdem-progress-v1")

    assert_no_difference("ImportedDecisionRecord.count") do
      post api_v1_local_progress_import_url, params: unsupported, as: :json
    end

    assert_response :unprocessable_entity
    assert_equal "unsupported_progress_version", response.parsed_body.dig("error", "code")

    malformed = @payload.merge("records" => [ { "id" => "missing-fields" } ])
    post api_v1_local_progress_import_url, params: malformed, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_record", response.parsed_body.dig("error", "code")

    mismatched = @payload.deep_dup
    mismatched["records"][0]["evaluatorVersion"] = "holdem-evaluator-v0"
    post api_v1_local_progress_import_url, params: mismatched, as: :json
    assert_response :unprocessable_entity
    assert_equal "unsupported_record_version", response.parsed_body.dig("error", "code")
  end

  test "preserves false and zero values in the canonical payload" do
    payload = @payload.deep_dup
    payload["records"][0]["snapshot"].merge!("zero" => 0, "flag" => false)

    post api_v1_local_progress_import_url, params: payload, as: :json

    assert_response :success
    stored = JSON.parse(ImportedDecisionRecord.first.payload)
    assert_equal 0, stored.dig("snapshot", "zero")
    assert_equal false, stored.dig("snapshot", "flag")
  end

  test "rejects conflicting duplicate ids within one request" do
    conflicting = @payload.deep_dup
    conflicting["records"] << conflicting["records"].first.merge("userReason" => "different content")

    assert_no_difference("ImportedDecisionRecord.count") do
      post api_v1_local_progress_import_url, params: conflicting, as: :json
    end

    assert_response :conflict
    assert_equal "client_id_conflict", response.parsed_body.dig("error", "code")
    assert_equal [ "decision-001" ], response.parsed_body["conflicts"]
  end

  test "rejects oversized reasons and invalid persisted labels" do
    oversized = @payload.deep_dup
    oversized["records"][0]["userReason"] = "x" * 2_001
    post api_v1_local_progress_import_url, params: oversized, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_record", response.parsed_body.dig("error", "code")

    localized = @payload.deep_dup
    localized["records"][0]["feedback"]["label"] = "近似分析"
    post api_v1_local_progress_import_url, params: localized, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_record", response.parsed_body.dig("error", "code")
  end

  test "returns not found without writing when the environment disables import" do
    previous = Rails.application.config.x.local_progress_import_enabled
    Rails.application.config.x.local_progress_import_enabled = false

    assert_no_difference("ImportedDecisionRecord.count") do
      post api_v1_local_progress_import_url, params: @payload, as: :json
    end

    assert_response :not_found
    assert_equal "import_disabled", response.parsed_body.dig("error", "code")
  ensure
    Rails.application.config.x.local_progress_import_enabled = previous
  end

  test "filters progress payload fields from logs" do
    filtered = ActiveSupport::ParameterFilter
      .new(Rails.application.config.filter_parameters)
      .filter(
        "installation_id" => "install-private",
        "client_id" => "decision-private",
        "payload" => "private-json",
        "payload_digest" => "private-digest",
        "seed" => "private-seed",
        "records" => [ { "userReason" => "private", "snapshot" => { "seed" => "private" }, "resultState" => { "seed" => "private" } } ]
      )

    assert_equal "[FILTERED]", filtered["installation_id"]
    assert_equal "[FILTERED]", filtered["client_id"]
    assert_equal "[FILTERED]", filtered["payload"]
    assert_equal "[FILTERED]", filtered["payload_digest"]
    assert_equal "[FILTERED]", filtered["seed"]
    assert_equal "[FILTERED]", filtered["records"]
  end

  private

  def engine_versions
    {
      "ruleVersion" => "holdem-rules-v2",
      "evaluatorVersion" => "holdem-evaluator-v1",
      "rngAlgorithmVersion" => "mulberry32-fisher-yates-v1"
    }
  end

  def decision_payload
    {
      "version" => 2,
      "id" => "decision-001",
      "mode" => "quiz",
      "street" => "preflop",
      "heroPosition" => "button",
      "createdAt" => "2026-08-19T00:00:00.000Z",
      "userReason" => "test reason",
      "errorTags" => [],
      "snapshot" => engine_versions.merge("seed" => "quiz-001"),
      "resultState" => engine_versions.merge("seed" => "quiz-001-result"),
      "feedback" => { "label" => "approximate_analysis", "evLoss" => nil }
    }.merge(engine_versions)
  end

  def sign_in_as(user)
    post session_path, params: { email_address: user.email_address, password: "correct horse battery staple" }
    assert_response :redirect
  end
end
