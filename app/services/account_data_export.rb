require "json"

class AccountDataExport
  FORMAT_VERSION = "holdem-lab-account-export-v1"

  def initialize(user, exported_at: Time.current)
    @user = user
    @exported_at = exported_at
  end

  def call
    {
      "format" => FORMAT_VERSION,
      "exported_at" => timestamp(@exported_at),
      "account" => {
        "id" => @user.id,
        "email_address" => @user.email_address,
        "display_name" => @user.display_name,
        "created_at" => timestamp(@user.created_at),
        "updated_at" => timestamp(@user.updated_at)
      },
      "sessions" => @user.sessions.order(:created_at, :id).map { |session| session_payload(session) },
      "progress_records" => @user.imported_decision_records.order(:created_at, :id).map { |record| progress_payload(record) }
    }
  end

  private

  def session_payload(session)
    {
      "created_at" => timestamp(session.created_at),
      "updated_at" => timestamp(session.updated_at),
      "ip_address" => session.ip_address,
      "user_agent" => session.user_agent
    }
  end

  def progress_payload(record)
    {
      "id" => record.client_id,
      "installation_id" => record.installation_id,
      "progress_version" => record.progress_version,
      "record_version" => record.record_version,
      "created_at" => timestamp(record.created_at),
      "updated_at" => timestamp(record.updated_at),
      "payload" => JSON.parse(record.payload)
    }
  rescue JSON::ParserError
    {
      "id" => record.client_id,
      "installation_id" => record.installation_id,
      "progress_version" => record.progress_version,
      "record_version" => record.record_version,
      "created_at" => timestamp(record.created_at),
      "updated_at" => timestamp(record.updated_at),
      "payload" => nil,
      "payload_status" => "invalid_stored_json"
    }
  end

  def timestamp(value)
    value&.iso8601(3)
  end
end
