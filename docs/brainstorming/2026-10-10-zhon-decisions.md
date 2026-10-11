# Zhon brainstorming checkpoint

Updated: 2026-10-10, Asia/Ho_Chi_Minh.

Status: confirmed requirements and historical brainstorming notes. BOSS approved the written design for detailed planning on 2026-10-10; P0–P7 and S1 plans now exist in docs/superpowers/plans/. Plan review and execution-method selection remain pending. No product implementation or live integration acceptance has been completed.

## Intent

- Product: `zhon - Personal AI Engineering Orchestrator`.
- One human user, addressed as BOSS.
- A personal second brain and a control plane for existing AI engines.
- Knowledge includes engineering and personal subjects. Do not restrict it to project lessons.
- Continuous learning means maintaining knowledge and experience, not training model weights.
- Preserve knowledge and workflow records independently of any one engine. When no engine is available, reading and searching knowledge must remain useful.
- Delivery priority is second-brain-first: useful chat, vault retrieval, candidate review, and Active knowledge precede coding orchestration. Native sandbox feasibility can be an independent workstream and must pass before coding execution is enabled.

## MVP environment and engine scope

- Run on the user's current laptop as a local web application.
- The user manually manages Git synchronization.
- Support both CLI-backed and model-API-backed workflows in the same UI.
- MVP CLI integrations: Codex and Antigravity.
- The user reports using both engines through CLI and IDE. MVP orchestration is proposed through managed CLI sessions; IDE GUI automation has not been requested.
- Codex uses the user's ChatGPT Plus subscription. Do not assume an OpenAI API key or API credits exist.
- First model API integration: Gemini Developer API through Google AI Studio, with billing enabled.
- Claude Code and local model execution are deferred to later phases.
- Account availability is user-reported. Installed engine versions, authentication health, and adapter capabilities have not been verified.

## Conversations and UI

- Multiple independent chats, each with its own history and context.
- Support project chats and global/personal chats.
- Chat is the command and conversation interface.
- Chat input and response presentation should follow the familiar Claude/ChatGPT chatbox experience.
- Do not crowd every capability into one viewport. Navigation and separate views/panels must organize chat, provider/agent status, context, terminals, and knowledge by purpose. The precise layout is not selected yet.
- Provide a list of status cards for configured providers/agents showing available limits and token metrics. Distinguish context usage, API token consumption, and subscription allowances; unavailable metrics remain explicitly unknown.
- Provide a context view to inspect and manage conversation context, including preserving important information through long-conversation summarization. Detailed controls and compaction semantics remain to be designed.
- Include Obsidian-compatible knowledge views and UI for personal second-brain workflows, alongside terminal and execution views. This does not authorize an in-app Markdown editor or require embedding the Obsidian application.
- Knowledge UI has three status columns: Active, Candidate, and Deactive. Each column contains accordion items, with search and distinct status colors. Storage state naming may use Deactivated; the requested UI label is Deactive.
- Latest layout direction refines option B: a 300px left sidebar; a flexible center with chat above (>50% viewport height) and provider/agent status cards below in a bento layout; a narrow right conversation-history rail grouped by day, with DD/MM/YYYY date tooltips on hover.
- Interpret the center as the available width after sidebar and history rail for the next wireframe. Literal 80% of total viewport width plus a fixed 300px sidebar and rail can exceed the viewport; exact responsive sizing awaits layout review.
- Terminal is an in-page, full-width panel sliding up from the bottom, toggled by a footer icon. Remove Terminals as a separate sidebar page in the next layout.
- Minimize subtitles, helper descriptions, badges, redundant page titles, and excessive icon usage. Navigation and the feature content should supply sufficient context.
- BOSS requested clearer sidebar hierarchy and reconsideration of controls such as theme buttons. Latest proposal separates primary navigation, collapsible conversation scope groups (Personal; Projects -> project -> chats), and bottom utilities/account. Avoid styling every level as equally prominent buttons.
- Latest theme control is an explicit Light/Dark segmented control with visible selected state, placed with bottom utilities instead of an ambiguous icon-only toggle beside the wordmark. It is part of the provisionally accepted UI v5 baseline.
- BOSS accepted the general sidebar hierarchy and requested further refinements: sidebar 280px; Hugeicons on Chats/Knowledge; remove native arrow disclosure markers; PERSONAL/PROJECTS labels use the same 14px size and uppercase; all chat items have neutral default row styling with a left indicator, with color reserved for selection.
- Remove BOSS/Local sidebar text. Footer occupies the body only, after the sidebar. Managed terminal follows that boundary and supports Single and Split views in the preview; broader IDE-like layouts are still to be specified.
- Chat/composer and statusline rows share a maximum content width; status cards always use equal-width grid columns. Context is a bento card below statuslines, with Manage opening detailed controls.
- Latest wireframe interprets max-height 75vh as a cap on the statusline section, not a requirement to fill that height. Confirm this interpretation if subsequent feedback differs.
- Animate sidebar and knowledge expand/collapse, view appearance, drawers, dialog appearance/closing, terminal layouts, hover and theme state changes; honor reduced-motion preference. No animation library has been installed.
- Latest statusline presentation: provider/agent name, 5h and 1w usage progress bars, and next reset time. Detailed token/worker/budget metrics are removed from these cards; backend accounting requirements remain. Never infer that every provider exposes these windows or manufacture unavailable metrics.
- Give Chat, Statuslines, and Context distinct rounded sections inside a rounded workspace container. Hide scrollbars while retaining scrolling; do not compress every section to force it into a short viewport.
- Clicking any history tick jumps to the first message in that conversation for the indicated day. Use chronological message/date associations, not a hard-coded arbitrary message target. The preview demonstrates 09/10/2026 and 10/10/2026.
- Multiple interactive terminal sessions are required: live output, input, responses to CLI prompts, and commands within granted scope.
- Show which task, role, engine, and worktree a managed session belongs to.
- Provide agent activity, phase progress, blockers, approvals, and readable responses.
- A terminal is a managed execution surface. Its input must not bypass execution policy.
- BOSS authors and edits knowledge in Obsidian. MVP zhon needs search, reading, and candidate review, not a knowledge Markdown editor.

