---
name: git-pr-workflow
description: Use this skill whenever committing code, checking out branches, or generating Pull Request (PR) titles and descriptions. Enforces branching rules on develop, [TYPE] commit formatting, and concise English Markdown PR templates without emojis.
---

# Git & PR Workflow Standard

This skill defines the repository standard for branch management, commit messages, and Pull Request (PR) generation.

---

## 1. Branch Inspection & Checkout Flow

When receiving a request to commit or stage changes:

1. **Check Current Branch**:
   - Inspect the current active branch (e.g. `git branch --show-current` or `git status`).

2. **If Current Branch is `develop`**:
   - **Do NOT commit directly onto `develop`**.
   - Analyze the current modified and untracked files (`git status --short`, `git diff --stat`).
   - Proactively suggest **3 candidate branch names** following project conventions:
     - `fix/<short-slug>` (e.g., `fix/hero-japanese-title-clipping`)
     - `feature/<short-slug>` or `task/<short-slug>` (e.g., `task/sync-homepage-content`)
     - `enhance/<short-slug>` or `refactor/<short-slug>` (e.g., `refactor/locale-utility-hook`)
   - Present only the proposed branch names and planned commit message.
   - **TOKEN EFFICIENCY RULE**: **Do NOT generate or return the PR Title/Description at this stage**. Wait until the branch is checked out and the commit is successfully completed.
   - Prompt the user to select or confirm the branch name before creating/checking out the branch.
   - Once confirmed, create and checkout the new branch (`git checkout -b <branch-name>`) and execute the commit.

3. **If Current Branch is a Feature/Task/Fix Branch (Not `develop`)**:
   - Proceed directly with staging and committing as requested.
   - After the commit is complete, provide the commit confirmation along with the generated PR Title and Description.

---

## 2. Commit Message Standards

Use the bracketed type format for all commit messages:

```text
[TYPE] Short descriptive summary in imperative mood
```

### Valid Types:
- `[TASK]`: General tasks, content sync, multi-part tasks, or routine updates.
- `[FIX]`: Bug fixes, layout clipping, typo fixes, or error handling.
- `[FEATURE]`: New features, components, modals, or user capabilities.
- `[ENHANCE]`: Improvements to existing UX, animations, performance, or accessibility.
- `[REFACTOR]`: Code restructuring, modularization, or deduplication without behavior changes.
- `[CHORE]`: Build scripts, dependencies, configuration, or lint/formatting updates.
- `[DOCS]`: Documentation, specifications, or README updates.

### Examples:
- `[FIX] Resolve Japanese hero heading clipping and add useCurrentLocale hook`
- `[TASK] Sync homepage and common content from CSV data`
- `[FEATURE] Implement rate limit cooldown modal for contact form`
- `[REFACTOR] Extract locale helper utilities and custom hook`

---

## 3. Pull Request (PR) Generation Rules

When asked to generate a PR Title and Description:

### PR Title Requirements:
- **Language**: English only.
- **Style**: Concise, clear, imperative mood.
- **Format**: `[TYPE] Short summary` or `type(scope): short summary`.
  - Example: `[FIX] Resolve Japanese hero text clipping and update locale hook`

### PR Description Requirements:
- **Language**: English only.
- **No Emojis**: Do not use any emoji characters anywhere in the PR text.
- **Structure**: Use bullet points and concise listings. Avoid long prose.
- **Mandatory Sections**:
  1. `## Summary`: High-level goal and context in 1-3 bullet points.
  2. `## Changes`: Grouped bullet list of concrete technical changes made.
  3. `## Evidence`: (Optional) Screenshots, recordings, or test output placeholders.
  4. `## How to Test`: Step-by-step instructions to reproduce and verify the change locally.
  5. `## Verification`: Automated verification results (`pnpm lint`, `pnpm build`, `pnpm sync:*`).

---

## 4. Standard PR Description Template

```markdown
## Summary

- Brief high-level bullet explaining the objective.
- Additional context or root cause if applicable.

## Changes

### [Component / Feature Area]
- Bullet point describing specific code or data modification.
- Bullet point describing related styling, layout, or translation adjustment.

## Evidence

- Screenshot / Recording: [Add links or describe verified visual behavior]

## How to Test

1. Navigate to `<URL or Route>` (e.g., `http://localhost:3000/ja`).
2. Verify `<Behavior to observe>`.
3. Check `<Secondary condition or language switcher>`.

## Verification

- `pnpm lint` passed with 0 errors.
- `pnpm build` completed successfully.
```
