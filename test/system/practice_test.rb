require "application_system_test_case"

class PracticeTest < ApplicationSystemTestCase
  private

  def assert_accessible_controls
    audit = page.evaluate_script(<<~JS)
      (() => {
        const isVisible = (node) => {
          const style = window.getComputedStyle(node)
          return !node.closest('[hidden]') && style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0
        }
        const text = (node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()
        const accessibleName = (node) => {
          const ariaLabel = node.getAttribute('aria-label')
          if (ariaLabel) return ariaLabel.trim()
          const labelledBy = node.getAttribute('aria-labelledby')
          if (labelledBy) return labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim()
          if (node.id) {
            const label = Array.from(document.querySelectorAll('label')).find((candidate) => candidate.htmlFor === node.id)
            if (label) return text(label)
          }
          const parentLabel = node.closest('label')
          return parentLabel ? text(parentLabel) : text(node) || node.getAttribute('title') || node.getAttribute('value') || ''
        }
        const controls = Array.from(document.querySelectorAll('button, input, select, textarea, summary, [role="tab"]')).filter(isVisible)
        const problems = controls.flatMap((node) => {
          const result = []
          if (!accessibleName(node)) result.push(`${node.tagName}#${node.id || '(no-id)'} has no accessible name`)
          if (!node.disabled) {
            const isInactiveRovingTab = node.matches('[role="tab"]') && node.getAttribute('aria-selected') !== 'true'
            if (isInactiveRovingTab ? node.tabIndex !== -1 : node.tabIndex < 0) result.push(`${node.tagName}#${node.id || '(no-id)'} is not keyboard reachable`)
          }
          const controlsId = node.getAttribute('aria-controls')
          if (controlsId && !document.getElementById(controlsId)) result.push(`${node.id || node.tagName} controls missing #${controlsId}`)
          if (node.matches('[role="tab"][aria-selected="true"]')) {
            const panel = document.getElementById(node.getAttribute('aria-controls'))
            if (!panel || panel.hidden || panel.getAttribute('aria-labelledby') !== node.id) result.push(`${node.id} has an invalid active tabpanel relation`)
          }
          return result
        })
        return { count: controls.length, problems }
      })()
    JS

    assert_operator audit.fetch("count"), :>, 0
    assert_empty audit.fetch("problems"), audit.inspect
  end

  public

  test "visitor can load the trainer and submit a reasoned decision" do
    visit practice_path
    page.execute_script(<<~JS)
      window.__hmTelemetryEvents = []
      window.addEventListener('holdem:telemetry', (event) => window.__hmTelemetryEvents.push(event.detail))
    JS

    assert_text "Practice the decision"
    assert_text "Make one decision at a time."
    assert_text "Virtual chips only."

    check "Add a reasoning note"
    fill_in "Why this action?", with: "There is no immediate price, so I keep the range protected."
    click_on "Check"

    decision_events = page.evaluate_script("window.__hmTelemetryEvents")
    assert_equal [ "decision_locked" ], decision_events.map { |event| event.fetch("name") }
    assert_equal %w[mode name schemaVersion street], decision_events.last.keys.sort

    assert_text "Transparent approximation"
    assert_text "Not provided"
    assert_selector "[data-testid='strategy-feedback'][role='status'][aria-live='polite']"

    click_on "Review Queue"

    review_events = page.evaluate_script("window.__hmTelemetryEvents")
    assert_equal [ "decision_locked", "review_open" ], review_events.map { |event| event.fetch("name") }
    assert_equal %w[name schemaVersion], review_events.last.keys.sort

    assert_selector "[data-testid='review-queue']"
    assert_text "Review the decision, not just the result."
    assert_text "There is no immediate price, so I keep the range protected."
    click_on "Replay this hand"
    assert_selector "[data-testid='replay-verified'][role='status']"
    assert_text "The replay matched your saved hand."
    find("summary", text: "Show assumptions and the hand history").click
    assert_text "hero · check"

    click_on "Drill Library"

    assert_selector "[data-testid='drill-library']"
    assert_text "Read the cards without hesitating."
    assert_selector "[role='tablist'][aria-label='Card-recognition drills']"
    assert_selector "[role='tabpanel'][aria-labelledby='drill-tab-cardNotation']:not([hidden])"
    assert_text "Read a starting hand precisely."
    click_on "Best five"
    assert_selector "[role='tabpanel'][aria-labelledby='drill-tab-bestFive']:not([hidden])"
    assert_text "Choose the best five-card hand."

    click_on "Quiz / Random Spot"
    assert_text "Answer the spot"
  end

  test "invalid bet sizing keeps the decision open" do
    visit practice_path

    check "Add a reasoning note"
    fill_in "Why this action?", with: "I am checking the size before committing the action."
    [ "0", "1000", "not-a-number" ].each do |amount|
      fill_in "Raise to (BB)", with: amount
      click_on "Raise"

      assert_text "The target size must be between"
      assert_text "Your action · Preflop"
      assert_no_text "Transparent approximation"
      assert_selector "#trainer-action-error:focus"
    end

    click_on "Fold"

    assert_text "Transparent approximation"
  end

  test "allows a decision without a reason" do
    visit practice_path

    click_on "Fold"

    assert_text "Transparent approximation"

    click_on "Review Queue"

    assert_text "No reason recorded."
  end

  test "can toggle the optional reasoning prompt before acting" do
    visit practice_path

    check "Add a reasoning note"

    assert_selector "#trainer-reason"
    uncheck "Add a reasoning note"

    assert_no_selector "#trainer-reason"
    click_on "Fold"

    assert_text "Transparent approximation"
  end

  test "keeps workspace controls keyboard reachable" do
    visit practice_path

    workspace_nav = find("nav[aria-label='Trainer workspaces']")
    first_workspace = workspace_nav.find_button("Live Practice")
    first_workspace.click
    first_workspace.send_keys(:tab)

    assert_equal "Quiz / Random Spot", page.evaluate_script("document.activeElement?.querySelector('span')?.textContent?.trim()")
  end

  test "supports arrow navigation across drill tabs" do
    visit practice_path
    click_on "Drill Library"

    find("#drill-tab-cardNotation").send_keys(:arrow_right)

    assert_selector "#drill-tab-bestFive[aria-selected='true']"
    assert_equal "drill-tab-bestFive", page.evaluate_script("document.activeElement?.id")
    assert_equal "-1", find("#drill-tab-cardNotation")["tabindex"]

    find("#drill-tab-bestFive").send_keys(:home)

    assert_selector "#drill-tab-cardNotation[aria-selected='true']"
    assert_equal "drill-tab-cardNotation", page.evaluate_script("document.activeElement?.id")
  end

  test "renders only verified card-recognition tabs on the Rails route" do
    visit practice_path
    click_on "Drill Library"

    {
      "Starting-hand notation" => [ "cardNotation", "Read a starting hand precisely." ],
      "Best five" => [ "bestFive", "Choose the best five-card hand." ]
    }.each do |label, (tab_id, heading)|
      find("#drill-tab-#{tab_id}").click
      assert_selector "[role='tabpanel'][aria-labelledby='drill-tab-#{tab_id}']:not([hidden])"
      assert_text heading
    end

    assert_text "naming a starting hand correctly, and spotting the best five-card hand"
    assert_no_text "Approx equity"
  end

  test "restores a saved decision after workspace navigation and refresh" do
    visit practice_path

    check "Add a reasoning note"
    fill_in "Why this action?", with: "I am preserving a disciplined range before reviewing the result."
    click_on "Check"
    click_on "Review Queue"

    assert_text "I am preserving a disciplined range before reviewing the result."

    click_on "Drill Library"
    click_on "Review Queue"
    assert_text "I am preserving a disciplined range before reviewing the result."

    page.refresh

    click_on "Review Queue"
    assert_text "Review the decision, not just the result."
    assert_text "I am preserving a disciplined range before reviewing the result."
  end

  test "imports a deliberate Rails copy and keeps the local review record" do
    visit practice_path
    page.execute_script("window.localStorage.clear()")
    page.refresh

    reason = "I am preserving the local record before choosing to import a Rails copy."
    check "Add a reasoning note"
    fill_in "Why this action?", with: reason
    click_on "Fold"
    click_on "Review Queue"

    assert_selector "[data-testid='review-import']"
    assert_button "Save reviews to my account", disabled: false
    click_on "Save reviews to my account"

    assert_selector "[data-testid='import-status'][role='status']"
    assert_text "Saved to your account."
    assert_text "1 new"
    assert_text "Your originals are still here in this browser."
    assert_text reason

    click_on "Save reviews to my account"

    assert_selector "[data-testid='import-status'][role='status']"
    assert_text "1 already saved"
    assert_text reason
  end

  test "shows an import conflict without deleting the local review" do
    visit practice_path
    page.execute_script("window.localStorage.clear()")
    page.refresh
    page.execute_script("window.localStorage.setItem('holdem-lab:installation-id:v1', 'install-conflict-001')")

    reason = "I am keeping the local review available when the Rails copy conflicts."
    check "Add a reasoning note"
    fill_in "Why this action?", with: reason
    click_on "Fold"
    click_on "Review Queue"

    local_progress = JSON.parse(page.evaluate_script("window.localStorage.getItem('holdem-lab:progress:v2')"))
    local_record = local_progress.fetch("records").first
    server_payload = JSON.generate(local_record.merge("userReason" => "existing server content"))
    ImportedDecisionRecord.create!(
      installation_id: "install-conflict-001",
      client_id: local_record.fetch("id"),
      progress_version: "holdem-progress-v2",
      record_version: 2,
      payload: server_payload,
      payload_digest: Digest::SHA256.hexdigest(server_payload)
    )

    click_on "Save reviews to my account"

    assert_selector "[data-testid='import-status'][role='alert']"
    assert_text "Could not save: A client record id already exists with different content."
    assert_text "Nothing in this browser changed."
    assert_text reason
  end

  test "keeps the local review when the import request fails" do
    visit practice_path
    page.execute_script("window.localStorage.clear()")
    page.refresh

    reason = "I am keeping this local review while the import connection is unavailable."
    check "Add a reasoning note"
    fill_in "Why this action?", with: reason
    click_on "Fold"
    click_on "Review Queue"
    page.execute_script("window.fetch = () => Promise.reject(new Error('offline test'))")

    click_on "Save reviews to my account"

    assert_selector "[data-testid='import-status'][role='alert']"
    assert_text "Could not save: offline test"
    assert_text "Nothing in this browser changed."
    assert_text reason
  end

  test "preserves legacy progress and explains why it is not loaded" do
    visit practice_path
    page.execute_script("window.localStorage.setItem('holdem-lab:progress:v1', JSON.stringify({ version: 'holdem-progress-v1', records: [{ version: 1, id: 'legacy-review' }] }))")
    page.refresh
    click_on "Review Queue"

    assert_selector "[data-testid='legacy-progress-notice']"
    assert_text "Some older reviews are not shown."
    assert_equal "legacy-review", page.evaluate_script("JSON.parse(window.localStorage.getItem('holdem-lab:progress:v1')).records[0].id")
  end

  test "supports a keyboard decision at the planned responsive widths" do
    [ 390, 768, 1280 ].each do |width|
      page.driver.browser.manage.window.resize_to(width, 900)
      visit practice_path

      check "Add a reasoning note"
      fill_in "Why this action?", with: "I am committing a clear reason before I act."
      find_button("Fold").send_keys(:space)

      assert_text "Transparent approximation"
      assert_equal "strategy-feedback", page.evaluate_script("document.activeElement?.getAttribute('data-testid')")
      assert_operator page.evaluate_script("document.documentElement.scrollWidth"), :<=, page.evaluate_script("window.innerWidth")
    end
  end

  test "honors the reduced motion preference" do
    page.driver.browser.execute_cdp(
      "Emulation.setEmulatedMedia",
      "features" => [ { "name" => "prefers-reduced-motion", "value" => "reduce" } ]
    )
    visit practice_path

    assert page.evaluate_script("window.matchMedia('(prefers-reduced-motion: reduce)').matches")
    transition_duration = page.evaluate_script("parseFloat(getComputedStyle(document.querySelector('button')).transitionDuration)")
    assert_operator transition_duration, :<=, 0.001
  ensure
    page.driver.browser.execute_cdp("Emulation.setEmulatedMedia", "features" => [])
  end

  test "audits accessible names, tab order and tabpanel relations across workspaces" do
    visit practice_path
    assert_accessible_controls

    click_on "Drill Library"
    assert_accessible_controls

    click_on "Review Queue"
    assert_accessible_controls
  end
end
