require "test_helper"

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_chrome, screen_size: [ 1280, 720 ]

  setup do
    # Selenium reuses the browser window after responsive tests resize it.
    page.current_window.resize_to(1280, 720)
  end
end
