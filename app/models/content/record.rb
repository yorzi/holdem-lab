require "json"

module Content
  class Record < ApplicationRecord
    self.abstract_class = true

    PUBLICATION_STATUSES = %w[draft review_preview published retired].freeze
    REVIEW_STATUSES = %w[pending approved rejected].freeze

    class_attribute :stable_id_attribute, instance_writer: false
    class_attribute :json_array_fields, default: [].freeze, instance_writer: false
    class_attribute :json_object_fields, default: [].freeze, instance_writer: false
    class_attribute :published_rights_statuses, default: %w[original_authored].freeze, instance_writer: false
    class_attribute :technical_review_attribute, default: nil, instance_writer: false

    validates :catalog_id, :catalog_schema_version, :publication_status, :rights_status, :domain_review_status,
      presence: true
    validates :publication_status, inclusion: { in: PUBLICATION_STATUSES }
    validates :domain_review_status, inclusion: { in: REVIEW_STATUSES }

    validate :stable_id_is_valid
    validate :serialized_fields_are_valid
    validate :published_scope_requires_review

    def json_array(name)
      parse_json_field(name, Array)
    end

    def json_object(name)
      parse_json_field(name, Hash)
    end

    def stable_id
      public_send(self.class.stable_id_attribute)
    end

    def publication_gate_passed?
      return false unless publication_status == "published"
      return false unless self.class.published_rights_statuses.include?(rights_status)
      return false unless domain_review_status == "approved"
      return false if domain_review_reviewer.blank? || domain_reviewed_at.blank?

      technical_attribute = self.class.technical_review_attribute
      technical_attribute.nil? || public_send(technical_attribute) == "passed"
    end

    private

    def parse_json_field(name, expected_type)
      parsed = JSON.parse(public_send(name).to_s)
      return parsed if parsed.is_a?(expected_type)

      expected_type == Array ? [] : {}
    rescue JSON::ParserError, TypeError
      expected_type == Array ? [] : {}
    end

    def stable_id_is_valid
      attribute = self.class.stable_id_attribute
      value = attribute && public_send(attribute)
      return if value.present? && value.match?(/\A[a-z0-9-]+\z/)

      errors.add(attribute || :base, "must use a stable lowercase id")
    end

    def serialized_fields_are_valid
      self.class.json_array_fields.each { |name| validate_json_field(name, Array) }
      self.class.json_object_fields.each { |name| validate_json_field(name, Hash) }
    end

    def validate_json_field(name, expected_type)
      parsed = JSON.parse(public_send(name).to_s)
      errors.add(name, "must encode a #{expected_type.name.downcase}") unless parsed.is_a?(expected_type)
    rescue JSON::ParserError, TypeError
      errors.add(name, "must contain valid JSON")
    end

    def published_scope_requires_review
      return unless publication_status == "published"

      unless self.class.published_rights_statuses.include?(rights_status)
        errors.add(:publication_status, "requires an approved rights status")
      end

      errors.add(:publication_status, "requires approved domain review") unless domain_review_status == "approved"
      errors.add(:publication_status, "requires domain review reviewer") if domain_review_reviewer.blank?
      errors.add(:publication_status, "requires domain review timestamp") if domain_reviewed_at.blank?

      technical_attribute = self.class.technical_review_attribute
      return unless technical_attribute

      errors.add(:publication_status, "requires passed technical review") unless public_send(technical_attribute) == "passed"
    end
  end
end
