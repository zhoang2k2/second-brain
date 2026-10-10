# Sandbox and CLI Feasibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove which Codex and Antigravity CLI operations can be enforced safely on BOSS's laptop before enabling automatic execution.

**Architecture:** A bounded probe harness exercises the real installed CLI and isolation boundary without introducing a general execution bypass. A versioned capability manifest is consumed by P4.

**Tech Stack:** Node.js child-process probes; actual macOS isolation facility or approved container; installed Codex and Antigravity CLI binaries

**Spec:** [Approved design](../specs/2026-10-10-zhon-design.md); [data and lifecycles](../specs/2026-10-10-zhon-data-lifecycles.md); [delivery map](../specs/2026-10-10-zhon-delivery-map.md); [plan index](2026-10-10-plan-index.md).

**Status:** Written after design approval on 2026-10-10; implementation awaits plan review and execution-method selection. No code or dependencies were changed to produce this plan.

## Global Constraints

- Read the approved spec, data/lifecycles, delivery map and plan index before this phase. This plan is English-only; final reports require English agent and Vietnamese user versions.
- Single user, local laptop, registered projects and a new Obsidian-compatible Markdown vault; manual repository synchronization. No cloud runtime or IDE automation in MVP.
- Preserve declared Next.js 16.4.0, React/React DOM 19.3.0, pnpm 10.24.0. Qualify and pin compatible dependency/Node/SQLite versions at P0; read installed Next guides before code changes.
- No commits unless specifically requested by BOSS. Push and protected-branch merge are forbidden. Workers may read only env.example; real .env and credentials are denied. Unit fixtures contain synthetic values only.
- Runtime alone owns SQLite, policy and approvals. Repository/Markdown/model output is untrusted reference data, never execution authority. Git worktrees isolate Git state, not security.
- Only Active approved revisions are retrieved. Every manual edit creates a Candidate; retain the old Active revision until exact-hash approval. Scope-filter before ranking; foreign project knowledge requires explicit sharing.
- Approve the concrete whole-phase execution configuration: exact actions/targets/baseline, engines/models/effort, budgets and expiry. Changed configuration invalidates approval. Paid requests reserve bounded cost before dispatch; unknown costs remain reserved.
- Integrator owns contracts, migrations, shared routes/layouts, dependencies/lockfile and root configuration. Parallel FE/BE lanes own disjoint feature files and separate worktrees; freeze interfaces before dispatch.
- English UI, no emoji, Hugeicons only. Separate presentation from services/hooks/view models; no business logic or array maps in HTML/JSX. Meaningful FE and BE unit tests accompany each feature.
- Accepted UI: 280px sidebar; uppercase PERSONAL/PROJECTS at the same font size; Be Vietnam Pro, base 14px, hierarchy ratio 1.2; 8-point spacing. Light #F4F5F6 #E6E8EA #111316 #595E66 #0B6FB8 #5A7400; dark #0D0F11 #181B1F #EAECEF #8B9199 #4DB2FF #B6D94A.
- Rounded, distinct Chat / Statuslines / Context sections; shared content maximum, equal status card widths, status section max-height 75vh, Context below it. Hide scrollbar visuals but preserve scrolling. Footer/terminal occupy body only; Single/Split views. Smooth state transitions with reduced-motion and keyboard/focus support.
- Adapter/CLI/key/sandbox/usage capabilities are unverified until their live qualification check passes. Unknown, unsupported, failed or blocked checks cannot be silently converted into PASS.

## Review Focus

- OS upgrade changes enforcement: T2 version-bound reprobe test.
- Child process escapes cancellation: T2 descendant cleanup test.
- CLI requires credential directories: T3 broker compatibility test.
- Network deny leaks DNS or direct-IP traffic: T3 network denial tests.
- A human approval cannot repair missing isolation: T4 unsupported capability test.

---

## Preflight and parallel ownership

