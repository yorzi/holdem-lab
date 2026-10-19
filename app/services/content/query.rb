module Content
  class Query
    PREVIEW_STATUSES = %w[review_preview published].freeze

    def initialize(
      asset_class: ContentAsset,
      lesson_class: Content::Lesson,
      concept_class: Content::Concept,
      exercise_class: Content::Exercise,
      source_reference_class: Content::SourceReference,
      canonical_registry: Content::CanonicalRegistry.new,
      registry_snapshot_class: Content::RegistrySnapshot
    )
      @asset_class = asset_class
      @lesson_class = lesson_class
      @concept_class = concept_class
      @exercise_class = exercise_class
      @source_reference_class = source_reference_class
      @canonical_registry = canonical_registry
      @registry_snapshot_class = registry_snapshot_class
    end

    def review_preview_lesson(slug:, locale:)
      asset = asset_class.find_by(slug: slug.to_s, locale: locale.to_s)
      return unless asset && PREVIEW_STATUSES.include?(asset.publication_status)

      lesson = lesson_class.find_by(slug: slug.to_s)
      return unless lesson && lesson.publication_status != "retired"

      build_lesson(asset, lesson)
    end

    def published_lessons(locale: nil)
      return [] unless canonical_registry_status.fetch(:ready)

      lesson_class.where(publication_status: "published").order(:sequence).flat_map do |lesson|
        assets = asset_class.where(slug: lesson.slug, publication_status: "published").order(:locale)
        assets = assets.where(locale: locale.to_s) if locale

        assets.filter_map do |asset|
          record = build_lesson(asset, lesson)
          record if fully_published?(record)
        end
      end
    end

    def published_lesson(slug:, locale:)
      published_lessons(locale: locale).find do |record|
        record.fetch(:asset).slug == slug.to_s
      end
    end

    def canonical_record_binding_valid?(record)
      case
      when record.is_a?(exercise_class)
        template = canonical_registry.exercise_template_for(
          "id" => record.exercise_id,
          "exercise_type" => record.exercise_type,
          "answer_contract" => record.answer_contract
        )
        record.canonical_template_id == template.fetch("template_id") &&
          record.canonical_registry_id == canonical_registry.registry_id("exercises") &&
          record.canonical_registry_digest == canonical_registry.registry_digest("exercises")
      when record.is_a?(source_reference_class)
        canonical_reference = canonical_registry.source_reference_for("id" => record.source_reference_id)
        record.canonical_registry_id == canonical_registry.registry_id("source_references") &&
          record.canonical_registry_digest == canonical_registry.registry_digest("source_references") &&
          record.kind == canonical_reference.fetch("kind") &&
          record.source_packet_id == canonical_reference.fetch("source_packet_id") &&
          record.claim_id == canonical_reference.fetch("claim_id") &&
          record.json_array(:source_ids) == Array(canonical_reference.fetch("source_ids")) &&
          record.rights_status == canonical_reference.fetch("rights_status") &&
          record.integrity_status == canonical_reference.fetch("integrity_status") &&
          record.technical_review_status == canonical_reference.dig("technical_review", "status") &&
          record.json_array(:technical_review_evidence) == Array(canonical_reference.dig("technical_review", "evidence"))
      else
        true
      end
    rescue Content::CanonicalRegistry::Error, ActiveRecord::StatementInvalid
      false
    end

    def canonical_registry_status
      expected = canonical_registry.snapshots
      active = registry_snapshot_class.where(
        contract_id: canonical_contract_id,
        status: "active"
      ).index_by(&:layer)
      missing = expected.filter_map { |snapshot| snapshot.fetch(:layer) unless active.key?(snapshot.fetch(:layer)) }
      drifted = expected.filter_map do |snapshot|
        mirrored = active[snapshot.fetch(:layer)]
        snapshot.fetch(:layer) if mirrored && !registry_snapshot_matches?(mirrored, snapshot)
      end
      stale = active.keys - expected.map { |snapshot| snapshot.fetch(:layer) }

      if missing.any?
        return {
          ready: false,
          code: "canonical_registry_snapshot_missing",
          contract_id: canonical_contract_id,
          layers: missing
        }
      end
      if drifted.any? || stale.any?
        return {
          ready: false,
          code: "canonical_registry_drifted",
          contract_id: canonical_contract_id,
          layers: (drifted + stale).uniq.sort
        }
      end

      {
        ready: true,
        code: nil,
        contract_id: canonical_contract_id,
        layers: expected.map { |snapshot| snapshot.fetch(:layer) }
      }
    rescue Content::CanonicalRegistry::Error, ActiveRecord::StatementInvalid => error
      {
        ready: false,
        code: "canonical_registry_unavailable",
        contract_id: canonical_contract_id,
        layers: [],
        message: error.message
      }
    end

    def snapshot
      {
        asset_counts: publication_counts(asset_class),
        lesson_counts: publication_counts(lesson_class),
        concept_counts: publication_counts(concept_class),
        exercise_counts: publication_counts(exercise_class),
        source_reference_counts: publication_counts(source_reference_class),
        canonical_registry: canonical_registry.snapshot,
        canonical_registry_status: canonical_registry_status,
        lessons: lesson_rows
      }
    end

    private

    attr_reader :asset_class, :lesson_class, :concept_class, :exercise_class, :source_reference_class,
      :canonical_registry, :registry_snapshot_class

    def build_lesson(asset, lesson)
      concept_ids = lesson.json_array(:concept_ids)
      exercise_ids = lesson.json_array(:exercise_ids)
      source_reference_ids = lesson.json_array(:source_reference_ids)
      concepts = ordered_records(concept_class, :concept_id, concept_ids)
      exercises = ordered_records(exercise_class, :exercise_id, exercise_ids)
      source_references = ordered_records(source_reference_class, :source_reference_id, source_reference_ids)

      return unless concepts.length == concept_ids.length
      return unless exercises.length == exercise_ids.length
      return unless source_references.length == source_reference_ids.length

      {
        asset: asset,
        lesson: lesson,
        concepts: concepts,
        exercises: exercises,
        source_references: source_references
      }
    end

    def ordered_records(model, id_attribute, ids)
      records = model.where(id_attribute => ids).index_by { |record| record.public_send(id_attribute) }
      ids.filter_map { |id| records[id] }
    end

    def registry_snapshot_matches?(mirrored, expected)
      mirrored.contract_id == expected.fetch(:contract_id) &&
        mirrored.contract_schema_version == expected.fetch(:contract_schema_version) &&
        mirrored.layer == expected.fetch(:layer) &&
        mirrored.path == expected.fetch(:path) &&
        mirrored.registry_id == expected.fetch(:registry_id) &&
        mirrored.registry_schema_version == expected.fetch(:registry_schema_version) &&
        mirrored.registry_digest == expected.fetch(:registry_digest) &&
        mirrored.runtime_status == expected.fetch(:runtime_status) &&
        mirrored.record_count == expected.fetch(:record_count) &&
        mirrored.status_summary_hash == expected.fetch(:status_summary)
    end

    def canonical_contract_id
      canonical_registry.contract_id
    rescue Content::CanonicalRegistry::Error
      "unknown"
    end

    def fully_published?(record)
      return false unless record

      records = [
        record.fetch(:asset),
        record.fetch(:lesson),
        *record.fetch(:concepts),
        *record.fetch(:exercises),
        *record.fetch(:source_references)
      ]
      records.all?(&:publication_gate_passed?) &&
        records.all? { |candidate| canonical_record_binding_valid?(candidate) }
    end

    def publication_counts(model)
      model.group(:publication_status).count.sort.to_h
    end

    def lesson_rows
      lesson_class.order(:sequence).map do |lesson|
        {
          id: lesson.lesson_id,
          slug: lesson.slug,
          sequence: lesson.sequence,
          publication_status: lesson.publication_status,
          assets: asset_class.where(slug: lesson.slug).order(:locale).map do |asset|
            {
              id: asset.asset_id,
              locale: asset.locale,
              publication_status: asset.publication_status
            }
          end,
          concept_count: lesson.json_array(:concept_ids).length,
          exercise_count: lesson.json_array(:exercise_ids).length,
          source_reference_count: lesson.json_array(:source_reference_ids).length
        }
      end
    end
  end
end
