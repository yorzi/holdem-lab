# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  :records, :payload, :payload_digest, :installation_id, :client_id, :seed,
  :userReason, :user_reason, :snapshot, :resultState, :result_state, :feedback,
  :actionHistory, :action_history, :opponentActions, :opponent_actions, :heroHoleCards,
  :hero_hole_cards, :publicCards, :public_cards
]
