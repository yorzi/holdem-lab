# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_21_153000) do
  create_table "content_assets", force: :cascade do |t|
    t.string "asset_digest", null: false
    t.string "asset_id", null: false
    t.string "content_mode", null: false
    t.string "content_version", null: false
    t.datetime "created_at", null: false
    t.string "domain_review_reviewer"
    t.string "domain_review_status", null: false
    t.string "domain_reviewed_at"
    t.string "kind", null: false
    t.string "locale", null: false
    t.string "manifest_id", null: false
    t.integer "manifest_schema_version", null: false
    t.string "publication_status", null: false
    t.text "rights_notes", null: false
    t.string "rights_status", null: false
    t.string "route_path", null: false
    t.string "slug", null: false
    t.text "source_packet_ids", null: false
    t.text "technical_review_evidence", null: false
    t.string "technical_review_status", null: false
    t.datetime "updated_at", null: false
    t.string "view_path", null: false
    t.index ["asset_id"], name: "index_content_assets_on_asset_id", unique: true
    t.index ["publication_status"], name: "index_content_assets_on_publication_status"
    t.index ["slug", "locale"], name: "index_content_assets_on_slug_and_locale", unique: true
  end

  create_table "content_concepts", force: :cascade do |t|
    t.string "catalog_id", null: false
    t.integer "catalog_schema_version", null: false
    t.string "concept_id", null: false
    t.datetime "created_at", null: false
    t.string "difficulty", null: false
    t.text "display", null: false
    t.string "domain_review_reviewer"
    t.string "domain_review_status", null: false
    t.string "domain_reviewed_at"
    t.string "lesson_id", null: false
    t.text "prerequisite_ids", null: false
    t.string "publication_status", null: false
    t.string "rights_status", null: false
    t.string "slug", null: false
    t.text "source_reference_ids", null: false
    t.datetime "updated_at", null: false
    t.index ["concept_id"], name: "index_content_concepts_on_concept_id", unique: true
    t.index ["lesson_id", "slug"], name: "index_content_concepts_on_lesson_id_and_slug", unique: true
    t.index ["publication_status"], name: "index_content_concepts_on_publication_status"
  end

  create_table "content_exercises", force: :cascade do |t|
    t.string "answer_code", null: false
    t.string "answer_contract", null: false
    t.string "canonical_registry_digest", default: "", null: false
    t.string "canonical_registry_id", default: "", null: false
    t.string "canonical_template_id", default: "", null: false
    t.string "catalog_id", null: false
    t.integer "catalog_schema_version", null: false
    t.string "concept_id", null: false
    t.datetime "created_at", null: false
    t.string "dom_id", null: false
    t.string "domain_review_reviewer"
    t.string "domain_review_status", null: false
    t.string "domain_reviewed_at"
    t.string "exercise_id", null: false
    t.string "exercise_type", null: false
    t.string "lesson_id", null: false
    t.string "publication_status", null: false
    t.string "rights_status", null: false
    t.text "source_reference_ids", null: false
    t.text "technical_review_evidence", null: false
    t.string "technical_review_status", null: false
    t.datetime "updated_at", null: false
    t.string "view_answer_value", null: false
    t.index ["canonical_template_id"], name: "index_content_exercises_on_canonical_template_id"
    t.index ["concept_id"], name: "index_content_exercises_on_concept_id"
    t.index ["exercise_id"], name: "index_content_exercises_on_exercise_id", unique: true
    t.index ["lesson_id", "dom_id"], name: "index_content_exercises_on_lesson_id_and_dom_id", unique: true
    t.index ["publication_status"], name: "index_content_exercises_on_publication_status"
  end

  create_table "content_lessons", force: :cascade do |t|
    t.text "asset_ids", null: false
    t.string "catalog_id", null: false
    t.integer "catalog_schema_version", null: false
    t.text "concept_ids", null: false
    t.string "content_version", null: false
    t.datetime "created_at", null: false
    t.string "domain_review_reviewer"
    t.string "domain_review_status", null: false
    t.string "domain_reviewed_at"
    t.text "exercise_ids", null: false
    t.string "lesson_id", null: false
    t.string "publication_status", null: false
    t.string "rights_status", null: false
    t.integer "sequence", null: false
    t.string "slug", null: false
    t.text "source_packet_ids", null: false
    t.text "source_reference_ids", null: false
    t.text "technical_review_evidence", null: false
    t.string "technical_review_status", null: false
    t.datetime "updated_at", null: false
    t.index ["catalog_id", "sequence"], name: "index_content_lessons_on_catalog_id_and_sequence", unique: true
    t.index ["lesson_id"], name: "index_content_lessons_on_lesson_id", unique: true
    t.index ["publication_status"], name: "index_content_lessons_on_publication_status"
  end

  create_table "content_registry_snapshots", force: :cascade do |t|
    t.string "contract_id", null: false
    t.integer "contract_schema_version", null: false
    t.datetime "created_at", null: false
    t.string "layer", null: false
    t.string "path", null: false
    t.integer "record_count", null: false
    t.string "registry_digest", null: false
    t.string "registry_id", null: false
    t.integer "registry_schema_version", null: false
    t.datetime "retired_at"
    t.string "runtime_status", null: false
    t.string "status", default: "active", null: false
    t.text "status_summary", null: false
    t.datetime "updated_at", null: false
    t.index ["contract_id", "layer"], name: "index_content_registry_snapshots_on_contract_id_and_layer", unique: true
    t.index ["registry_digest"], name: "index_content_registry_snapshots_on_registry_digest"
    t.index ["status"], name: "index_content_registry_snapshots_on_status"
  end

  create_table "content_source_references", force: :cascade do |t|
    t.string "canonical_registry_digest", default: "", null: false
    t.string "canonical_registry_id", default: "", null: false
    t.string "catalog_id", null: false
    t.integer "catalog_schema_version", null: false
    t.string "claim_id", null: false
    t.datetime "created_at", null: false
    t.string "domain_review_reviewer"
    t.string "domain_review_status", null: false
    t.string "domain_reviewed_at"
    t.string "integrity_status", default: "", null: false
    t.string "kind", null: false
    t.string "publication_status", null: false
    t.string "rights_status", null: false
    t.text "source_ids", null: false
    t.string "source_packet_id", null: false
    t.string "source_reference_id", null: false
    t.text "technical_review_evidence", default: "[]", null: false
    t.string "technical_review_status", default: "", null: false
    t.datetime "updated_at", null: false
    t.index ["canonical_registry_digest"], name: "index_content_source_references_on_canonical_registry_digest"
    t.index ["publication_status"], name: "index_content_source_references_on_publication_status"
    t.index ["source_packet_id", "claim_id"], name: "idx_on_source_packet_id_claim_id_dfc91cdd6b", unique: true
    t.index ["source_reference_id"], name: "index_content_source_references_on_source_reference_id", unique: true
  end

  create_table "imported_decision_records", force: :cascade do |t|
    t.string "client_id", null: false
    t.datetime "created_at", null: false
    t.string "installation_id", null: false
    t.text "payload", null: false
    t.string "payload_digest", null: false
    t.string "progress_version", null: false
    t.integer "record_version", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.index ["created_at"], name: "index_imported_decision_records_on_created_at"
    t.index ["installation_id", "client_id"], name: "idx_on_installation_id_client_id_469a54f3c5", unique: true
    t.index ["user_id", "created_at"], name: "index_imported_decision_records_on_user_id_and_created_at"
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "ip_address", null: false
    t.datetime "updated_at", null: false
    t.string "user_agent", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "display_name"
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "imported_decision_records", "users"
  add_foreign_key "sessions", "users"
end
