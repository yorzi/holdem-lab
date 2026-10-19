require "json"

namespace :content do
  desc "Import versioned content assets and curriculum records into the SQLite mirror"
  task import: :environment do
    retire_missing = ENV["RETIRE_MISSING"] == "1"
    registry_result = Content::RegistryMirror.new.import!(retire_missing: retire_missing)
    asset_result = Content::Mirror.new.import!(retire_missing: retire_missing)
    catalog_result = Content::CatalogMirror.new.import!(retire_missing: retire_missing)
    puts "Canonical registry snapshot import: #{registry_result.inspect}"
    puts "Content asset mirror import: #{asset_result.inspect}"
    puts "Content catalog mirror import: #{catalog_result.inspect}"
  end

  desc "Verify the SQLite content mirror against the manifest, curriculum graph, and authored views"
  task verify: :environment do
    Content::RegistryMirror.new.verify!
    Content::Mirror.new.verify!
    Content::CatalogMirror.new.verify!
    puts "Canonical registry, content asset, and catalog mirror verification passed"
  end

  desc "Report publication readiness for candidate content without mutating the mirror"
  task readiness: :environment do
    locale = ENV.fetch("LOCALE", "en")
    report = Content::PublicationWorkflow.new.readiness_report(locale: locale)
    puts JSON.pretty_generate(report)
  end
end
