# ClickPulse Agent Collaboration Guide

This file defines the project-level collaboration protocol for AI-assisted work in ClickPulse. It applies to planning, implementation, review, validation, and reporting in this repository.

## Project boundaries

- ClickPulse is an offline desktop application: Rust desktop/core code, a TypeScript service, and a native JavaScript WebView UI.
- Follow `CONTRIBUTING.md`, `docs/development.md`, `SECURITY.md`, and the existing code conventions. Treat their data-integrity, privacy, security, and release/publication constraints as repository rules; do not override them without explicit maintainer approval.
- A user instruction takes precedence over this collaboration process unless it conflicts with a safety requirement or a repository rule above.
- If a reviewer discovers a potential security vulnerability (data disclosure, permission abuse, corruption risk, or exploit path), report it as "SECURITY: [generic description without exploit details]" in the review output. Pi must verify privately and follow `SECURITY.md`'s private reporting process if confirmed. Do not document full exploit steps or proof-of-concept code in task history or public artifacts.
- Keep every change focused on one concrete behavior. Do not broaden scope merely to satisfy a review suggestion.
- Do not change global Pi, Magpie, model-authentication, or provider configuration as part of project work.
- Do not alter database schema, Rust core architecture, permissions, security policy, release configuration, or destructive data operations without explicit user approval.

## Roles and authority

### Pi main agent — development lead

Pi owns the task lifecycle:

1. Understand the request and inspect relevant project code.
2. Classify the task and decide whether review is warranted under the routing rules below.
3. Produce and execute the smallest viable implementation plan.
4. Modify project files, run validation, inspect the final Git diff, and integrate review evidence.
5. Independently verify material reviewer findings before accepting, rejecting, or acting on them.
6. Report completed changes, validation, known limits, and any reviewer disagreement.

Pi is the only default writer. Pi must not ask a reviewer to edit files, commit changes, change global configuration, or execute destructive operations. Pi reports `git status --short` but creates commits only when the user explicitly requests them; if commit intent is unclear, Pi asks first.

### `gpt-reviewer` — product, design, and feasibility reviewer

Use `gpt-reviewer` for independent, read-only review of:

- UI/UX hierarchy, page layout, visual density, responsive behavior, accessibility cues, and interaction flow.
- Product requirements, feature scope, user-facing copy, edge cases, and acceptance criteria.
- Technical-solution feasibility when it affects the product experience.

For UI review, provide the task goal, relevant files/diff, expected viewport or platform, and a screenshot or rendered evidence when one is available. Do not claim visual facts without visual evidence.

### `reviewer` — code-quality and risk reviewer

Use `reviewer` for independent, read-only review of:

- Correctness, regressions, boundary conditions, security, privacy, IPC, Rust behavior, data handling, performance, test coverage, and platform risks.
- Final implementation diffs for non-trivial features, bug fixes, or sensitive changes.

Ask for evidence-backed findings with exact file paths and line numbers, severity, impact, and the smallest safe remediation. A `BLOCK` finding is a claim to verify, not an automatic stop decision.

> Model selection belongs to local Pi/subagent settings. Project instructions use agent aliases (`gpt-reviewer` and `reviewer`) instead of hard-coding model identifiers, so this repository does not change global model or Magpie configuration.

## Automatic routing rules

Classify before implementation. When multiple rows apply, use this precedence:

1. **Sensitive-work categories** (Rust, database, IPC, permissions, security, privacy, performance) always trigger `reviewer` for technical-risk assessment.
2. **Add `gpt-reviewer`** when the task also involves non-trivial UI/product decisions: changes to user-visible flow, introduces new UI patterns, affects accessibility, requires localization, or impacts onboarding/discoverability.
3. **Security, privacy, and database changes** always require `reviewer` regardless of UI complexity.

Classify a task as more than a narrow polish when it changes user flow, persistence, IPC, behavior, or more than one module.

| Task type | Before implementation | After implementation | Notes |
| --- | --- | --- | --- |
| Copy-only change, formatting, narrow CSS polish with no behavioral effect | Pi only | Pi validation only | Do not spend reviewer cost by default. |
| UI page, layout, interaction, visual hierarchy, onboarding, or user-facing workflow | `gpt-reviewer` when the change is more than a narrow polish | `gpt-reviewer` when rendered evidence is available | Provide screenshots where possible. |
| New feature spanning behavior, UI, or multiple modules | `gpt-reviewer` reviews requirements and solution shape | `reviewer` reviews final code/diff | Pi implements between the two stages. |
| Rust, database, IPC, URL launching, permissions, security, privacy, or performance-sensitive work | `reviewer` assesses risk and boundaries | `reviewer` reviews final diff | Add `gpt-reviewer` only when product/UX decisions are non-trivial (see precedence rules above). |
| Bug fix with unclear cause or regression risk | `reviewer` analyzes likely cause and test gap | `reviewer` checks the fix | Pi must validate the root cause independently. |
| Important page redesign or complete feature | `gpt-reviewer` reviews requirements/UX; call `reviewer` too if implementation is sensitive | `reviewer` checks code; `gpt-reviewer` checks rendered UX | Sequence reviews by stage; do not ask both agents to repeat the same question. |

