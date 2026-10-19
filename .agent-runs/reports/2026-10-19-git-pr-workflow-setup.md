# Git and PR workflow skill setup

- Status: Skill installed for this repository at `.agents/skills/git-pr-workflow/SKILL.md`.
- Branch: `feature/m1`; reviewed starting commit `b0d3fbc`.
- Scope: Apply the supplied branch/commit rules and concise English PR template; preserve existing protected-branch and external-action restrictions.
- Observed baseline: The previous generated PR command used an unbracketed title and a one-paragraph body without the required sections. The new skill supplies the required types, sections, and body-file workflow.
- Review cases: On `develop` without an approved branch, propose three names and a planned commit before PR generation. With an existing approved feature branch, use the authorized commit flow. For a PR-only request, generate content without executing a push/PR/merge. Existing user authorization takes precedence over repeated confirmation.
- Validation: `quick_validate.py` passed (frontmatter/name); Markdown formatting passed. The system Python lacked PyYAML, so the validator ran in an isolated temporary virtual environment with PyYAML installed. No application dependency changed. Whitespace checks and application of the template to the current M1 diff complete the review. No independent behavioral evaluation was performed; no application code changed, so application checks are not repeated for this documentation task.
- PR artifact: A local ignored Markdown body under `doc/reports/` will accompany the gh command after the skill commit.
- Next action: BOSS runs the provided push and gh commands when ready; no push, PR creation, or merge is performed by this task.
