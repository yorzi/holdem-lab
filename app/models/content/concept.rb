module Content
  class Concept < Record
    self.table_name = "content_concepts"
    self.stable_id_attribute = :concept_id
    self.json_array_fields = %i[prerequisite_ids source_reference_ids].freeze
    self.json_object_fields = %i[display].freeze

    RIGHTS_STATUSES = %w[original_authored rights_review_required unknown restricted].freeze

    validates :concept_id, uniqueness: true
    validates :lesson_id, :slug, :difficulty, :prerequisite_ids, :display, :source_reference_ids, presence: true
    validates :rights_status, inclusion: { in: RIGHTS_STATUSES }

    belongs_to :lesson, class_name: "Content::Lesson", foreign_key: :lesson_id, primary_key: :lesson_id, optional: true
    has_many :exercises, class_name: "Content::Exercise", foreign_key: :concept_id, primary_key: :concept_id,
      dependent: :restrict_with_exception
  end
end
