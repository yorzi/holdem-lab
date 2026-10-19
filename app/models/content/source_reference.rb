module Content
  class SourceReference < Record
    self.table_name = "content_source_references"
    self.stable_id_attribute = :source_reference_id
    self.json_array_fields = %i[source_ids technical_review_evidence].freeze
    self.technical_review_attribute = :technical_review_status
    self.published_rights_statuses = %w[original_authored reference_only].freeze

    INTEGRITY_STATUSES = %w[verified not_captured failed].freeze
    TECHNICAL_REVIEW_STATUSES = %w[pending passed rejected].freeze
    RIGHTS_STATUSES = %w[original_authored reference_only rights_review_required unknown restricted].freeze

    validates :source_reference_id, uniqueness: true
    validates :kind, :source_packet_id, :claim_id, :source_ids, :integrity_status, :technical_review_status,
      :technical_review_evidence, :canonical_registry_id, :canonical_registry_digest, presence: true
    validates :integrity_status, inclusion: { in: INTEGRITY_STATUSES }
    validates :technical_review_status, inclusion: { in: TECHNICAL_REVIEW_STATUSES }
    validates :rights_status, inclusion: { in: RIGHTS_STATUSES }

    validate :published_scope_requires_verified_integrity

    def publication_gate_passed?
      super && integrity_status == "verified"
    end

    private

    def published_scope_requires_verified_integrity
      return unless publication_status == "published"

      errors.add(:publication_status, "requires verified integrity") unless integrity_status == "verified"
    end
  end
end
