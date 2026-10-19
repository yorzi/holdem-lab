# Run using bin/ci

CI.run do
  step "Setup", "bin/setup --skip-server"

  step "Style: Ruby", "bin/rubocop --cache-root tmp/rubocop --no-parallel"

  step "Security: Gem audit", "bin/bundler-audit"
  step "Security: npm audit", "npm audit --audit-level=high"
  step "Security: Brakeman code analysis", "bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error"
  step "Tests: Rails", "bin/rails test"
  step "Tests: System", "bin/rails test:system"
  step "Tests: Frontend", "npm test"
  step "Typecheck: Frontend", "npm run typecheck"
  step "Validate: Frontend boundaries", "npm run validate:frontend-boundaries"
  step "Build: Frontend", "npm run build"
  step "Validate: Research registry", "npm run validate:research"
  step "Validate: Quality packets", "npm run validate:quality"
  step "Validate: Content manifest", "npm run validate:content"
  step "Validate: Content catalog", "npm run validate:catalog"
  step "Validate: Canonical data contract", "npm run validate:canonical"
  step "Validate: Content mirror", "bin/rails content:import && bin/rails content:verify"
  step "Report: Content readiness", "bin/rails content:readiness"

  # Optional: Run system tests
  # step "Tests: System", "bin/rails test:system"

  # Optional: set a green GitHub commit status to unblock PR merge.
  # Requires the `gh` CLI and `gh extension install basecamp/gh-signoff`.
  # if success?
  #   step "Signoff: All systems go. Ready for merge and deploy.", "gh signoff"
  # else
  #   failure "Signoff: CI failed. Do not merge or deploy.", "Fix the issues and try again."
  # end
end
