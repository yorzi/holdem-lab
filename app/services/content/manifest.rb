require "digest"
require "json"

module Content
  class Manifest
    class Error < StandardError
    end

    MANIFEST_PATH = Rails.root.join("data/content/lesson-manifest-v1.json")

    attr_reader :path

    def initialize(path: MANIFEST_PATH)
      @path = Pathname(path)
    end

    def data
      @data ||= JSON.parse(path.read)
    rescue JSON::ParserError, Errno::ENOENT => error
      raise Error, "Unable to load content manifest at #{path}: #{error.message}"
    end

    def records
      @records ||= Array(data.fetch("records"))
    rescue KeyError, TypeError => error
      raise Error, "Content manifest has no valid records array: #{error.message}"
    end

    def lessons(locale: nil)
      lessons = records.select { |record| record.fetch("kind") == "lesson" }
      locale ? lessons.select { |record| record.fetch("locale") == locale.to_s } : lessons
    rescue KeyError, TypeError => error
      raise Error, "Content manifest contains an invalid lesson record: #{error.message}"
    end

    def lesson!(slug:, locale:)
      lesson = lessons(locale: locale).find { |record| record.fetch("slug") == slug.to_s }
      return lesson if lesson

      raise Error, "Unknown lesson asset for slug=#{slug.inspect}, locale=#{locale.inspect}"
    end

    def source_packet_for(record)
      packet_id = Array(record.fetch("source_packet_ids")).first
      raise Error, "Lesson #{record.fetch("id")} has no source packet" if packet_id.blank?

      packet_path = Rails.root.join("data/quality/source_packets/#{packet_id}.json")
      JSON.parse(packet_path.read)
    rescue JSON::ParserError, Errno::ENOENT, KeyError => error
      raise Error, "Unable to load source packet for #{record.fetch("id")}: #{error.message}"
    end

    def verify_asset!(record)
      view_path = Rails.root.join(record.fetch("view_path"))
      raise Error, "Lesson #{record.fetch("id")} view is missing: #{view_path}" unless view_path.file?

      actual_digest = Digest::SHA256.file(view_path).hexdigest
      expected_digest = record.fetch("asset_digest")
      return true if actual_digest == expected_digest

      raise Error, "Lesson #{record.fetch("id")} digest mismatch: expected #{expected_digest}, got #{actual_digest}"
    rescue Errno::ENOENT, KeyError => error
      raise Error, "Unable to verify lesson asset: #{error.message}"
    end
  end
end
