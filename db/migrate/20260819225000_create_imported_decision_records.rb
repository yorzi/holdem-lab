class CreateImportedDecisionRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :imported_decision_records do |t|
      t.string :installation_id, null: false
      t.string :client_id, null: false
      t.string :progress_version, null: false
      t.integer :record_version, null: false
      t.text :payload, null: false
      t.string :payload_digest, null: false
      t.timestamps
    end

    add_index :imported_decision_records, [ :installation_id, :client_id ], unique: true
    add_index :imported_decision_records, :created_at
  end
end
