require "json"

module Content
  class Mirror
    class Error < StandardError
    end

    MIRRORED_ATTRIBUTES = %w[
      manifest_id
      manifest_schema_version
      kind
      slug
      locale
      content_version
      route_path
      view_path
      content_mode
      publication_status
      rights_status
      asset_digest
      source_packet_ids
      technical_review_status
      technical_review_evidence
      domain_review_status
      domain_review_reviewer
      domain_reviewed_at
      rights_notes
    ].freeze

    def initialize(manifest: Manifest.new, asset_class: ContentAsset)
      @manifest = manifest
      @asset_class = asset_class
    end

    def import!(retire_missing: false)
      records = manifest.lessons
      records.each { |record| manifest.verify_asset!(record) }

      expected_ids = records.map { |record| record.fetch("id") }
      stale_assets = asset_class.where.not(asset_id: expected_ids)
      if stale_assets.exists? && !retire_missing
        stale_ids = stale_assets.order(:asset_id).pluck(:asset_id)
        raise Error, "Content mirror contains assets missing from manifest: #{stale_ids.join(", ")}"
      end

      result = { created: 0, updated: 0, unchanged: 0, retired: 0 }
      asset_class.transaction do
        records.each do |record|
          asset = asset_class.find_or_initialize_by(asset_id: record.fetch("id"))
          attributes = attributes_for(record)

          if asset.new_record?
            asset.assign_attributes(attributes)
            asset.save!
            result[:created] += 1
          elsif attributes_match?(asset, attributes)
            result[:unchanged] += 1
          else
            asset.update!(attributes)
            result[:updated] += 1
          end
        end

        if retire_missing
          result[:retired] = stale_assets.count
          stale_assets.update_all(publication_status: "retired", updated_at: Time.current)
        end
      end

      result
    end

    def verify!
      records = manifest.lessons
      records.each do |record|
        manifest.verify_asset!(record)
        asset = asset_class.find_by(asset_id: record.fetch("id"))
        raise Error, "Content mirror is missing asset #{record.fetch("id")}" unless asset

        attributes = attributes_for(record)
        mismatches = MIRRORED_ATTRIBUTES.select { |key| asset.public_send(key) != attributes.fetch(key.to_sym) }
        next if mismatches.empty?

        raise Error, "Content mirror mismatch for #{record.fetch("id")}: #{mismatches.join(", ")}"
      end

      expected_ids = records.map { |record| record.fetch("id") }
      stale_ids = asset_class.where.not(asset_id: expected_ids).order(:asset_id).pluck(:asset_id)
      raise Error, "Content mirror contains stale assets: #{stale_ids.join(", ")}" if stale_ids.any?

      true
    end

    private

    attr_reader :manifest, :asset_class

    def attributes_for(record)
      {
        manifest_id: manifest.data.fetch("manifest_id"),
        manifest_schema_version: manifest.data.fetch("schema_version"),
        kind: record.fetch("kind"),
        slug: record.fetch("slug"),
        locale: record.fetch("locale"),
        content_version: record.fetch("content_version"),
        route_path: record.fetch("route_path"),
        view_path: record.fetch("view_path"),
        content_mode: record.fetch("content_mode"),
        publication_status: record.fetch("publication_status"),
        rights_status: record.fetch("rights_status"),
        asset_digest: record.fetch("asset_digest"),
        source_packet_ids: JSON.generate(record.fetch("source_packet_ids")),
        technical_review_status: record.dig("technical_review", "status"),
        technical_review_evidence: JSON.generate(record.dig("technical_review", "evidence") || []),
        domain_review_status: record.dig("domain_review", "status"),
        domain_review_reviewer: record.dig("domain_review", "reviewer"),
        domain_reviewed_at: record.dig("domain_review", "reviewed_at"),
        rights_notes: record.fetch("rights_notes")
      }
    end

    def attributes_match?(asset, attributes)
      MIRRORED_ATTRIBUTES.all? { |key| asset.public_send(key) == attributes.fetch(key.to_sym) }
    end
  end
end