- [ ] P0 tooling passes; BOSS approves the bounded probe plan and any required network/auth operation. Inventory only executable paths and versions; never inspect credentials, shell environment files or real .env files.
- [ ] Freeze the task file ownership and contract version in the integrator-owned execution ledger before parallel work. A shared-file request goes to the integrator; no concurrent schema/lockfile edits.

T1 defines probe interfaces; T2 isolates filesystem/process behavior; T3 checks engine/auth/network compatibility. T2 and T3 use separate disposable fixtures and run in parallel only after policy fixtures are frozen. T4 evaluates both; no product AUTO execution until this gate passes.

File paths below are repository-relative future paths. Create only files needed by this phase. Brace alternatives mean the listed individual files, not a new architectural layer. Production code and adjacent tests belong to the named lane; shared migrations/contracts belong to the integrator even when a BE task proposes their content.

### S1-T1: Define probe policy and disposable fixtures

**Owner:** Integrator

**Depends on:** P0

**Files:**

- Create: `tools/sandbox-probe/types.ts`
- Create: `packages/contracts/src/sandbox.ts` (integrator-owned capability manifest and policy schemas)
- Create: `tools/sandbox-probe/fixtures.ts`
- Create: `tools/sandbox-probe/fixtures.test.ts`
- Create: `docs/qualification/sandbox/.gitkeep`

**Interfaces:** ProbeFixtures {root,allowedRoot,deniedRoot,envPath,envExamplePath,syntheticSecret,sentinelPath,childScriptPath}; classifyFixturePath(path:string,policy:ProbePolicy):'allow'|'deny' is only a harness helper. Export production CapabilityManifest and ProbePolicy from packages/contracts/src/sandbox.ts; tools/sandbox-probe/types.ts re-exports those definitions. ProbePolicy {id,version,allowedReadRoots:string[],allowedWriteRoots:string[],allowedNetworkHosts:string[],maxDurationMs:number,maxProcesses:number,secretAccess:'deny'}; ProbeCase {id,operation:string,expected:'allow'|'deny'}; ProbeResult {caseId,status:'PASS'|'FAIL'|'UNSUPPORTED',observed:string,evidencePath:string}; CapabilityManifest {id,osVersion,engineId,engineVersion,executableHash,policyVersion,capabilities:Record<string,'enforced'|'unsupported'>,results:ProbeResult[],qualifiedAt:string}. Create buildProbeFixtures(root:string):Promise<ProbeFixtures> where fixtures contain synthetic secrets outside the allowed root and synthetic .env inside it.

