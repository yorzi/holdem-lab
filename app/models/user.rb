class User < ApplicationRecord
  has_secure_password reset_token: { expires_in: 1.hour }
  has_many :sessions, dependent: :destroy
  has_many :imported_decision_records, dependent: :destroy

  normalizes :email_address, with: ->(email) { email.strip.downcase }
  normalizes :display_name, with: ->(name) { name.strip }

  validates :email_address, presence: true, uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 12 }, allow_nil: true
  validates :display_name, length: { maximum: 120 }, allow_blank: true
end
