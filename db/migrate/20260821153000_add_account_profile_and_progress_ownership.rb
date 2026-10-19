class AddAccountProfileAndProgressOwnership < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :display_name, :string

    add_reference :imported_decision_records, :user, foreign_key: true, index: false
    add_index :imported_decision_records, [ :user_id, :created_at ]
  end
end
