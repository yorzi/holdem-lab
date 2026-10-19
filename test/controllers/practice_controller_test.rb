require "test_helper"

class PracticeControllerTest < ActionDispatch::IntegrationTest
  test "practice route renders the trainer loading state" do
    get practice_url

    assert_response :success
    assert_select "h1", /Dealing your practice table/
    assert_select "[data-hm-trainer-mount]"
    assert_select "body", /virtual chips/
  end
end
