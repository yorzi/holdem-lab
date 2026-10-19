require "application_system_test_case"

class HomeTest < ApplicationSystemTestCase
  test "visitor can see the evidence-first home and react smoke island" do
    visit root_path

    assert_text "Practice decisions."
    assert_text "React training island ready"
    assert_link "Start a free practice"
  end
end
