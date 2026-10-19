module Content
  class Runtime
    SCOPES = %w[review_preview published].freeze
    PREVIEW_SCOPE = "review_preview"
    # The preview scope is "everything authored", not "everything not yet
    # published" — otherwise promoting a lesson makes it vanish from the
    # environments where it is written and reviewed. Matches
    # Content::Query::PREVIEW_STATUSES.
    PREVIEW_STATUSES = Content::Query::PREVIEW_STATUSES

    class Error < StandardError
    end

    class NotFound < Error
    end

    def initialize(
      scope:,
      query: Content::Query.new,
      manifest: Content::Manifest.new,
      catalog: Content::Catalog.new
    )
      @scope = scope.to_s
      raise ArgumentError, "Unknown content runtime scope: #{@scope.inspect}" unless SCOPES.include?(@scope)

      @query = query
      @manifest = manifest
      @catalog = catalog
    end

    attr_reader :scope

    def lessons(locale:)
      case scope
      when PREVIEW_SCOPE
        manifest.lessons(locale: locale).filter_map { |asset| preview_page(asset) }
      when "published"
        query.published_lessons(locale: locale).filter_map { |graph| published_page(graph) }
      end
    end

    def lesson!(slug:, locale:)
      if scope == "published"
        graph = query.published_lesson(slug: slug, locale: locale)
        return published_page(graph) if graph

        raise NotFound, "No #{scope} lesson for slug=#{slug.inspect}, locale=#{locale.inspect}"
      end

      page = lessons(locale: locale).find { |candidate| candidate.fetch(:asset).fetch("slug") == slug.to_s }
      return page if page

      raise NotFound, "No #{scope} lesson for slug=#{slug.inspect}, locale=#{locale.inspect}"
    end

    private

    attr_reader :query, :manifest, :catalog

    def preview_page(asset)
      return unless PREVIEW_STATUSES.include?(asset.fetch("publication_status"))

      manifest.verify_asset!(asset)
      page(
        asset: asset,
        curriculum: catalog.lesson!(slug: asset.fetch("slug")),
        source_packet: manifest.source_packet_for(asset)
      )
    end

    def published_page(graph)
      database_asset = graph.fetch(:asset)
      manifest_asset = manifest.lesson!(slug: database_asset.slug, locale: database_asset.locale)
      verify_published_asset!(database_asset, manifest_asset)

      page(
        asset: manifest_asset.merge("publication_status" => database_asset.publication_status),
        curriculum: curriculum_hash(graph.fetch(:lesson)),
        source_packet: published_source_packet(manifest_asset, database_asset)
      )
    end

    def verify_published_asset!(database_asset, manifest_asset)
      expected = {
        "id" => database_asset.asset_id,
        "slug" => database_asset.slug,
        "locale" => database_asset.locale,
        "content_version" => database_asset.content_version,
        "route_path" => database_asset.route_path,
        "view_path" => database_asset.view_path,
        "asset_digest" => database_asset.asset_digest,
        "source_packet_ids" => database_asset.source_packet_id_list
      }
      actual = manifest_asset.slice(*expected.keys)
      return if actual == expected && manifest.verify_asset!(manifest_asset)

      raise Error, "Published asset mirror does not match its manifest: #{database_asset.asset_id}"
    end

    def curriculum_hash(lesson)
      {
        "id" => lesson.lesson_id,
        "slug" => lesson.slug,
        "sequence" => lesson.sequence,
        "content_version" => lesson.content_version,
        "asset_ids" => lesson.json_array(:asset_ids),
        "source_packet_ids" => lesson.json_array(:source_packet_ids),
        "concept_ids" => lesson.json_array(:concept_ids),
        "exercise_ids" => lesson.json_array(:exercise_ids),
        "source_reference_ids" => lesson.json_array(:source_reference_ids),
        "publication_status" => lesson.publication_status
      }
    end

    def published_source_packet(manifest_asset, database_asset)
      packet = manifest.source_packet_for(manifest_asset)
      packet.merge(
        "domain_review" => {
          "status" => database_asset.domain_review_status,
          "reviewer" => database_asset.domain_review_reviewer,
          "reviewed_at" => database_asset.domain_reviewed_at
        }
      )
    end

    def page(asset:, curriculum:, source_packet:)
      {
        asset: asset,
        curriculum: curriculum,
        source_packet: source_packet,
        scope: scope
      }
    end
  end
end
