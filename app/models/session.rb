class Session < ApplicationRecord
  IP_ADDRESS_LIMIT = 255
  USER_AGENT_LIMIT = 512

  belongs_to :user

  validates :ip_address, :user_agent, presence: true
  validates :ip_address, length: { maximum: IP_ADDRESS_LIMIT }
  validates :user_agent, length: { maximum: USER_AGENT_LIMIT }
end
