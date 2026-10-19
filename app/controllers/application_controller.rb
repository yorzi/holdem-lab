class ApplicationController < ActionController::Base
  include Authentication

  SUPPORTED_LOCALES = %w[en zh].freeze

  # Only allow modern browsers supporting webp images, web push, badges, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  around_action :with_locale
  before_action :prepend_locale_view_path

  helper_method :current_locale, :default_locale?

  def default_url_options
    { locale: default_locale? ? nil : current_locale }
  end

  private

  def with_locale(&action)
    I18n.with_locale(requested_locale, &action)
  end

  def requested_locale
    candidate = params[:locale].presence || I18n.default_locale.to_s
    return candidate.to_sym if SUPPORTED_LOCALES.include?(candidate)

    I18n.default_locale
  end

  def current_locale
    I18n.locale
  end

  def default_locale?
    current_locale == I18n.default_locale
  end

  def prepend_locale_view_path
    localized_path = Rails.root.join("app/views/locales", current_locale.to_s)
    prepend_view_path(localized_path) if localized_path.directory?
  end
end
