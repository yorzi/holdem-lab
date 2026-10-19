require "json"

module Content
  class RegistrySnapshot < ApplicationRecord
    self.table_name = "content_registry_snapshots"

    LAYERS = %w[exercises sources source_references strategy].freeze
    RUNTIME_STATUSES = %w[validation_only provenance_only local_practice_only internal_review published].freeze
    STATUSES = %w[active retired].freeze

    validates :contract_id, :contract_schema_version, :layer, :path, :registry_id,
      :registry_schema_version, :registry_digest, :runtime_status, :record_count,
      :status_summary, :status, presence: true
    validates :layer, inclusion: { in: LAYERS }
    validates :runtime_status, inclusion: { in: RUNTIME_STATUSES }
    validates :status, inclusion: { in: STATUSES }
    validates :contract_schema_version, :registry_schema_version,
      numericality: { only_integer: true, greater_than: 0 }
    validates :registry_digest, format: { with: /\A[a-f0-9]{64}\z/ }
    validates :record_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
    validates :contract_id, :registry_id, format: { with: /\A[a-z0-9]+(?:[-_][a-z0-9]+)*\z/ }

    validate :status_summary_is_object
    validate :retirement_fields_are_consistent

    def stable_id
      "#{contract_id}:#{layer}"
    end

    def active?
      status == "active"
    end

    def status_summary_hash
      parsed = JSON.parse(status_summary.to_s)
      parsed.is_a?(Hash) ? parsed : {}
    rescue JSON::ParserError, TypeError
      {}
    end

    private

    def status_summary_is_object
      parsed = JSON.parse(status_summary.to_s)
      errors.add(:status_summary, "must encode an object") unless parsed.is_a?(Hash)
    rescue JSON::ParserError, TypeError
      errors.add(:status_summary, "must contain valid JSON")
    end

    def retirement_fields_are_consistent
      if status == "retired" && retired_at.blank?
        errors.add(:retired_at, "is required for retired snapshots")
      elsif status == "active" && retired_at.present?
        errors.add(:retired_at, "must be blank for active snapshots")
      end
    end
  end
end
