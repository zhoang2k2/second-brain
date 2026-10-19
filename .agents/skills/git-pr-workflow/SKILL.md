---
name: git-pr-workflow
description: Use when staging or committing changes, checking out branches, or generating GitHub Pull Request titles, descriptions, and gh commands in this repository.
---

# Git & PR Workflow Standard

Apply this repository standard to branch management, commit messages, and PR generation. Follow the user's existing authorization and scope; generating a PR command does not authorize executing a push, opening a PR, or merging it.

## Branch inspection and checkout

When asked to stage or commit changes:

1. Inspect the active branch and working tree with `git branch --show-current`, `git status --short`, and `git diff --stat`.
2. Never commit directly to `main`, `master`, `dev`, or `develop`. For feature work, use the approved development branch and the existing milestone ancestry rules.
3. If the active branch is `develop` and no branch has already been selected by the user:
   - Analyze modified and untracked files.
   - Propose exactly three relevant branch names using these conventions:
     - `fix/<short-slug>`
     - `feature/<short-slug>` or `task/<short-slug>`
     - `enhance/<short-slug>` or `refactor/<short-slug>`
   - Return only the candidate branch names, planned commit message, and a request to select a branch.
   - Do not generate a PR title or description at this stage.
   - After selection, create/check out the chosen branch and perform the authorized commit.
4. On an existing feature/task/fix branch, proceed with the requested staging and commit. Stage only in-scope files; preserve unrelated and untracked user files.
5. After a successful commit, provide the commit confirmation and generated PR title and description.

An explicit branch selection or autonomous branch authorization already given by the user takes precedence over asking again. Keep the repository's existing restrictions on push, deployment, and protected-branch merges.

## Commit messages

Use imperative English with a bracketed type:

```text
[TYPE] Short descriptive summary
```

| Type         | Use                                                                   |
| ------------ | --------------------------------------------------------------------- |
| `[TASK]`     | General tasks, content sync, multi-part tasks, routine updates        |
| `[FIX]`      | Bug fixes, layout clipping, typos, error handling                     |
| `[FEATURE]`  | New features, components, modals, user capabilities                   |
| `[ENHANCE]`  | Improvements to UX, animations, performance, accessibility            |
| `[REFACTOR]` | Restructuring, modularization, deduplication without behavior changes |
| `[CHORE]`    | Build scripts, dependencies, configuration, lint/formatting           |
| `[DOCS]`     | Documentation, specifications, README changes                         |

Examples:

```text
[FIX] Resolve Japanese hero heading clipping and add useCurrentLocale hook
[TASK] Sync homepage and common content from CSV data
[FEATURE] Implement rate limit cooldown modal for contact form
[REFACTOR] Extract locale helper utilities and custom hook
```

Do not rewrite existing commit history merely to apply this standard.

## PR titles and descriptions

When asked to generate a PR title or description:

- Inspect the actual diff against the target branch and the relevant validation evidence.
- Write concise English Markdown without emojis.
- Use an imperative title: `[TYPE] Short summary` or `type(scope): short summary`.
- Use bullet points and concise listings rather than long prose.
- Include `## Summary`, `## Changes`, `## How to Test`, and `## Verification`.
- `## Summary` contains one to three bullets describing the objective and context.
- `## Changes` groups concrete technical changes by component or feature area.
- `## Evidence` is optional. Include it only when relevant screenshots, recordings, or observed output are available. Do not invent evidence or leave empty placeholders in a finished PR.
- `## How to Test` provides numbered reproduction and verification instructions.
- `## Verification` records the checks actually run and their outcomes. Distinguish prior checks, checks run for the current change, unavailable tests, and unverified external/provider acceptance.

For multiline `gh pr create` descriptions, write the exact Markdown to a body file and use `--body-file`. Select the explicit base and head branches. A command for the user to run must not be executed unless the session authorizes that external action.

## PR template

```markdown
## Summary

- Brief objective and context.

## Changes

### Component or feature area

- Concrete code, data, configuration, or documentation change.

## Evidence

- Relevant screenshot, recording, or observed output, when available.

## How to Test

1. Start the application and navigate to the relevant route.
2. Verify the expected behavior and relevant failure state.

## Verification

- Record each executed check and its actual result.
```
