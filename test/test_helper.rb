ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Vite's test manifest and the Rails application config are process-global.
    # Keep the Rails suite deterministic until the test asset build is isolated
    # from parallel workers; the current suite completes in about one second.
    parallelize(workers: 1)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end
