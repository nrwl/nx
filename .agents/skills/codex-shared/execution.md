# Codex execution conventions

These repository skills are invoked as `$skill-name`, with inputs supplied in the user's message. Read a companion skill's `SKILL.md` when a workflow calls for it; there is no special skill-call tool required. Resolve repository paths from the checkout root and relative reference links from the file containing them.

## Tools and permissions

Use the file, shell, search, and question tools available in the current Codex session. Use `rg` for local searches and `pnpm nx` for this repository's Nx tasks. Discover connected MCP tools by capability rather than assuming a Claude-specific tool identifier. If a required integration is unavailable, report that dependency instead of inventing a call.

The `.claude/tools/sandbox`, `.claude/tools/triage`, and `.claude/tools/review` paths are existing shared repository CLIs, not Claude model invocations. Keep using them. Run their commands from the repository root. Do not launch the Claude batch-review driver from these skills.

Skills do not enforce tool allowlists or grant filesystem/network permissions. Honor the current Codex sandbox and approval policy. Review and reproduction commands must still run through the repository sandbox CLI; an available host shell is not permission to execute untrusted checkout code there. Do not disable sandbox settings or change authentication to bypass a denial. Report the blocked operation if the permitted approval mechanism cannot resolve it.

Preserve each workflow's mutation boundary: reviews produce local drafts; triage changes are staged and applied only after the user approves the record; posting review drafts requires approval. Existing authorization in the conversation remains valid. Keep secrets on the host and out of review sandboxes. Never erase an existing draft or queue to make a run succeed.

## Review delegation

Review roles are instructions in [review-pr/references/agents](../review-pr/references/agents/), not registered Codex agent types. When a workflow requests an independent reviewer, use an available generic Codex subagent and tell it to read the corresponding role file. Pass the role's complete task inputs: charter, authoritative diff, changed-file list, evidence file, sandbox capability, and output location. Use distinct task names and pass file ownership if the task writes anything. Agents share a workspace; they must not revert others' changes.

Use the session's native spawn/message/wait tools, inherit its model, and fit concurrency to its available slots. Queue additional lanes instead of exceeding the limit. Read-only roles receive the read-only sandbox capability; roles that need mutations get their own sandbox worktree. Do not assume a role file creates a runtime permission boundary.

If delegation is unavailable, run the role passes sequentially and disclose that they were not independent. Never fabricate an agent report or mark missing evidence as verified. Read only the role definitions needed for this run.

## Questions and long-running commands

Ask questions through the available Codex question tool, respecting its mode restrictions, or in the conversation. Do not assume an unanswered question is agreement. A headless review saves its draft and leaves the grill pending for `$review-pending-pr-reviews`.

For a long-running shell command, retain the returned session/process handle and read incremental output through the session tool. Reuse one watcher per queue, with bounded waits, while continuing useful work. There is no Claude `Monitor` tool or automatic background completion guarantee. If the runtime cannot keep a watcher alive after the turn, say so and read `triage feedback` and `triage notes` when the user resumes.
