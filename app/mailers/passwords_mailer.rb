class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    mail subject: "Reset your Holdem Lab password", to: user.email_address
  end
end
