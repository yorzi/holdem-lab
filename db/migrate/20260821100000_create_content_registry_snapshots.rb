class CreateContentRegistrySnapshots < ActiveRecord::Migration[8.1]
  def change
    create_table :content_registry_snapshots do |t|
      t.string :contract_id, null: false
      t.integer :contract_schema_version, null: false
      t.string :layer, null: false
      t.string :path, null: false
      t.string :registry_id, null: false
      t.integer :registry_schema_version, null: false
      t.string :registry_digest, null: false
      t.string :runtime_status, null: false
      t.integer :record_count, null: false
      t.text :status_summary, null: false
      t.string :status, null: false, default: "active"
      t.datetime :retired_at
      t.timestamps
    end

    add_index :content_registry_snapshots, [ :contract_id, :layer ], unique: true
    add_index :content_registry_snapshots, :registry_digest
    add_index :content_registry_snapshots, :status
  end
end
