require "json"

module Content
  class Catalog
    class Error < StandardError
    end

    CATALOG_PATH = Rails.root.join("data/content/curriculum-v1.json")

    attr_reader :path

    def initialize(path: CATALOG_PATH, canonical_registry: CanonicalRegistry.new)
      @path = Pathname(path)
      @canonical_registry = canonical_registry
    end

    attr_reader :canonical_registry

    def data
      @data ||= JSON.parse(path.read)
    rescue JSON::ParserError, Errno::ENOENT => error
      raise Error, "Unable to load content catalog at #{path}: #{error.message}"
    end

    def lessons
      @lessons ||= Array(data.fetch("lessons")).sort_by { |lesson| lesson.fetch("sequence") }
    rescue KeyError, TypeError => error
      raise Error, "Content catalog has no valid lessons array: #{error.message}"
    end

    def lesson!(slug:)
      lesson = lessons.find { |record| record.fetch("slug") == slug.to_s }
      return lesson if lesson

      raise Error, "Unknown curriculum lesson for slug=#{slug.inspect}"
    end

    def concepts
      @concepts ||= Array(data.fetch("concepts"))
    rescue KeyError, TypeError => error
      raise Error, "Content catalog has no valid concepts array: #{error.message}"
    end

    def concept!(id:)
      concept = concepts.find { |record| record.fetch("id") == id.to_s }
      return concept if concept

      raise Error, "Unknown curriculum concept #{id.inspect}"
    end

    def exercises
      @exercises ||= Array(data.fetch("exercises"))
    rescue KeyError, TypeError => error
      raise Error, "Content catalog has no valid exercises array: #{error.message}"
    end

    def exercises_for(slug:)
      exercises.select { |record| record.fetch("lesson_slug") == slug.to_s }
    end

    def exercise!(id:)
      exercise = exercises.find { |record| record.fetch("id") == id.to_s }
      return exercise if exercise

      raise Error, "Unknown curriculum exercise #{id.inspect}"
    end

    def source_references
      @source_references ||= Array(data.fetch("source_references"))
    rescue KeyError, TypeError => error
      raise Error, "Content catalog has no valid source_references array: #{error.message}"
    end

    def source_reference!(id:)
      reference = source_references.find { |record| record.fetch("id") == id.to_s }
      return reference if reference

      raise Error, "Unknown curriculum source reference #{id.inspect}"
    end

    def validate_canonical_references!
      canonical_registry.validate_catalog!(data)
    rescue CanonicalRegistry::Error => error
      raise Error, "Content catalog is not compatible with canonical registries: #{error.message}"
    end
  end
end
