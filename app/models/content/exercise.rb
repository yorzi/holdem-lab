module Content
  class Exercise < Record
    self.table_name = "content_exercises"
    self.stable_id_attribute = :exercise_id
    self.json_array_fields = %i[source_reference_ids technical_review_evidence].freeze
    self.technical_review_attribute = :technical_review_status

    TECHNICAL_REVIEW_STATUSES = %w[pending passed rejected].freeze
    RIGHTS_STATUSES = %w[original_authored rights_review_required unknown restricted].freeze

    validates :exercise_id, uniqueness: true
    validates :lesson_id, :concept_id, :dom_id, :exercise_type, :answer_contract, :answer_code,
      :view_answer_value, :source_reference_ids, :technical_review_status, :technical_review_evidence,
      :canonical_template_id, :canonical_registry_id, :canonical_registry_digest, presence: true
    validates :technical_review_status, inclusion: { in: TECHNICAL_REVIEW_STATUSES }
    validates :rights_status, inclusion: { in: RIGHTS_STATUSES }

    belongs_to :lesson, class_name: "Content::Lesson", foreign_key: :lesson_id, primary_key: :lesson_id, optional: true
    belongs_to :concept, class_name: "Content::Concept", foreign_key: :concept_id, primary_key: :concept_id, optional: true
  end
end