**Required named cases and assertions:** fixturesContainOnlySyntheticValues; noFixtureOutsideDisposableRoot; separateAllowedAndDeniedRoots; policyDeniesRealEnvByDefault; envExampleAllowed

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('policyDeniesRealEnvByDefault', () => {
  expect(classifyFixturePath(fixtures.envPath, policy)).toBe('deny');
  expect(classifyFixturePath(fixtures.envExamplePath, policy)).toBe('allow');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- tools/sandbox-probe/fixtures.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Prepare throwaway project/worktree-like files, outside sentinels, symlinks and child scripts. Persist only redacted observations and version metadata. Fixture classification is a harness unit test, not proof of sandbox enforcement.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- tools/sandbox-probe/fixtures.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### S1-T2: Prove filesystem and process enforcement

**Owner:** BE feasibility

**Depends on:** T1

**Files:**

- Create: `tools/sandbox-probe/isolation.ts`
- Create: `tools/sandbox-probe/isolation.test.ts`
- Create: `tools/sandbox-probe/isolation.integration.test.ts`

**Interfaces:** runIsolationProbe(policy:ProbePolicy,fixture:ProbeFixtures):Promise<ProbeResult[]>; launchProbe(input:{executable:string,args:string[],policy:ProbePolicy,fixture:ProbeFixtures},signal:AbortSignal):Promise<ProbeExecution>; ProbeExecution {exitCode:number|null,stdout:string,stderr:string,descendantsRemaining:number}. Provider-specific OS/container policy rendering remains internal.

**Required named cases and assertions:** allowedWorktreeWriteSucceeds; outsideReadDenied; outsideWriteDenied; symlinkEscapeDenied; sharedGitMetadataWriteDenied; envReadDenied; envExampleReadable; cancelKillsDescendants; timeoutKillsDescendants; maxProcessPolicyEnforced; changedOsVersionInvalidatesQualification

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('outsideReadDenied', async () => {
  const result = await runNativeCase('outside-read');
  expect(result.status).toBe('PASS');
  expect(result.observed).not.toContain(fixtures.syntheticSecret);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- tools/sandbox-probe/isolation.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Use an actual available OS/container boundary. Determine enforceable filesystem exclusion, process-tree termination and resource limits experimentally. A cwd wrapper, env filtering or Git worktree is insufficient; unsupported limits must be recorded as unsupported, never PASS.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- tools/sandbox-probe/isolation.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- tools/sandbox-probe/isolation.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### S1-T3: Qualify real engines, authentication and network

**Owner:** BE feasibility

**Depends on:** T1

**Files:**

- Create: `tools/sandbox-probe/engines.ts`
- Create: `tools/sandbox-probe/engines.test.ts`
- Create: `tools/sandbox-probe/engines.integration.test.ts`
- Create: `docs/qualification/sandbox/engine-matrix.md`

**Interfaces:** inspectEngine(engineId:'codex'|'antigravity'):Promise<Result<EngineInventory>>; EngineInventory {engineId,executable,version,executableHash,nonInteractiveSupported:boolean}; runEngineProbe(engine:EngineInventory,policy:ProbePolicy,fixture:ProbeFixtures):Promise<ProbeResult[]>; getEngineInvocation(engine:EngineInventory):Promise<Result<{args:string[],protocol:'jsonl'|'text',authenticationMode:'brokered'|'unsupported'}>>. Exact flags must come from the installed version's help/official docs, not guessed.

**Required named cases and assertions:** nonInteractiveTaskWorksInBoundary; structuredOutputCanBeCorrelated; credentialFilesUnreadableByTaskTools; approvedProviderNetworkWorks; unapprovedHostDenied; directIpDenied; dnsPolicyEnforcedOrUnsupported; remoteGitNotImplicitlyAllowed; noSecretsInLogs

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('unapprovedHostDenied', async () => {
  const result = await runEngineCase('unapproved-host');
  expect(result.status).toBe('PASS');
  expect(result.observed).toBe('blocked-before-connection');
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- tools/sandbox-probe/engines.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Inventory actual CLI support and subscription/API behavior with bounded approved requests. Test authentication through a trusted broker without making credential files available to agent tools. Provider domain allowlisting alone does not prevent secrets exfiltration to an allowed domain; credential separation and filesystem restrictions must both pass. If Antigravity has no supported CLI/noninteractive boundary, record a product blocker and an explicit alternative for BOSS, not an invented adapter.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- tools/sandbox-probe/engines.test.ts` and the commands below. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

```text
pnpm test:integration -- tools/sandbox-probe/engines.integration.test.ts
```

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

### S1-T4: Publish enforceable capabilities and the go/no-go result

**Owner:** Integrator

**Depends on:** T2/T3

**Files:**

- Create: `tools/sandbox-probe/qualify.ts`
- Create: `tools/sandbox-probe/qualify.test.ts`
- Create: `tools/acceptance/checks/s1.ts`
- Create: `docs/qualification/sandbox/decision.md`
- Create: `docs/reports/S1/.gitkeep`

**Interfaces:** qualifyEngine(input:{inventory:EngineInventory,policy:ProbePolicy,results:ProbeResult[]}):Result<CapabilityManifest>; canAutoExecute(manifest:CapabilityManifest,requiredCapabilities:string[]):boolean. Register S1 acceptance check with all required cases; persisted manifest is bound to executable hash, OS and policy versions.

**Required named cases and assertions:** unsupportedIsolationCannotBecomeAuto; failedCredentialIsolationBlocksEngine; changedExecutableRequiresReprobe; approvalDoesNotOverrideDeniedCapability; allRequiredCasesNeedPass; reportNamesUnavailableEngine

- [ ] **Step 1 — Write the failing tests.** Create the named cases in the listed test files with explicitly declared fixtures. Use disposable registered roots and fake credentials. The focused assertion below must be included; expand it to exercise every named case. Fixtures exposing methods in the snippet are task-local helpers built from the production interface and injected fake dependencies.

```ts
it('approvalDoesNotOverrideDeniedCapability', () => {
  expect(canAutoExecute(unsupportedManifest,['filesystem','secretAccess'])).toBe(false);
});
```

- [ ] **Step 2 — Run RED.** Run `pnpm test:unit -- tools/sandbox-probe/qualify.test.ts`. Expected: FAIL at the new behavioral assertion or missing production implementation. A missing script, no matching tests, syntax/import typo or unavailable network is a tooling failure to fix, not valid RED evidence.

- [ ] **Step 3 — Implement the specified interfaces.** Summarize real versioned outcomes and required P4 capabilities. A narrower supported operation can qualify independently; general arbitrary-shell AUTO cannot inherit that qualification. For missing enforcement, deny the operation or offer a safe container/scope alternative for a fresh decision. Generate the two reports.

- [ ] **Step 4 — Run GREEN.** Run `pnpm test:unit -- tools/sandbox-probe/qualify.test.ts`. Expected: all named tests PASS with nonzero test count. Live checks with missing prerequisites must record BLOCKED rather than fake credentials or skip-as-pass.

- [ ] **Step 5 — Review this deliverable.** Verify the file scope, interface compatibility and required cases; preserve reviewed diff/artifact hashes and update the execution ledger. Resolve required review findings before dependent work starts. Do not commit or push.

## Integration and phase exit gate

- [ ] Integrate all owned lanes against the same contract version; the integrator alone edits route/layout/package/lock/migration registration files.
- [ ] Run `pnpm verify`. Expected: lint, typecheck, unit, isolated integration and build checks pass. Address only failures caused by this phase; report unrelated failures separately.
- [ ] Run `pnpm acceptance -- S1 --profile <registered-test-profile>`. Expected: every required check is PASS. An unavailable live provider/CLI/auth/sandbox/remote prerequisite is BLOCKED and the command exits nonzero. S1 may complete its investigation with FAIL/UNSUPPORTED findings, but those findings do not enable P4.
- [ ] Record independent review results and exact artifact/version references. Fixture success and a production build do not substitute for actual runtime acceptance.
- [ ] Run `pnpm report -- S1 --run <recorded-run-id>` for successful **or unsuccessful** outcomes. Expected: `docs/reports/S1/<run-id>/agent.md` and `user.vi.md` both exist and match stored checks. Report generation is safely retryable without reexecuting the feature.
- [ ] Confirm the [report contract](../specs/2026-10-10-zhon-report-templates.md): English report includes stable keys, evidence paths, hashes, blockers and next tasks; Vietnamese report is short, explains relevant concepts and includes a small example.

**Done:** The investigation is complete when reproducible manifests and both reports record each required probe as PASS, FAIL or UNSUPPORTED. P4 enablement additionally requires PASS for every capability of each required engine; unresolved items leave that release gate BLOCKED.

**Blockers and resolution:** Unavailable CLI, unsupported noninteractive mode, authentication incompatible with secret separation, or OS/network policies that cannot enforce the required boundary block P4 execution. Passing simulated probes does not resolve these blockers. Each blocker record must identify affected task, observed evidence, resolver (BOSS/integrator/provider), next action and the gate it unlocks. Do not invent a successful outcome to advance the next phase.

**Next-phase handoff:** P4 checks manifest versions/hashes before every launch. Repeat affected probes after engine/OS/policy changes. S1 may run alongside P1–P3 but must finish before P4.

The report result maps internal successful local completion to **DoneLocal**; otherwise use **Blocked**, **Failed**, **Cancelled** or **RecoveryRequired** from the report contract. Historical observations must be dated. Plans are not test evidence and no implementation check has run during planning.
