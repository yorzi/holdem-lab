module Accounts
  class Deletion
    CONFIRMATION_TOKEN = "DELETE"
    ConfirmationError = Class.new(StandardError)

    def self.call(user:, password:, confirmation:)
      new(user:, password:, confirmation:).call
    end

    def initialize(user:, password:, confirmation:)
      @user = user
      @password = password.to_s
      @confirmation = confirmation.to_s
    end

    def call
      verify_confirmation!

      User.transaction do
        @user.destroy!
      end
    end

    private

    def verify_confirmation!
      return if @confirmation == CONFIRMATION_TOKEN && @user.authenticate(@password)

      raise ConfirmationError
    end
  end
end
