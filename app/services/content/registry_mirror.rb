require "json"

module Content
  class RegistryMirror
    class Error < StandardError
    end

    MIRRORED_ATTRIBUTES = %i[
      contract_id
      contract_schema_version
      layer
      path
      registry_id
      registry_schema_version
      registry_digest
      runtime_status
      record_count
      status_summary
      status
      retired_at
    ].freeze

    def initialize(registry: CanonicalRegistry.new, snapshot_class: Content::RegistrySnapshot)
      @registry = registry
      @snapshot_class = snapshot_class
    end

    def import!(retire_missing: false)
      expected = registry.snapshots
      stale = stale_relation(expected)
      raise_stale_error!(stale) unless retire_missing

      result = { created: 0, updated: 0, unchanged: 0, retired: 0 }
      snapshot_class.transaction do
        expected.each do |snapshot|
          mirrored = snapshot_class.find_or_initialize_by(
            contract_id: snapshot.fetch(:contract_id),
            layer: snapshot.fetch(:layer)
          )
          attributes = attributes_for(snapshot)

          if mirrored.new_record?
            mirrored.assign_attributes(attributes)
            mirrored.save!
            result[:created] += 1
          elsif attributes_match?(mirrored, attributes)
            result[:unchanged] += 1
          else
            mirrored.update!(attributes)
            result[:updated] += 1
          end
        end

        if retire_missing
          result[:retired] = stale.count
          stale.update_all(status: "retired", retired_at: Time.current, updated_at: Time.current)
        end
      end

      result
    rescue ActiveRecord::RecordInvalid => error
      raise Error, "Canonical registry mirror import failed: #{error.message}"
    end

    def verify!
      expected = registry.snapshots
      expected.each do |snapshot|
        mirrored = snapshot_class.find_by(
          contract_id: snapshot.fetch(:contract_id),
          layer: snapshot.fetch(:layer)
        )
        raise Error, "Canonical registry mirror is missing #{snapshot.fetch(:layer)}" unless mirrored

        attributes = attributes_for(snapshot)
        mismatches = MIRRORED_ATTRIBUTES.select { |key| mirrored.public_send(key) != attributes.fetch(key) }
        next if mismatches.empty?

        raise Error, "Canonical registry mirror mismatch for #{snapshot.fetch(:layer)}: #{mismatches.join(", ")}"
      end

      stale = stale_relation(expected).where(status: "active")
      return true unless stale.exists?

      raise Error, "Canonical registry mirror contains stale active layers: #{stale.order(:layer).pluck(:layer).join(", ")}"
    end

    private

    attr_reader :registry, :snapshot_class

    def stale_relation(expected)
      expected_layers = expected.map { |snapshot| snapshot.fetch(:layer) }
      snapshot_class.where(contract_id: registry.contract_id).where.not(layer: expected_layers)
    end

    def raise_stale_error!(stale)
      return unless stale.exists?

      raise Error, "Canonical registry mirror contains layers missing from index: #{stale.order(:layer).pluck(:layer).join(", ")}"
    end

    def attributes_for(snapshot)
      snapshot.merge(status_summary: JSON.generate(snapshot.fetch(:status_summary)), status: "active", retired_at: nil)
    end

    def attributes_match?(record, attributes)
      MIRRORED_ATTRIBUTES.all? { |key| record.public_send(key) == attributes.fetch(key) }
    end
  end
end
