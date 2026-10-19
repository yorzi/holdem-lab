require "json"

class ContentAsset < ApplicationRecord
  LOCALES = %w[en zh].freeze
  CONTENT_MODES = %w[original_authored_synthesis independent_authored_sibling].freeze
  PUBLICATION_STATUSES = %w[draft review_preview published retired].freeze
  RIGHTS_STATUSES = %w[original_authored rights_review_required unknown restricted].freeze
  REVIEW_STATUSES = %w[pending approved rejected].freeze
  TECHNICAL_REVIEW_STATUSES = %w[pending passed rejected].freeze

  validates :asset_id, :manifest_id, :kind, :slug, :locale, :content_version, :route_path,
    :view_path, :content_mode, :publication_status, :rights_status, :asset_digest,
    :source_packet_ids, :technical_review_status, :technical_review_evidence,
    :domain_review_status, :rights_notes, presence: true
  validates :asset_id, uniqueness: true
  validates :locale, inclusion: { in: LOCALES }
  validates :content_mode, inclusion: { in: CONTENT_MODES }
  validates :publication_status, inclusion: { in: PUBLICATION_STATUSES }
  validates :rights_status, inclusion: { in: RIGHTS_STATUSES }
  validates :technical_review_status, inclusion: { in: TECHNICAL_REVIEW_STATUSES }
  validates :domain_review_status, inclusion: { in: REVIEW_STATUSES }
  validates :asset_id, format: { with: /\A[a-z0-9-]+\z/ }
  validates :asset_digest, format: { with: /\A[a-f0-9]{64}\z/ }

  validate :serialized_fields_are_arrays
  validate :published_scope_requires_review

  def source_packet_id_list
    parse_array(source_packet_ids)
  end

  def technical_review_evidence_list
    parse_array(technical_review_evidence)
  end

  def stable_id
    asset_id
  end

  def publication_gate_passed?
    publication_status == "published" &&
      rights_status == "original_authored" &&
      technical_review_status == "passed" &&
      domain_review_status == "approved" &&
      domain_review_reviewer.present? &&
      domain_reviewed_at.present?
  end

  private

  def parse_array(value)
    parsed = JSON.parse(value)
    parsed.is_a?(Array) ? parsed : []
  rescue JSON::ParserError, TypeError
    []
  end

  def serialized_fields_are_arrays
    { source_packet_ids: source_packet_ids, technical_review_evidence: technical_review_evidence }.each do |name, value|
      parsed = JSON.parse(value)
      errors.add(name, "must encode an array") unless parsed.is_a?(Array)
    rescue JSON::ParserError, TypeError
      errors.add(name, "must contain valid JSON")
    end
  end

  def published_scope_requires_review
    return unless publication_status == "published"

    errors.add(:publication_status, "requires original_authored rights") unless rights_status == "original_authored"
    errors.add(:publication_status, "requires passed technical review") unless technical_review_status == "passed"
    errors.add(:publication_status, "requires approved domain review") unless domain_review_status == "approved"
    errors.add(:publication_status, "requires domain review reviewer") if domain_review_reviewer.blank?
    errors.add(:publication_status, "requires domain review timestamp") if domain_reviewed_at.blank?
  end
end
