require "json"

module Settings
  class ProfilesController < ApplicationController
    def show
      @user = current_user
    end

    def update
      @user = current_user
      if @user.update(profile_params)
        redirect_to profile_settings_path, notice: t("profile.saved")
      else
        flash.now[:alert] = @user.errors.full_messages.to_sentence
        render :show, status: :unprocessable_entity
      end
    end

    def export
      filename = "holdem-lab-account-export-#{Time.current.to_date.iso8601}.json"
      response.headers["X-Holdem-Export-Format"] = AccountDataExport::FORMAT_VERSION
      send_data JSON.pretty_generate(AccountDataExport.new(current_user).call),
        filename:,
        type: "application/json",
        disposition: "attachment"
    end

    def destroy
      Accounts::Deletion.call(
        user: current_user,
        password: params[:current_password],
        confirmation: params[:confirmation]
      )
      terminate_session
      redirect_to root_path, status: :see_other, notice: t("profile.account_deleted")
    rescue Accounts::Deletion::ConfirmationError
      @user = current_user
      flash.now[:alert] = t("profile.account_delete_failed")
      render :show, status: :unprocessable_entity
    end

    private

    def profile_params
      params.fetch(:user, {}).permit(:display_name)
    end
  end
end
