module Content
  class PublicationWorkflow
    PROMOTION_STATUSES = %w[review_preview published].freeze
    BLOCKER_CODES = %w[
      missing_lesson_graph
      record_retired
      record_not_review_preview
      rights_not_ready
      technical_review_not_passed
      domain_review_not_approved
      domain_review_metadata_missing
      canonical_record_binding_drifted
      canonical_registry_snapshot_missing
      canonical_registry_drifted
      canonical_registry_unavailable
    ].freeze

    class BlockedError < StandardError
      attr_reader :readiness

      def initialize(readiness)
        @readiness = readiness
        super("Content publication blocked for #{readiness.fetch(:slug)}/#{readiness.fetch(:locale)}: " \
          "#{readiness.fetch(:blocker_codes).join(", ")}")
      end
    end

    def initialize(query: Content::Query.new, asset_class: ContentAsset, lesson_class: Content::Lesson)
      @query = query
      @asset_class = asset_class
      @lesson_class = lesson_class
    end

    def readiness_for(slug:, locale:)
      slug = slug.to_s
      locale = locale.to_s
      asset = asset_class.find_by(slug: slug, locale: locale)
      lesson = lesson_class.find_by(slug: slug)
      return missing_graph_readiness(slug: slug, locale: locale) unless asset && lesson

      graph = query.review_preview_lesson(slug: slug, locale: locale)
      unless graph
        blockers = [
          *blockers_for(asset, "asset"),
          *blockers_for(lesson, "lesson")
        ]
        blockers << missing_graph_blocker(slug: slug, locale: locale) if graph_statuses_ready?(asset, lesson)
        blockers.concat(canonical_registry_blockers)
        return build_readiness(slug: slug, locale: locale, blockers: blockers)
      end

      blockers = graph_records(graph).flat_map do |record_type, record|
        blockers_for(record, record_type)
      end
      blockers.concat(canonical_registry_blockers)

      build_readiness(slug: slug, locale: locale, blockers: blockers)
    end

    def readiness_report(locale: nil)
      assets = asset_class.order(:slug, :locale)
      assets = assets.where(locale: locale.to_s) if locale

      assets.map { |asset| readiness_for(slug: asset.slug, locale: asset.locale) }
    end

    # Internal-only transition. There is deliberately no public route or task
    # that calls this method; an authorization and audit boundary must exist
    # before a production publisher is introduced.
    def promote!(slug:, locale:)
      readiness = readiness_for(slug: slug, locale: locale)
      raise BlockedError, readiness unless readiness.fetch(:ready)

      ApplicationRecord.transaction do
        current_readiness = readiness_for(slug: slug, locale: locale)
        raise BlockedError, current_readiness unless current_readiness.fetch(:ready)

        graph = query.review_preview_lesson(slug: slug, locale: locale)
        raise BlockedError, missing_graph_readiness(slug: slug.to_s, locale: locale.to_s) unless graph

        graph_records(graph).each do |_record_type, record|
          next if record.publication_status == "published"

          record.update!(publication_status: "published")
        end
      end

      readiness_for(slug: slug, locale: locale)
    end

    private

    attr_reader :query, :asset_class, :lesson_class

    def graph_records(graph)
      [
        [ "asset", graph.fetch(:asset) ],
        [ "lesson", graph.fetch(:lesson) ],
        *graph.fetch(:concepts).map { |record| [ "concept", record ] },
        *graph.fetch(:exercises).map { |record| [ "exercise", record ] },
        *graph.fetch(:source_references).map { |record| [ "source_reference", record ] }
      ]
    end

    def blockers_for(record, record_type)
      return [ blocker("record_retired", record_type, record) ] if record.publication_status == "retired"

      blockers = []
      unless PROMOTION_STATUSES.include?(record.publication_status)
        blockers << blocker("record_not_review_preview", record_type, record)
      end

      blockers << blocker("rights_not_ready", record_type, record) unless rights_ready?(record)
      blockers << blocker("technical_review_not_passed", record_type, record) unless technical_review_passed?(record)
      blockers << blocker("canonical_record_binding_drifted", record_type, record) unless query.canonical_record_binding_valid?(record)

      if record.domain_review_status != "approved"
        blockers << blocker("domain_review_not_approved", record_type, record)
      elsif record.domain_review_reviewer.blank? || record.domain_reviewed_at.blank?
        blockers << blocker("domain_review_metadata_missing", record_type, record)
      end

      blockers
    end

    def graph_statuses_ready?(asset, lesson)
      PROMOTION_STATUSES.include?(asset.publication_status) &&
        PROMOTION_STATUSES.include?(lesson.publication_status)
    end

    def rights_ready?(record)
      if record.is_a?(asset_class)
        record.rights_status == "original_authored"
      else
        record.class.published_rights_statuses.include?(record.rights_status)
      end
    end

    def technical_review_passed?(record)
      if record.is_a?(asset_class)
        record.technical_review_status == "passed"
      else
        attribute = record.class.technical_review_attribute
        attribute.nil? || record.public_send(attribute) == "passed"
      end
    end

    def blocker(code, record_type, record)
      raise ArgumentError, "Unknown publication blocker code: #{code}" unless BLOCKER_CODES.include?(code)

      {
        code: code,
        record_type: record_type,
        record_id: record.stable_id,
        publication_status: record.publication_status
      }
    end

    def build_readiness(slug:, locale:, blockers:)
      {
        slug: slug,
        locale: locale,
        ready: blockers.empty?,
        blocker_codes: blockers.map { |item| item.fetch(:code) }.uniq,
        blockers: blockers
      }
    end

    def missing_graph_readiness(slug:, locale:)
      build_readiness(
        slug: slug,
        locale: locale,
        blockers: [ missing_graph_blocker(slug: slug, locale: locale) ]
      )
    end

    def missing_graph_blocker(slug:, locale:)
      {
        code: "missing_lesson_graph",
        record_type: "lesson_graph",
        record_id: "#{slug}:#{locale}",
        publication_status: nil
      }
    end

    def canonical_registry_blockers
      status = query.canonical_registry_status
      return [] if status.fetch(:ready)

      code = status.fetch(:code)
      raise ArgumentError, "Unknown publication blocker code: #{code}" unless BLOCKER_CODES.include?(code)

      [
        {
          code: code,
          record_type: "canonical_registry",
          record_id: status.fetch(:contract_id),
          publication_status: nil,
          layers: status.fetch(:layers)
        }
      ]
    end
  end
end
