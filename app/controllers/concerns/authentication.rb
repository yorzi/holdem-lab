module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
    helper_method :authenticated?, :current_user
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def authenticated?
    resume_session
  end

  def current_user
    resume_session
    Current.user
  end

  def require_authentication
    resume_session || request_authentication
  end

  def resume_session
    Current.session ||= find_session_by_cookie
  end

  def find_session_by_cookie
    Session.find_by(id: cookies.signed[:session_id]) if cookies.signed[:session_id]
  end

  def request_authentication
    session[:return_to_after_authenticating] = request.fullpath
    redirect_to new_session_path
  end

  def after_authentication_path
    session.delete(:return_to_after_authenticating).presence || root_path
  end

  def start_new_session_for(user)
    return_to = session.delete(:return_to_after_authenticating)
    reset_session
    session[:return_to_after_authenticating] = return_to if return_to.present?

    user.sessions.create!(
      user_agent: (request.user_agent.presence || "unknown").truncate(Session::USER_AGENT_LIMIT),
      ip_address: (request.remote_ip.to_s.presence || "unknown").truncate(Session::IP_ADDRESS_LIMIT)
    ).tap do |new_session|
      Current.session = new_session
      cookies.signed.permanent[:session_id] = {
        value: new_session.id,
        httponly: true,
        same_site: :lax,
        secure: Rails.env.production?
      }
    end
  end

  def terminate_session
    Current.session&.destroy
    Current.reset
    reset_session
    cookies.delete(:session_id)
  end
end
