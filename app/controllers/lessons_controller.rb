class LessonsController < ApplicationController
  allow_unauthenticated_access

  LESSON_SLUGS = {
    "position" => "position",
    "pot_odds" => "pot-odds",
    "decision_quality" => "decision-quality"
  }.freeze

  before_action :load_content

  def position
  end

  def pot_odds
  end

  def decision_quality
  end

  private

  def load_content
    lesson_slug = LESSON_SLUGS.fetch(action_name)
    page = content_runtime.lesson!(slug: lesson_slug, locale: current_locale)
    @content_scope = page.fetch(:scope)
    @curriculum_lesson = page.fetch(:curriculum)
    @content_record = page.fetch(:asset)
    @source_packet = page.fetch(:source_packet)
  rescue Content::Runtime::NotFound
    head :not_found
  end

  def content_runtime
    @content_runtime ||= Content::Runtime.new(scope: Rails.application.config.x.content_runtime_scope)
  end
end
