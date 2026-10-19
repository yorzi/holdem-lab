class AddCanonicalRecordBindings < ActiveRecord::Migration[8.1]
  def change
    add_column :content_exercises, :canonical_template_id, :string, null: false, default: ""
    add_column :content_exercises, :canonical_registry_id, :string, null: false, default: ""
    add_column :content_exercises, :canonical_registry_digest, :string, null: false, default: ""
    add_index :content_exercises, :canonical_template_id

    add_column :content_source_references, :integrity_status, :string, null: false, default: ""
    add_column :content_source_references, :technical_review_status, :string, null: false, default: ""
    add_column :content_source_references, :technical_review_evidence, :text, null: false, default: "[]"
    add_column :content_source_references, :canonical_registry_id, :string, null: false, default: ""
    add_column :content_source_references, :canonical_registry_digest, :string, null: false, default: ""
    add_index :content_source_references, :canonical_registry_digest
  end
end
