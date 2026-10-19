class LearnController < ApplicationController
  allow_unauthenticated_access

  def index
    pages = content_runtime.lessons(locale: current_locale)
    return head :not_found if pages.empty?

    @content_scope = content_runtime.scope
    @content_records = pages.index_by { |page| page.fetch(:asset).fetch("slug") }
      .transform_values { |page| page.fetch(:asset) }
    @curriculum_lessons = pages.index_by { |page| page.fetch(:curriculum).fetch("slug") }
      .transform_values { |page| page.fetch(:curriculum) }
  end

  private

  def content_runtime
    @content_runtime ||= Content::Runtime.new(scope: Rails.application.config.x.content_runtime_scope)
  end
end
