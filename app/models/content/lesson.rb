module Content
  class Lesson < Record
    self.table_name = "content_lessons"
    self.stable_id_attribute = :lesson_id
    self.json_array_fields = %i[
      asset_ids
      source_packet_ids
      concept_ids
      exercise_ids
      source_reference_ids
      technical_review_evidence
    ].freeze
    self.technical_review_attribute = :technical_review_status

    TECHNICAL_REVIEW_STATUSES = %w[pending passed rejected].freeze
    RIGHTS_STATUSES = %w[original_authored rights_review_required unknown restricted].freeze

    validates :lesson_id, uniqueness: true
    validates :slug, :sequence, :content_version, :asset_ids, :source_packet_ids, :concept_ids, :exercise_ids,
      :source_reference_ids, :technical_review_status, :technical_review_evidence, presence: true
    validates :technical_review_status, inclusion: { in: TECHNICAL_REVIEW_STATUSES }
    validates :rights_status, inclusion: { in: RIGHTS_STATUSES }

    def concepts
      Content::Concept.where(lesson_id: lesson_id)
    end

    def exercises
      Content::Exercise.where(lesson_id: lesson_id)
    end
  end
end
