# Zhon phase report contracts and templates

Status: report design approved by BOSS for phase planning on 2026-10-10. These templates contain field descriptions, not fictitious execution results.

## Artifact location

Future phase reports use `docs/reports/<phase>/<run-id>/agent.md` and `user.vi.md` for zhon development. For managed projects, write to the explicitly approved report destination; do not silently add files to a project's source tree or to Active knowledge.

The UI references the actual persisted files/records. After a failed/blocked/cancelled run, write both reports from available evidence. Report generation failure must remain visible.

## Compact English agent report

Target: typically under 1,000 tokens, with links to detailed redacted artifacts. This is a size goal, not permission to omit critical blockers or uncertainty.

| Key | Content |
| --- | --- |
| phase / run / result | Exact IDs and DoneLocal, Blocked, Failed, Cancelled or RecoveryRequired |
| objective | One sentence identifying the useful capability |
| plan_version / baseline | Reviewed plan identity and observed project/branch/base |
| delivered | Behavior delivered and actual changed paths, summarized |
| checks | Exact command/check, result, artifact/input revision and report reference |
| artifacts | Integration output, diff, logs, report locations |
| blockers | Specific unmet criterion, impact, resolver and next action |
| decisions | Approved choices needed to avoid re-investigation |
| next | Ready prerequisites, unresolved gates and bounded next tasks |
| knowledge_candidates | Candidate references and review state; never imply activation |

Suggested Markdown skeleton:

```text
# Phase report
phase:
run:
result:
objective:
plan_version:
baseline:

delivered:
checks:
artifacts:
blockers:
decisions:
next:
knowledge_candidates:
```

Fill every applicable field from recorded results. Use `not applicable` with a reason or `unknown` when appropriate. Never write a placeholder success claim because a worker exited normally.

Examples of truthful check entries:

- `unit: PASS, input artifact ...` only after a recorded run.
- `live Gemini: BLOCKED, credential not configured` when only provider fixtures passed.
- `remote CI: not checked; local changes are uncommitted` when no matching remote revision exists.
- `command outcome: UNKNOWN after interruption; reconciliation required` when completion cannot be established.

## Vietnamese user report

Keep paragraphs short. Explain only the concepts BOSS needed in this phase; link advanced details instead of writing a textbook.

```text
# Báo cáo phase

Kết quả: [trạng thái thực tế]
Mục tiêu: [BOSS làm được điều gì sau phase]

## Những gì đã có
- [Một hành vi cụ thể, có ví dụ nếu hữu ích]

## Kiểm chứng
| Kiểm tra | Kết quả | Phạm vi chứng minh |
| ... | ... | local / integration / remote |

## Kiến thức cần hiểu
- Concept: [giải thích ngắn]
- Vì sao cần: [liên hệ trực tiếp feature]
- Ví dụ: [tình huống nhỏ]
- Giới hạn/trade-off: [điều cần lưu ý]

## Blocker hoặc giới hạn
| Vấn đề | Ảnh hưởng | Ai xử lý | Hành động tiếp theo |
| ... | ... | ... | ... |

## Chuẩn bị phase tiếp theo
- [Điều đã sẵn sàng]
- [Việc BOSS cần làm nếu có]
- [Điều chưa được kiểm chứng]

## Knowledge Candidates
- [Bài học/kiến thức đang chờ duyệt]
```

Examples of relevant teaching:

- P1: revision is a saved version; editing a file does not approve its new content.
- P2: context is what the model receives now, while history is the full stored conversation.
- P4: a worktree separates code state; the sandbox limits process access.
- P5: a DAG lets independent units run together while dependent units wait.
- P6: a green check for an older commit cannot verify uncommitted local changes.

## Report acceptance

1. The two reports agree on result, blockers and validation evidence.
2. Critical unknowns are explicit; no credentials or secret-bearing raw output.
3. A next agent can locate artifacts without rereading the whole conversation.
4. BOSS can identify what works, what is blocked, why it matters and the next action.
5. Generated knowledge is a separate Candidate; writing a report is not memory promotion.

Both reports are required at the end of each development phase. They may be short for a small foundation/feasibility phase. Their existence does not convert blocked implementation into Done.
