class CreateContentAssets < ActiveRecord::Migration[8.1]
  def change
    create_table :content_assets do |t|
      t.string :asset_id, null: false
      t.string :manifest_id, null: false
      t.integer :manifest_schema_version, null: false
      t.string :kind, null: false
      t.string :slug, null: false
      t.string :locale, null: false
      t.string :content_version, null: false
      t.string :route_path, null: false
      t.string :view_path, null: false
      t.string :content_mode, null: false
      t.string :publication_status, null: false
      t.string :rights_status, null: false
      t.string :asset_digest, null: false
      t.text :source_packet_ids, null: false
      t.string :technical_review_status, null: false
      t.text :technical_review_evidence, null: false
      t.string :domain_review_status, null: false
      t.string :domain_review_reviewer
      t.string :domain_reviewed_at
      t.text :rights_notes, null: false
      t.timestamps
    end

    add_index :content_assets, :asset_id, unique: true
    add_index :content_assets, [ :slug, :locale ], unique: true
    add_index :content_assets, :publication_status
  end
end
