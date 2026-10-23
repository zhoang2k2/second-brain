# Phase 3 — Personal AI Agent Implementation Plan

**Goal:** Support bounded, observable coding-assistant workflows with explicit permission before tools change files, run commands, or control applications.

**Architecture:** Build on the approved Phase 2 knowledge and permission model. Start with inspect/plan/propose workflows and add execution only behind a qualified isolation boundary and narrowly scoped approvals. A Git worktree alone is not a security boundary.

**Tech stack:** Existing TypeScript application and approved local model/runtime. Tool execution, macOS control, sandbox, and session-observation mechanisms remain open until feasibility and security requirements are approved.

**Source:** `~/Downloads/SECOND_BRAIN_PROJECT_HANDOFF.md`, sections 3.3 and 4.

## BOSS — manual, phase entry gate

- Select the initial workflow and target repositories/apps; define allowed read paths, write paths, commands, network access, and prohibited actions.
- Approve the permission model: which actions can be read-only, which require per-action approval, approval expiry, and how cancellation/revocation works.
- Decide whether session observation is in scope, identify the exact applications, and approve what data may be captured or retained.
- Approve execution limits: time, tool calls, model/provider, token or cost budget, and behavior after a limit is reached.
- Review a sandbox/isolation feasibility report and approve the isolation mechanism before any autonomous command or file write is enabled.
- Explicitly approve the whole phase plan and its acceptance scenarios before implementation begins.

## FE agent

- Build a task/session view that shows the agent's goal, current step, proposed actions, permission request, tool output, cancellation, and final diff/report.
- Provide clear approval controls bound to the exact action and target; show denied, expired, cancelled, and failed states.
- Keep every write or command reviewable; do not make hidden autonomous actions.

## BE agent

- Implement a bounded workflow state machine and tool adapters for only the approved actions.
- Enforce target/path/command/expiry/budget limits server-side for every tool call, regardless of UI state.
- Default to read-only inspection and proposed patches. Require explicit approval for writes, commands, app control, or other side effects as defined by BOSS.
- Record enough structured evidence to explain actions and failures without collecting unapproved secrets or unrelated user data.
- Do not treat a worktree, prompt instruction, retrieved Markdown, or model output as a sandbox or permission grant.

## Shared work and acceptance

- Threat-model prompt injection in repository files, Markdown, tool output, and model responses.
- Verify denied/expired/revoked approval, path escape, disallowed command, budget exhaustion, cancellation, and tool failure all fail closed.
- Verify approved changes are shown as a diff before acceptance and no tool can expand its own permissions.
- Test any macOS computer-use capability separately from normal browser/app UI. If a required sandbox cannot be qualified, keep execution disabled and report the blocker.

**Exit:** Every enabled action is within an owner-approved permission boundary, failure cases fail closed, and BOSS accepts the evidence report.