## Approval and scheduling

- Approve the execution plan of an entire phase before execution.
- The plan exposes work units, dependencies, roles, engines, models, supported effort settings, budget, permissions, and acceptance criteria.
- Workers may act within that approved scope while BOSS is away.
- New scope, role/model changes outside the approved configuration, or other plan changes require a new applicable approval.
- Approvals are bound to the specific action/target and valid plan/baseline. Expired or invalid approvals cannot authorize new actions.
- Exact expiration defaults and revocation behavior still need design.
- MVP executes one phase at a time globally.
- Independent work units within that phase may run concurrently; dependent units follow dependency order.
- Two concurrent workers is a proposed starting default, not a confirmed or benchmarked capacity.
- Roles include coder, reviewer, tester, and BA. Do not require every role for every trivial operation without a reason.
- Reviewer may use the same engine/model as coder, but must be a separate worker/session with its own review context. Different engines/models are optional choices in the approved phase plan.
- Coder owns implementation and its appropriate unit tests. Tester independently assesses cases/coverage and verifies results, reporting gaps or failures for BOSS to decide. Running approved test/build commands is a deterministic validation job and does not inherently require a model.

## Failures and recovery

- Test/review failure: preserve findings, logs, results, and changes; wait for BOSS. No automatic repair loop.
- Stop the affected work unit and its dependent branch. Already-approved independent work may continue.
- A phase with unresolved required acceptance criteria is not Done.
- Reviewer failure cannot result in successful completion.
- After runtime crash/restart, reconcile records, processes, and workspaces; wait for BOSS before continuing or retrying execution.
- Missing completion evidence does not prove a side-effecting command never ran.
- Preserve earlier attempts when retrying; do not silently overwrite failure history.
- Specific handling for security violations, cancellation, unknown charges, and conflicting integration outputs remains to be designed.

## Repository execution and handoff

