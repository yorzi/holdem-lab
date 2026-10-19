class ImportedDecisionRecord < ApplicationRecord
  belongs_to :user, optional: true

  validates :installation_id, :client_id, :progress_version, :record_version, :payload, :payload_digest, presence: true
  validates :client_id, uniqueness: { scope: :installation_id }
end
