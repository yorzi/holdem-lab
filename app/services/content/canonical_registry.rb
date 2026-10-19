require "digest"
require "json"

module Content
  class CanonicalRegistry
    class Error < StandardError
    end

    INDEX_PATH = Rails.root.join("data/content/canonical-content-v1.json")
    LAYER_IDS = %w[exercises sources source_references strategy].freeze
    STATUS_FIELDS = {
      "rights_statuses" => "rights_status",
      "integrity_statuses" => "integrity_status",
      "publication_statuses" => "publication_status",
      "technical_review_statuses" => ->(record) { record.dig("technical_review", "status") },
      "domain_review_statuses" => ->(record) { record.dig("domain_review", "status") }
    }.freeze

    attr_reader :index_path, :root

    def initialize(index_path: INDEX_PATH, root: Rails.root)
      @index_path = Pathname(index_path)
      @root = Pathname(root)
    end

    def data
      @data ||= read_json(index_path, "canonical content index")
    end

    def contract_id
      data.fetch("contract_id")
    rescue KeyError => error
      raise Error, "Canonical content index is missing contract_id: #{error.message}"
    end

    def schema_version
      data.fetch("schema_version")
    rescue KeyError => error
      raise Error, "Canonical content index is missing schema_version: #{error.message}"
    end

    def layer_ids
      layers = data.fetch("layers")
      raise Error, "Canonical content index layers must be an array" unless layers.is_a?(Array)
      raise Error, "Canonical content index layers must contain objects" unless layers.all? { |layer| layer.is_a?(Hash) }

      ids = layers.map { |layer| layer.fetch("id") }
      unknown = ids - LAYER_IDS
      raise Error, "Canonical content index contains unsupported layers: #{unknown.join(", ")}" if unknown.any?
      raise Error, "Canonical content index contains duplicate layers" unless ids.uniq.length == ids.length

      ids
    rescue KeyError, TypeError => error
      raise Error, "Canonical content index has invalid layers: #{error.message}"
    end

    def layer!(layer_id)
      layer_id = layer_id.to_s
      raise Error, "Unsupported canonical content layer #{layer_id}" unless LAYER_IDS.include?(layer_id)
      return @layers.fetch(layer_id) if defined?(@layers) && @layers.key?(layer_id)

      layers = data.fetch("layers")
      raise Error, "Canonical content index layers must be an array" unless layers.is_a?(Array)
      definition = layers.find { |layer| layer.is_a?(Hash) && layer.fetch("id") == layer_id }
      raise Error, "Canonical content index is missing layer #{layer_id}" unless definition

      relative_path = definition.fetch("path")
      path = root.join(relative_path)
      registry_data = read_json(path, "canonical #{layer_id} registry")
      validate_layer!(layer_id, definition, registry_data, path)

      @layers ||= {}
      @layers[layer_id] = {
        definition: definition,
        data: registry_data,
        path: path,
        digest: Digest::SHA256.file(path).hexdigest,
        records: registry_data.fetch("records")
      }
    rescue KeyError, TypeError => error
      raise Error, "Canonical #{layer_id} registry is malformed: #{error.message}"
    rescue Errno::ENOENT, Errno::EACCES => error
      raise Error, "Unable to read canonical #{layer_id} registry: #{error.message}"
    end

    def records(layer_id)
      layer!(layer_id).fetch(:records)
    end

    def registry_id(layer_id)
      layer!(layer_id).fetch(:data).fetch("registry_id")
    end

    def registry_digest(layer_id)
      layer!(layer_id).fetch(:digest)
    end

    def exercise_template_for(exercise)
      raise Error, "Canonical exercise mapping requires an object record" unless exercise.is_a?(Hash)

      exercise_id = exercise.fetch("id")
      matches = records("exercises").select do |template|
        Array(template["catalog_exercise_ids"]).include?(exercise_id)
      end
      if matches.length != 1
        raise Error, "Canonical exercise template mapping for #{exercise_id} must resolve to exactly one record"
      end

      template = matches.first
      if exercise.key?("exercise_type") && template.fetch("exercise_type") != exercise.fetch("exercise_type")
        raise Error, "Canonical exercise template does not match #{exercise_id} type or answer contract"
      end
      if exercise.key?("answer_contract") && template.fetch("answer_contract") != exercise.fetch("answer_contract")
        raise Error, "Canonical exercise template does not match #{exercise_id} type or answer contract"
      end

      template
    rescue KeyError => error
      raise Error, "Canonical exercise mapping for #{exercise_id} is incomplete: #{error.message}"
    end

    def source!(source_id)
      source_id = source_id.to_s
      source = records("sources").find { |record| record.fetch("source_id") == source_id }
      return source if source

      raise Error, "Canonical source registry is missing #{source_id}"
    rescue KeyError => error
      raise Error, "Canonical source registry record is incomplete: #{error.message}"
    end

    def source_reference_for(reference)
      raise Error, "Canonical source-reference mapping requires an object record" unless reference.is_a?(Hash)

      source_reference_id = reference.fetch("id")
      source_reference = records("source_references").find do |record|
        record.fetch("source_reference_id") == source_reference_id
      end
      return source_reference if source_reference

      raise Error, "Canonical source-reference registry is missing #{source_reference_id}"
    rescue KeyError => error
      raise Error, "Canonical source-reference mapping for #{source_reference_id} is incomplete: #{error.message}"
    end

    def validate_catalog!(catalog_data)
      raise Error, "Curriculum must be an object" unless catalog_data.is_a?(Hash)

      catalog_exercises = Array(catalog_data.fetch("exercises"))
      catalog_source_references = Array(catalog_data.fetch("source_references"))

      catalog_exercises.each do |exercise|
        raise Error, "Curriculum exercise records must be objects" unless exercise.is_a?(Hash)

        exercise_template_for(exercise)
      end
      known_packet_ids = records("sources").flat_map { |record| Array(record.fetch("source_packet_ids")) }.uniq
      catalog_source_references.each do |reference|
        raise Error, "Curriculum source reference records must be objects" unless reference.is_a?(Hash)

        canonical_reference = source_reference_for(reference)
        packet_id = canonical_reference.fetch("source_packet_id")
        unless known_packet_ids.include?(packet_id)
          raise Error, "Canonical source registry has no record for quality packet #{packet_id}"
        end
        Array(canonical_reference.fetch("source_ids")).each { |source_id| source!(source_id) }
      end

      Array(catalog_data.fetch("lessons")).each do |lesson|
        raise Error, "Curriculum lesson records must be objects" unless lesson.is_a?(Hash)

        Array(lesson.fetch("source_packet_ids")).each do |packet_id|
          next if known_packet_ids.include?(packet_id)

          raise Error, "Canonical source registry has no record for quality packet #{packet_id}"
        end
      end

      true
    rescue KeyError, TypeError => error
      raise Error, "Curriculum cannot be validated against canonical registries: #{error.message}"
    end

    def snapshots
      layer_ids.map { |layer_id| snapshot_for(layer_id) }
    end

    def snapshot
      {
        contract_id: contract_id,
        contract_schema_version: schema_version,
        layers: snapshots
      }
    end

    private

    def read_json(path, label)
      JSON.parse(path.read)
    rescue JSON::ParserError, Errno::ENOENT, Errno::EACCES => error
      raise Error, "Unable to load #{label} at #{path}: #{error.message}"
    end

    def validate_layer!(layer_id, definition, registry_data, path)
      raise Error, "Canonical #{layer_id} registry schema_version must be 1" unless registry_data.fetch("schema_version") == 1
      raise Error, "Canonical #{layer_id} registry layer does not match index" unless registry_data.fetch("layer") == layer_id
      raise Error, "Canonical #{layer_id} registry requires automated validation" unless registry_data.fetch("technical_status") == "automated_pass_required"
      raise Error, "Canonical #{layer_id} registry has no registry_id" if registry_data.fetch("registry_id").to_s.empty?
      raise Error, "Canonical #{layer_id} registry has no records array" unless registry_data.fetch("records").is_a?(Array)
      raise Error, "Canonical #{layer_id} registry has no record key" if definition.fetch("record_key").to_s.empty?

      key = definition.fetch("record_key")
      ids = registry_data.fetch("records").map do |record|
        raise Error, "Canonical #{layer_id} registry contains a non-object record" unless record.is_a?(Hash)

        record.fetch(key)
      end
      raise Error, "Canonical #{layer_id} registry contains duplicate #{key}" unless ids.uniq.length == ids.length

      verify_record_digests!(layer_id, registry_data.fetch("records"), path)
    rescue KeyError, TypeError => error
      raise Error, "Canonical #{layer_id} registry is incomplete: #{error.message}"
    end

    def verify_record_digests!(layer_id, records, registry_path)
      records.each_with_index do |record, index|
        asset_path = record["asset_path"]
        asset_digest = record["asset_sha256"]
        runtime_path = record["runtime_path"]
        runtime_digest = record["runtime_digest"]

        if asset_path || asset_digest
          verify_digest!(asset_path, asset_digest, "#{layer_id} record #{index}", allow_nil: true)
        end
        verify_digest!(runtime_path, runtime_digest, "#{layer_id} record #{index} runtime", allow_nil: true) if runtime_path || runtime_digest
      end
    rescue Errno::ENOENT, Errno::EACCES => error
      raise Error, "Canonical #{layer_id} registry asset cannot be read from #{registry_path}: #{error.message}"
    end

    def verify_digest!(relative_path, expected_digest, label, allow_nil: false)
      if relative_path.nil? || expected_digest.nil?
        return if allow_nil && relative_path.nil? && expected_digest.nil?

        raise Error, "#{label} must provide both path and SHA-256 digest"
      end
      unless expected_digest.match?(/\A[a-f0-9]{64}\z/)
        raise Error, "#{label} has an invalid SHA-256 digest"
      end

      path = root.join(relative_path)
      raise Error, "#{label} asset is missing: #{relative_path}" unless path.file?
      actual_digest = Digest::SHA256.file(path).hexdigest
      return if actual_digest == expected_digest

      raise Error, "#{label} digest mismatch for #{relative_path}"
    end

    def snapshot_for(layer_id)
      layer = layer!(layer_id)
      records = layer.fetch(:records)
      {
        contract_id: contract_id,
        contract_schema_version: schema_version,
        layer: layer_id,
        path: layer.fetch(:definition).fetch("path"),
        registry_id: layer.fetch(:data).fetch("registry_id"),
        registry_schema_version: layer.fetch(:data).fetch("schema_version"),
        registry_digest: layer.fetch(:digest),
        runtime_status: layer.fetch(:definition).fetch("runtime_status"),
        record_count: records.length,
        status_summary: status_summary(records)
      }
    end

    def status_summary(records)
      STATUS_FIELDS.to_h do |key, field|
        values = records.filter_map do |record|
          field.respond_to?(:call) ? field.call(record) : record[field]
        end.compact.uniq.sort
        [ key, values ]
      end
    end
  end
end
