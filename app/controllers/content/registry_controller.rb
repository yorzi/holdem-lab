module Content
  class RegistryController < ApplicationController
    allow_unauthenticated_access
    before_action :development_or_test_only

    def index
      query = Content::Query.new
      @snapshot = query.snapshot
      @published_lessons = query.published_lessons(locale: :en)
      @readiness_report = Content::PublicationWorkflow.new.readiness_report(locale: :en)
    end

    private

    def development_or_test_only
      head :not_found unless Rails.env.development? || Rails.env.test?
    end
  end
end
