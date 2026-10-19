require "json"

module Content
  class CatalogMirror
    class Error < StandardError
    end

    COLLECTIONS = {
      lessons: { model: Content::Lesson, collection: :lessons, id_attribute: :lesson_id },
      concepts: { model: Content::Concept, collection: :concepts, id_attribute: :concept_id },
      exercises: { model: Content::Exercise, collection: :exercises, id_attribute: :exercise_id },
      source_references: {
        model: Content::SourceReference,
        collection: :source_references,
        id_attribute: :source_reference_id
      }
    }.freeze

    def initialize(catalog: Catalog.new, collections: COLLECTIONS)
      @catalog = catalog
      @collections = collections
    end

    def import!(retire_missing: false)
      catalog.validate_canonical_references! if catalog.respond_to?(:validate_canonical_references!)
      current_records = records_by_kind
      stale_records = stale_by_kind(current_records)
      raise_stale_error!(stale_records) unless retire_missing

      result = {}
      ApplicationRecord.transaction do
        current_records.each do |kind, records|
          result[kind] = import_records(kind, records, stale_records.fetch(kind), retire_missing: retire_missing)
        end
      end

      result
    rescue ActiveRecord::RecordInvalid => error
      raise Error, "Content catalog mirror import failed: #{error.message}"
    end

    def verify!
      records_by_kind.each do |kind, records|
        definition = collections.fetch(kind)
        model = definition.fetch(:model)
        id_attribute = definition.fetch(:id_attribute)

        records.each do |record|
          stable_id = record.fetch("id")
          mirrored = model.find_by(id_attribute => stable_id)
          raise Error, "Content catalog mirror is missing #{kind.to_s.singularize} #{stable_id}" unless mirrored

          attributes = attributes_for(kind, record)
          mismatches = attributes.keys.select { |key| mirrored.public_send(key) != attributes.fetch(key) }
          next if mismatches.empty?

          raise Error, "Content catalog mirror mismatch for #{stable_id}: #{mismatches.join(", ")}"
        end

        expected_ids = records.map { |record| record.fetch("id") }
        stale_ids = model.where.not(id_attribute => expected_ids).order(id_attribute).pluck(id_attribute)
        next if stale_ids.empty?

        raise Error, "Content catalog mirror contains stale #{kind}: #{stale_ids.join(", ")}"
      end

      true
    end

    private

    attr_reader :catalog, :collections

    def records_by_kind
      @records_by_kind ||= collections.to_h do |kind, definition|
        [ kind, Array(catalog.public_send(definition.fetch(:collection))) ]
      end
    end

    def stale_by_kind(current_records)
      current_records.to_h do |kind, records|
        definition = collections.fetch(kind)
        model = definition.fetch(:model)
        id_attribute = definition.fetch(:id_attribute)
        expected_ids = records.map { |record| record.fetch("id") }
        [ kind, model.where.not(id_attribute => expected_ids) ]
      end
    end

    def raise_stale_error!(stale_records)
      stale = stale_records.filter_map do |kind, relation|
        id_attribute = collections.fetch(kind).fetch(:id_attribute)
        ids = relation.order(id_attribute).pluck(id_attribute)
        ids.any? ? "#{kind}=#{ids.join(",")}" : nil
      end
      return if stale.empty?

      raise Error, "Content catalog mirror contains records missing from catalog: #{stale.join("; ")}"
    end

    def import_records(kind, records, stale_relation, retire_missing:)
      definition = collections.fetch(kind)
      model = definition.fetch(:model)
      id_attribute = definition.fetch(:id_attribute)
      result = { created: 0, updated: 0, unchanged: 0, retired: 0 }

      records.each do |record|
        stable_id = record.fetch("id")
        mirrored = model.find_or_initialize_by(id_attribute => stable_id)
        attributes = attributes_for(kind, record)

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
        result[:retired] = stale_relation.count
        stale_relation.update_all(publication_status: "retired", updated_at: Time.current)
      end

      result
    end

    def attributes_match?(record, attributes)
      attributes.all? { |key, value| record.public_send(key) == value }
    end

    def attributes_for(kind, record)
      return source_reference_attributes(record) if kind == :source_references

      common_attributes(record).merge(
        case kind
        when :lessons then lesson_attributes(record)
        when :concepts then concept_attributes(record)
        when :exercises then exercise_attributes(record)
        else raise Error, "Unknown catalog collection #{kind.inspect}"
        end
      )
    end

    def common_attributes(record)
      {
        catalog_id: catalog.data.fetch("catalog_id"),
        catalog_schema_version: catalog.data.fetch("schema_version"),
        publication_status: record.fetch("publication_status"),
        rights_status: record.fetch("rights_status"),
        domain_review_status: record.dig("domain_review", "status"),
        domain_review_reviewer: record.dig("domain_review", "reviewer"),
        domain_reviewed_at: record.dig("domain_review", "reviewed_at")
      }
    end

    def lesson_attributes(record)
      {
        lesson_id: record.fetch("id"),
        slug: record.fetch("slug"),
        sequence: record.fetch("sequence"),
        content_version: record.fetch("content_version"),
        asset_ids: json(record.fetch("asset_ids")),
        source_packet_ids: json(record.fetch("source_packet_ids")),
        concept_ids: json(record.fetch("concept_ids")),
        exercise_ids: json(record.fetch("exercise_ids")),
        source_reference_ids: json(record.fetch("source_reference_ids")),
        technical_review_status: record.dig("technical_review", "status"),
        technical_review_evidence: json(record.dig("technical_review", "evidence") || [])
      }
    end

    def concept_attributes(record)
      {
        concept_id: record.fetch("id"),
        lesson_id: lesson_id_for(record.fetch("lesson_slug")),
        slug: record.fetch("slug"),
        difficulty: record.fetch("difficulty"),
        prerequisite_ids: json(record.fetch("prerequisite_ids")),
        display: json(record.fetch("display")),
        source_reference_ids: json(record.fetch("source_reference_ids"))
      }
    end

    def exercise_attributes(record)
      template = canonical_registry.exercise_template_for(record)

      {
        exercise_id: record.fetch("id"),
        lesson_id: lesson_id_for(record.fetch("lesson_slug")),
        concept_id: record.fetch("concept_id"),
        dom_id: record.fetch("dom_id"),
        exercise_type: template.fetch("exercise_type"),
        answer_contract: template.fetch("answer_contract"),
        answer_code: record.fetch("answer_code"),
        view_answer_value: record.fetch("view_answer_value").to_s,
        source_reference_ids: json(record.fetch("source_reference_ids")),
        technical_review_status: record.dig("technical_review", "status"),
        technical_review_evidence: json(record.dig("technical_review", "evidence") || []),
        canonical_template_id: template.fetch("template_id"),
        canonical_registry_id: canonical_registry.registry_id("exercises"),
        canonical_registry_digest: canonical_registry.registry_digest("exercises")
      }
    end

    def source_reference_attributes(record)
      canonical_reference = canonical_registry.source_reference_for(record)

      {
        catalog_id: catalog.data.fetch("catalog_id"),
        catalog_schema_version: catalog.data.fetch("schema_version"),
        source_reference_id: record.fetch("id"),
        kind: canonical_reference.fetch("kind"),
        source_packet_id: canonical_reference.fetch("source_packet_id"),
        claim_id: canonical_reference.fetch("claim_id"),
        source_ids: json(canonical_reference.fetch("source_ids")),
        publication_status: canonical_reference.fetch("publication_status"),
        rights_status: canonical_reference.fetch("rights_status"),
        integrity_status: canonical_reference.fetch("integrity_status"),
        technical_review_status: canonical_reference.dig("technical_review", "status"),
        technical_review_evidence: json(canonical_reference.dig("technical_review", "evidence") || []),
        domain_review_status: canonical_reference.dig("domain_review", "status"),
        domain_review_reviewer: canonical_reference.dig("domain_review", "reviewer"),
        domain_reviewed_at: canonical_reference.dig("domain_review", "reviewed_at"),
        canonical_registry_id: canonical_registry.registry_id("source_references"),
        canonical_registry_digest: canonical_registry.registry_digest("source_references")
      }
    end

    def lesson_id_for(slug)
      lesson = catalog.lessons.find { |record| record.fetch("slug") == slug }
      raise Error, "Content catalog has no lesson for slug=#{slug.inspect}" unless lesson

      lesson.fetch("id")
    end

    def json(value)
      JSON.generate(value)
    end

    def canonical_registry
      return @canonical_registry if defined?(@canonical_registry)

      @canonical_registry = if catalog.respond_to?(:canonical_registry)
        catalog.canonical_registry
      else
        Content::CanonicalRegistry.new
      end
    end
  end
end
