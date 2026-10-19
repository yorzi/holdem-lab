# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Mirror the versioned content files into SQLite. All three mirrors are needed:
# the asset mirror alone leaves the curriculum graph and the canonical registry
# snapshots empty, which makes every lesson fail its publication gate.
Content::RegistryMirror.new.import!
Content::Mirror.new.import!
Content::CatalogMirror.new.import!
