class CreateContentCurriculumRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :content_lessons do |t|
      t.string :catalog_id, null: false
      t.integer :catalog_schema_version, null: false
      t.string :lesson_id, null: false
      t.string :slug, null: false
      t.integer :sequence, null: false
      t.string :content_version, null: false
      t.text :asset_ids, null: false
      t.text :source_packet_ids, null: false
      t.text :concept_ids, null: false
      t.text :exercise_ids, null: false
      t.text :source_reference_ids, null: false
      t.string :publication_status, null: false
      t.string :rights_status, null: false
      t.string :technical_review_status, null: false
      t.text :technical_review_evidence, null: false
      t.string :domain_review_status, null: false
      t.string :domain_review_reviewer
      t.string :domain_reviewed_at
      t.timestamps
    end

    add_index :content_lessons, :lesson_id, unique: true
    add_index :content_lessons, [ :catalog_id, :sequence ], unique: true
    add_index :content_lessons, :publication_status

    create_table :content_concepts do |t|
      t.string :catalog_id, null: false
      t.integer :catalog_schema_version, null: false
      t.string :concept_id, null: false
      t.string :lesson_id, null: false
      t.string :slug, null: false
      t.string :difficulty, null: false
      t.text :prerequisite_ids, null: false
      t.text :display, null: false
      t.text :source_reference_ids, null: false
      t.string :publication_status, null: false
      t.string :rights_status, null: false
      t.string :domain_review_status, null: false
      t.string :domain_review_reviewer
      t.string :domain_reviewed_at
      t.timestamps
    end

    add_index :content_concepts, :concept_id, unique: true
    add_index :content_concepts, [ :lesson_id, :slug ], unique: true
    add_index :content_concepts, :publication_status

    create_table :content_exercises do |t|
      t.string :catalog_id, null: false
      t.integer :catalog_schema_version, null: false
      t.string :exercise_id, null: false
      t.string :lesson_id, null: false
      t.string :concept_id, null: false
      t.string :dom_id, null: false
      t.string :exercise_type, null: false
      t.string :answer_contract, null: false
      t.string :answer_code, null: false
      t.string :view_answer_value, null: false
      t.text :source_reference_ids, null: false
      t.string :publication_status, null: false
      t.string :rights_status, null: false
      t.string :technical_review_status, null: false
      t.text :technical_review_evidence, null: false
      t.string :domain_review_status, null: false
      t.string :domain_review_reviewer
      t.string :domain_reviewed_at
      t.timestamps
    end

    add_index :content_exercises, :exercise_id, unique: true
    add_index :content_exercises, [ :lesson_id, :dom_id ], unique: true
    add_index :content_exercises, :concept_id
    add_index :content_exercises, :publication_status

    create_table :content_source_references do |t|
      t.string :catalog_id, null: false
      t.integer :catalog_schema_version, null: false
      t.string :source_reference_id, null: false
      t.string :kind, null: false
      t.string :source_packet_id, null: false
      t.string :claim_id, null: false
      t.text :source_ids, null: false
      t.string :publication_status, null: false
      t.string :rights_status, null: false
      t.string :domain_review_status, null: false
      t.string :domain_review_reviewer
      t.string :domain_reviewed_at
      t.timestamps
    end

    add_index :content_source_references, :source_reference_id, unique: true
    add_index :content_source_references, [ :source_packet_id, :claim_id ], unique: true
    add_index :content_source_references, :publication_status
  end
end