- One repository may be modified by each execution phase.
- Require a clean source baseline before starting. Dirty source is a blocker for BOSS to resolve.
- Record the target repository, branch, and approved baseline revision.
- Use isolated worktrees for worker execution and an integration workspace for combining results.
- No automatic commits. A commit requires an explicit BOSS request.
- Push is forbidden for zhon and workers. BOSS performs it outside zhon.
- No protected-branch merge in MVP.
- Permit fetch from the registered remote before execution and before applying results. This does not authorize pull, merge, or push.
- Fetch failure or unmet upstream requirements is a blocker.
- Automatically apply validated results to the working repository only if it is clean, on the correct branch, still matches the approved baseline, meets the upstream policy, and has no conflicting changes.
- Otherwise retain integration results and report the blocker.
- Exact upstream rules, including local-ahead branches and missing upstreams, remain to be defined.
- After application, changes remain available for BOSS to review and manually commit/push. A subsequent phase still requires a clean baseline.

## Sandbox and credentials

- Prefer proving native macOS sandbox enforcement first.
- Git worktrees isolate Git working state; they do not themselves enforce a security boundary.
- Put sandbox feasibility and qualification early in Foundation, before unattended execution is accepted. Do not postpone baseline enforcement to final hardening.
- Qualify each required engine and interactive terminal against the required filesystem, process, network, and command policy.
- If native enforcement cannot meet policy, report a blocker and revisit the approach. Prompt instructions are not enforcement.
- Sandbox probes use synthetic fixtures and fake credentials, not real secrets.
- Worker access to credentials is denied. Project env access is limited to `env.example`.
- Trusted runtime may use explicitly configured provider credentials for authentication; it does not expose them to prompts, worker context, logs, reports, or repositories.
- Store the Gemini API key through macOS Keychain; configure it through Settings.
- Deny other repository access by default. Shared approved knowledge does not automatically grant raw source access.
- Network/dependency actions require a specific approval or pre-granted policy. Registered fetch is the explicit exception approved above.
- Destructive data operations require approval.
- Global rules and execution permissions do not change merely because knowledge is activated.

## Budget

- Zhon manages API budget per phase.
- BOSS manages the monthly Gemini spend cap in Google.
- Budget exhaustion stops scheduling additional workers/requests and is reported as a blocker. Do not automatically increase the budget.
- Track API usage separately from Codex subscription allowance. Unavailable metrics must not be reported as measured zero.
- Background knowledge processing uses a pre-approved profile with its model, cost limit, and run conditions. Process eligible changes in batches within that grant; no approval is required for each individual enrichment job.
- Knowledge-processing usage has its own budget, separate from execution-phase usage. Exhaustion leaves Candidates pending processing and does not authorize a budget increase or automatic activation.
- BOSS must still approve processed Candidates before they become Active.
- Cost reservation, in-flight requests, unknown usage after interruption, profile limit/reset details, and ordinary conversation accounting still need detailed design.

## Knowledge and learning

- New Obsidian-compatible Markdown vault, with its own repository, separate from zhon source.
- Both engineering and personal knowledge are in MVP.
- Do not prescribe a fixed subject taxonomy or ask BOSS to enumerate future subjects upfront.
- Topics and relationships grow automatically from content, using Obsidian-compatible notes, properties, tags, and links.
- The precise policy for physical file creation/moves versus logical organization remains open; do not assume approval for wholesale vault reorganization.
- Learning sources: manual Obsidian notes, successful/failed/blocked tasks, and valuable chat/brainstorm content.
- Automatically propose durable insights; do not convert every message into a note or repeatedly duplicate existing knowledge.
- Every new or edited note, including manual edits, becomes a Candidate pending UI review. The earlier Save-implies-Active idea was explicitly withdrawn.
- When an Active note is edited, keep its previously approved revision eligible for retrieval while the edited revision awaits review. Approving the replacement switches the Active revision; saving an Obsidian edit alone must not replace approved retrieval content.
- Provide an explicit Deactivate action so BOSS can immediately stop future retrieval of an incorrect Active note without waiting for replacement approval.
- The UI shows candidate content, a diff when applicable, lightweight origin information, and Approve/Reject controls.
- Only approved Active content is eligible as referenced knowledge. Active status alone does not make every personal note relevant to every coding task.
- Classifying candidate data must be distinguished from trusting it as Active memory.
- Include a concise English summary for agents and Vietnamese explanations/examples for BOSS in the same note.
- Knowledge is not all Lessons. Use content appropriate to concepts, references, decisions, personal reflections, skills/workflows, and lessons.
- Lessons should explain the problem, known cause or explicit hypothesis/unknown, solution or unresolved state, applicability/limitations, and prevention.
- No mandatory deep evidence system per lesson: commit SHA, source line numbers, and raw log snapshots are not required.
- Include a source/project/reference when useful and known; do not invent provenance or claim the old repository was freshly verified.
- Automatic re-opening and verification of old source repositories is not a required MVP learning workflow.
- Learning updates knowledge and experience, not execution authority or model weights.

