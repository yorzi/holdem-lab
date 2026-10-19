require "digest"

module Api
  module V1
    class ImportsController < ApplicationController
      allow_unauthenticated_access
      before_action :require_local_progress_import_enabled!, only: :local_progress

      PROGRESS_VERSION = "holdem-progress-v2"
      IMPORT_VERSION = "holdem-import-v2"
      RULE_VERSION = "holdem-rules-v2"
      EVALUATOR_VERSION = "holdem-evaluator-v1"
      RNG_VERSION = "mulberry32-fisher-yates-v1"
      MAX_RECORDS = 1_000
      MAX_PAYLOAD_BYTES = 2.megabytes
      MAX_REASON_BYTES = 2_000
      VALID_MODES = %w[live quiz street].freeze
      VALID_STREETS = %w[preflop flop turn river].freeze
      VALID_SEATS = %w[button bigBlind].freeze
      VALID_FEEDBACK_LABELS = %w[benchmark_strategy approximate_analysis solver_data].freeze
      VALID_ERROR_TAGS = %w[over_calling over_folding poor_bet_sizing].freeze

      def local_progress
        envelope = request.request_parameters
        validation = validate_envelope(envelope)
        return render_error(validation[:code], validation[:message], :unprocessable_entity) unless validation[:ok]

        records = normalize_records(envelope["records"])
        validation = validate_records(records)
        return render_error(validation[:code], validation[:message], :unprocessable_entity) unless validation[:ok]

        imports = records.map { |record| build_import(envelope["installation_id"], record) }
        conflicts = imports.group_by { |import| import[:client_id] }.filter_map do |client_id, entries|
          existing = ImportedDecisionRecord.find_by(installation_id: envelope["installation_id"], client_id:)
          digests = entries.map { |entry| entry[:payload_digest] }.uniq
          client_id if digests.length > 1 || (existing && entries.any? { |entry| existing.payload_digest != entry[:payload_digest] })
        end
        return render_error("client_id_conflict", "A client record id already exists with different content.", :conflict, conflicts:) if conflicts.any?

        ownership_conflicts = imports.group_by { |import| import[:client_id] }.filter_map do |client_id, _entries|
          existing = ImportedDecisionRecord.find_by(installation_id: envelope["installation_id"], client_id:)
          client_id if existing && record_owned_by_another_user?(existing)
        end
        return render_error("record_owner_conflict", "A client record belongs to another account.", :conflict, conflicts: ownership_conflicts.uniq) if ownership_conflicts.any?

        accepted = []
        duplicates = []
        claimed = []
        race_conflicts = []
        race_ownership_conflicts = []
        ImportedDecisionRecord.transaction do
          imports.each do |attributes|
            existing = ImportedDecisionRecord.find_by(installation_id: attributes[:installation_id], client_id: attributes[:client_id])
            if existing
              if existing.payload_digest == attributes[:payload_digest]
                if record_owned_by_another_user?(existing)
                  race_ownership_conflicts << attributes[:client_id]
                  raise ActiveRecord::Rollback
                elsif existing.user_id.nil? && current_user
                  existing.update!(user: current_user)
                  claimed << attributes[:client_id]
                else
                  duplicates << attributes[:client_id]
                end
              else
                race_conflicts << attributes[:client_id]
                raise ActiveRecord::Rollback
              end
            else
              ImportedDecisionRecord.create!(attributes)
              accepted << attributes[:client_id]
            end
          end
        end

        return render_error("client_id_conflict", "A client record id already exists with different content.", :conflict, conflicts: race_conflicts.uniq) if race_conflicts.any?
        return render_error("record_owner_conflict", "A client record belongs to another account.", :conflict, conflicts: race_ownership_conflicts.uniq) if race_ownership_conflicts.any?

        render json: { version: IMPORT_VERSION, accepted:, duplicates:, claimed:, conflicts: [] }, status: :ok
      rescue ActiveRecord::RecordNotUnique
        render_error("import_race", "The import changed while it was being processed; retry the same payload.", :conflict)
      end

      private

      def require_local_progress_import_enabled!
        return if Rails.application.config.x.local_progress_import_enabled

        render_error("import_disabled", "Local progress import is not available in this environment.", :not_found)
      end

      def validate_envelope(envelope)
        return invalid("invalid_envelope", "The request body must be a JSON object.") unless envelope.is_a?(Hash)
        return invalid("unsupported_progress_version", "This progress version is not supported.") unless envelope["version"] == PROGRESS_VERSION
        return invalid("invalid_installation_id", "installation_id must be 8–128 URL-safe characters.") unless envelope["installation_id"].is_a?(String) && envelope["installation_id"].match?(/\A[a-zA-Z0-9_-]{8,128}\z/)
        return invalid("invalid_records", "records must be an array with at most #{MAX_RECORDS} entries.") unless envelope["records"].is_a?(Array) && envelope["records"].length <= MAX_RECORDS
        return invalid("payload_too_large", "The local progress payload is too large.") if request.raw_post.bytesize > MAX_PAYLOAD_BYTES

        { ok: true }
      end

      def validate_records(records)
        return invalid("invalid_records", "Every record must be an object.") unless records.all? { |record| record.is_a?(Hash) }

        records.each do |record|
          return invalid("invalid_record", "Every record needs a stable id, version, mode, street, seat and createdAt.") unless record["id"].is_a?(String) && record["id"].length.between?(1, 200) && record["version"] == 2 && VALID_MODES.include?(record["mode"]) && VALID_STREETS.include?(record["street"]) && VALID_SEATS.include?(record["heroPosition"]) && valid_iso8601?(record["createdAt"])
          return invalid("invalid_record", "Every record needs snapshot, resultState, feedback and errorTags objects.") unless record["snapshot"].is_a?(Hash) && record["resultState"].is_a?(Hash) && record["feedback"].is_a?(Hash) && record["errorTags"].is_a?(Array)
          return invalid("unsupported_record_version", "The record engine versions are not supported.") unless current_versions?(record) && current_versions?(record["snapshot"]) && current_versions?(record["resultState"])
          return invalid("invalid_record", "The feedback label or error tags are invalid.") unless VALID_FEEDBACK_LABELS.include?(record.dig("feedback", "label")) && record["errorTags"].all? { |tag| VALID_ERROR_TAGS.include?(tag) }
          return invalid("invalid_record", "userReason must be a string no larger than #{MAX_REASON_BYTES} bytes.") unless record["userReason"].is_a?(String) && record["userReason"].bytesize <= MAX_REASON_BYTES
        end

        { ok: true }
      end

      def normalize_records(records)
        records.map { |record| record.respond_to?(:to_unsafe_h) ? record.to_unsafe_h.deep_stringify_keys : record.deep_stringify_keys }
      end

      def current_versions?(record)
        record["ruleVersion"] == RULE_VERSION && record["evaluatorVersion"] == EVALUATOR_VERSION && record["rngAlgorithmVersion"] == RNG_VERSION
      end

      def valid_iso8601?(value)
        value.is_a?(String) && Time.iso8601(value).present?
      rescue ArgumentError
        false
      end

      def build_import(installation_id, record)
        payload = canonical_json(record)
        {
          installation_id:,
          client_id: record["id"],
          user_id: current_user&.id,
          progress_version: PROGRESS_VERSION,
          record_version: record["version"],
          payload:,
          payload_digest: Digest::SHA256.hexdigest(payload)
        }
      end

      def canonical_json(value)
        JSON.generate(canonicalize(value))
      end

      def canonicalize(value)
        case value
        when Hash
          value.keys.map(&:to_s).sort.to_h do |key|
            raw = value.key?(key) ? value[key] : value[key.to_sym]
            [ key, canonicalize(raw) ]
          end
        when Array
          value.map { |entry| canonicalize(entry) }
        else
          value
        end
      end

      def invalid(code, message)
        { ok: false, code:, message: }
      end

      def record_owned_by_another_user?(record)
        record.user_id.present? && record.user_id != current_user&.id
      end

      def render_error(code, message, status, conflicts: [])
        render json: { error: { code:, message: }, conflicts: }, status:
      end
    end
  end
end