### Cost and cadence limits

- Do not call a reviewer for simple, local, low-risk changes unless the user specifically asks.
- A normal complex task gets at most one design/solution review and one post-implementation review per relevant reviewer.
- Use parallel reviews only when their responsibilities are independent and both results are needed at the same stage.
- Do not re-run a reviewer merely because its opinion is inconvenient. Re-run only after a material change, new evidence, or an unresolved disagreement.
- If a task is paused and resumed across sessions, treat it as the same task for these limits. A user-directed requirement change or a fundamentally invalidated approach starts a new review budget.

## Standard workflow for reviewed work

1. **Inspect and classify** — Pi reads relevant files, identifies constraints, and chooses the appropriate route.
2. **Independent review** — launch the relevant reviewer(s) with a bounded, read-only brief containing the task goal, repository root, relevant paths, constraints, and expected output.
3. **Decide and implement** — Pi compares evidence with the codebase, chooses the minimal safe plan, and makes the changes. Reviewer suggestions are advisory.
4. **Validate** — run the smallest relevant checks from `docs/development.md`; validate native behavior when the change requires it. If validation finds failures, fix them before final review. If the approach itself needs assessment, document the validation gap and proceed to final review for correctness guidance.
5. **Final review** — for reviewed tasks, call the reviewer appropriate to the completed change. Give it the final diff and any rendered proof needed for its role.
6. **Verify and report** — Pi checks each material finding directly, resolves disagreements with evidence, runs `git diff --check` and `git status --short`, and reports results and remaining limits.

## Reviewer brief requirements

Every reviewer request should include:

- The precise question to answer and scope boundary.
- The resolved repository root for the current checkout (for example, `D:/data/Data/GitHub/ClickPulse-Social` on this workstation).
- Relevant file paths, requirements, prior decisions, and the current diff when one exists. For pre-implementation review, provide the relevant current files and the proposed solution instead of a task diff.
- Read-only authority: do not modify files, commit, alter configuration, or execute destructive commands.
- Expected output: severity-ranked actionable findings, exact evidence, uncertainty labels, and a concise verdict.

For visual review, also include viewport/platform, image path or screenshot, and whether the screenshot is current. For code review, request exact paths and line numbers and require that a diff hunk is not mistaken for simultaneously live old and new code.

If Pi's brief omits required context, the reviewer should report the missing elements and request them before proceeding. Do not guess repository roots, file paths, or constraints.

## Evidence and conflict handling

- Treat reviewer output as evidence, not authority.
- Pi must independently check every important finding against the current worktree. In particular, inspect live files as well as diffs; removed (`-`) lines are not live code.
- If `gpt-reviewer` and `reviewer` disagree, state both positions, supporting evidence, Pi's decision, and why the rejected position was not adopted.
- Mark uncertain claims as unverified. Never describe a visual, runtime, platform, or model-routing outcome as tested when it was only inferred.
- Do not expand a change solely to eliminate low-value review notes.

## Read-only and concurrency safeguards

- Reviewers are read-only by default and must not modify project files, create commits, change project/global configuration, or start destructive data operations.
- Pi is the only default project-file writer.
- Do not run concurrent writers in the same checkout. Reviewers may run in parallel only when they do not overlap in responsibility.
- Never allow a reviewer to submit, merge, publish, release, migrate, or delete data.

## ClickPulse validation baseline

Choose checks based on the changed area. Do not claim checks that were not run.

- Run `git diff --check` and inspect `git status --short` for every code or instruction change; verify no unrelated artifacts are added.
- Run the complete check block in `docs/development.md` for a release candidate, broad cross-cutting change, or when the user explicitly requests full validation. For focused changes, run the relevant subset and state exactly what was omitted and why.
- Rust: use `cargo fmt --check`, targeted `cargo test --all-targets --locked`, and `cargo clippy --all-targets --locked -- -D warnings` when the Rust change warrants them.
- UI/localization: run the affected Node tests from `docs/development.md`; at minimum use the targeted UI/i18n tests affected by the change.
- Native UI, QR, browser opening, or platform integration: use a safe/demo/temporary-data workflow where feasible and explicitly state any runtime behavior that could not be exercised.

## Manual triggers

The routing rules guide Pi automatically for future tasks, but the user can always request a narrower review:

- "用 gpt-reviewer 审查 UI/UX" (or: "review UI/UX with gpt-reviewer") — product/design review.
- "用 reviewer 审查代码" (or: "review code with reviewer") — code-quality/security review.
- "两个 reviewer 都审查" (or: "review with both reviewers") — independent dual review for a material task.
- "不要调用任何 reviewer" (or: "do not call any reviewer") — Pi works directly unless a safety constraint requires otherwise.
- "不要调用 reviewer；仍可调用 gpt-reviewer" (or: "suppress reviewer only; gpt-reviewer still allowed") — suppress only the code-quality reviewer.
- "不要调用 gpt-reviewer；仍可调用 reviewer" (or: "suppress gpt-reviewer only; reviewer still allowed") — suppress only the product/design reviewer.

When a task does not fit these rules, Pi should explain the proposed route briefly before launching costly reviewers.