## Validation, CI, and Done

- Meaningful unit tests for FE and BE behavior, from basic to advanced cases, at a reasonable scope.
- Automated checks and explicit acceptance criteria before advancing implementation phases.
- Track local validation results independently of remote CI.
- CI for zhon development is required.
- Managed-project CI monitoring is also in MVP: GitHub Actions is the first provider.
- Read pipeline status, test/build results, and logs; associate them with the correct repository and revision.
- Do not treat green CI for an old revision as validation of current uncommitted changes.
- Phase Done is local completion: required local tests/build/review pass, safe application succeeds, and both reports are available.
- Remote CI is tracked separately after BOSS commits/pushes. Phase Done does not assert remote CI passed or deployed behavior was accepted.
- CI authentication, polling, required workflow/job identification, and commit-to-phase association still need design.

## Reports and implementation planning

- Detailed implementation plans are English-only, written for agents. Do not create Vietnamese translations of phase plans. The two-audience requirement applies to reports, not plans.
- Every phase produces two reports, including unsuccessful outcomes where appropriate.
- Agent report: compact English handoff with outcomes, validation, blockers, and next actions.
- Human report: readable Vietnamese explanation with relevant theory, short examples, limitations, and what BOSS needs to do.
- Future plans must distinguish independent parallel tasks from sequential dependencies.
- Normally deliver FE and BE together in each feature phase. Pure feasibility/infrastructure phases may be justified exceptions.
- Each phase specifies Done criteria, prerequisites, blockers, resolution actions, and next-phase readiness.
- Do not turn the entire MVP into one oversized implementation task or fragment it into phases too small to deliver a useful capability.

## UI and conventions

- Clean, modern UI with Dark/Light themes; English UI copy, no initial multilingual UI.
- BOSS specified Sky & Lime palettes. Light: #F4F5F6, #E6E8EA, #111316, #595E66, #0B6FB8, #5A7400. Dark: #0D0F11, #181B1F, #EAECEF, #8B9199, #4DB2FF, #B6D94A. Proposed role mapping is background, surface, primary text, secondary text, sky accent, lime accent respectively.
- Use Hugeicons sparingly. React implementation requires the @hugeicons/react renderer plus an icon pack such as @hugeicons/core-free-icons. No product dependencies have been installed during brainstorming.
- No emoji in product-owned copy/code. Code and coding guidance are English; Vietnamese knowledge content and human reports are explicitly required.
- Separate UI rendering from business/execution logic. No inline business logic or nested mapping logic in HTML/JSX.
- Reuse real components/class definitions where useful; avoid excessive borders and unnecessary abstractions.
- Extend the intended `zhon-conventions` baseline after verifying the actual package/version and applicable rules.
- Typography: requested Vietnam Pro family, role-based hierarchy, ratio 1.2, base 14px. Verify the precise font family and terminal font needs before implementation.
- 8-point spacing grid, minimal/colorful design, clean cards, pill buttons, clear resolution, and restrained motion.

## Confirmed application boundaries

- Monorepo with `apps/web`, `apps/runtime`, `apps/cli`, and a shared `packages/contracts`.
- Next.js UI; one long-lived TypeScript/Node runtime; thin unified `zhon` CLI.
- Web and CLI send commands to the same runtime. Runtime owns authoritative state and database writes; neither frontend nor CLI directly bypasses its business logic.
- Shared contracts define command/response/event schemas, not database access or business logic.
- BOSS initially approved these application boundaries; the written design was subsequently approved for planning on 2026-10-10. Detailed implementation plans still require review before execution.

## Remaining provisional architecture

- Runtime responsibilities: conversations, project registration, planning/scheduling, execution supervisor, engine adapters, policy/budget, knowledge, reports, and GitHub integration.
- SQLite WAL for runtime storage; SQLite FTS5 for retrieval; versioned Markdown as knowledge content.
- Runtime owns authoritative state and storage writes; workers return results/events.
- Proposed logical models: Project, Conversation, PhasePlan, PhaseRun, WorkUnit, WorkerAttempt, Approval, and separate knowledge/CI models.
- No chosen final BE framework, Node version, complete schemas, transports, or adapter implementation details yet.

## Remaining design work

1. Component interfaces, package dependency direction, BE feature structure, and FE logic/rendering boundaries.
2. Installed engine versions/capabilities, native sandbox qualification, isolated configuration, and internal engine delegation controls.
3. Remaining role permissions and validation-job details. Reviewer independence at the worker/session level is confirmed; engine/model diversity is optional. Coder owns implementation and unit tests; tester independently verifies cases and results.
4. State transitions, cancel/retry/recovery semantics, approval expiry/revocation, and integration rollback/reconciliation.
5. Obsidian-compatible identity, revisions, candidate ingestion, deduplication, dynamic organization, context eligibility, and bounded classification costs.
6. GitHub read-only authentication, CI mappings, and the exact upstream policy.
7. Main UI navigation/views and layout, provider status metric availability, context inspection/compaction controls, accessibility, terminal rendering, and typography details.
8. Written design review, then phased implementation plans with FE/BE tasks, parallel boundaries, acceptance gates, and both report templates.

## Visual brainstorming artifacts

- Superpowers visual companion was accepted by BOSS. Session content: `.superpowers/brainstorm/56205-1791618671/content/`.
- First screen: `layout-options.html`, comparing focused chat and a conversation workspace.
- BOSS's feedback preferred the workspace direction and supplied detailed layout and palette requirements, represented in `layout-v2-sky-lime.html`.
- Intermediate screen: `layout-v3-sidebar-controls.html`, refining sidebar hierarchy and theme controls after BOSS's feedback.
- V4 screens refined icons, 280px sidebar, animated accordions, equal status cards, context placement, body footer, and Single/Split terminals.
- Latest screen: `layout-v5-review.html`, refining allowance bars/reset labels, rounded section separation, hidden scrollbars, and day-based history jumps. BOSS provisionally approved this UI and requested transition toward phased planning. All values are illustrative; no provider allowance integration is verified.
- Checked desktop sidebar width (300px), chat height greater than half the viewport, terminal opening within the page, note accordions, search across status columns, and theme switching in the browser. These are prototype checks, not product integration acceptance.
- V3 checks: project groups collapse/expand; Light/Dark selection changes its pressed state and palette. Light background was observed as rgb(244, 245, 246), matching #F4F5F6.
- V4/V5 checks: 280px sidebar; equal status widths; composer matches conversation width; body footer and terminal exclude sidebar; Single/Split panes switch; model dialog and context drawer open/close; sidebar groups collapse/expand; history jumps to each day's first message; scrollbar width is none. Prototype script syntax was checked. No product test/build evidence is implied.
- Icon images in the standalone HTML preview use the Hugeicons set via Iconify. The future React implementation will use the requested Hugeicons packages; no installation occurred.
- Local visual companion files are excluded from Git by `/.superpowers/` in `.gitignore`. This is the only tracked configuration change made for the visual companion.

No commit or push of this checkpoint is authorized by its creation.

## Written design handoff

- BOSS requested feature phases with independent FE/BE ownership after provisionally accepting UI v5.
- Written design package: `docs/superpowers/specs/2026-10-10-zhon-design.md`, with data/lifecycles, delivery/ownership map, report templates and a Vietnamese review guide in the same directory.
- The package distinguishes confirmed requirements from new proposed defaults and live feasibility/configuration gates.
- BOSS approved the written design for detailed phase planning on 2026-10-10. Plans are English-only; product implementation requires subsequent plan review and execution-method selection.


Execution update 2026-10-10: P0 has completed local verification and independent review. Current progress is in `docs/superpowers/plans/execution-ledger.md`; final evidence is in `docs/reports/P0/run-p0-remediation-final/`. Earlier planning status above is historical. P1–P7/S1 and remote CI remain unverified.
