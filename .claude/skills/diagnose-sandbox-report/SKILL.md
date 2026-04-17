---
name: diagnose-sandbox-report
description: >
  Diagnose Nx sandbox violations from a sandbox report. Use when asked to
  "diagnose sandbox", "analyze sandbox report", "investigate sandbox violations",
  "check violations", when given a sandbox report JSON file or URL to investigate,
  or when the user pastes a staging.nx.app sandbox-report URL. Also trigger when
  discussing unexpected reads/writes in Nx task execution. Guides structured
  investigation of why tasks read/write undeclared files, determines root causes,
  and recommends fixes.
argument-hint: '<sandbox-report.json or URL> [--filter <file|pattern|list>]'
allowed-tools: Bash, Read, Grep, Glob
---

# Diagnose Sandbox Report

## Overview

Sandbox violations occur when an Nx task reads files not declared as inputs or writes files not declared as outputs.

**Unexpected reads** are one of:

1. **Missing input** (most likely) — the process legitimately needs this file. Understand what the process does and why the access makes sense, then declare it as an input.
2. **Potential sandboxing gap** (last resort) — the access is irrelevant to correctness and should be filtered/ignored by the sandbox. Only conclude this after exhausting every possibility for it being a missing input.

**Unexpected writes** follow the same logic:

1. **Missing output** (most likely) — the process legitimately produces this file.
2. **Potential sandboxing gap** (last resort) — same as above.

The default assumption is that an unexpected access IS a missing declaration. The investigation's job is to understand WHY the process accesses the file — not to find reasons it shouldn't.

## Critical Rules

1. **NEVER read the sandbox report JSON directly** — these files are too large for the Read tool (50K+ tokens). Do NOT use `Read`, `cat`, `head`, `python3`, or `jq` on the raw report. All report parsing is handled by the script.
2. **ALWAYS run the context-gathering script as the very first step** — no manual parsing, no ad-hoc python/jq on the report file. The script does everything deterministically.
3. If the script fails, **report the error and stop**. Do not attempt manual parsing as a fallback.
4. **Identify the inferring plugin BEFORE proposing any fix** — check `inference.plugin` in the script output or run `jq '.targets.<target>.metadata' <detail-file>`. Fixing the wrong plugin wastes entire investigation rounds.
5. **Verify hypotheses empirically before committing to them** — see Principle 4 and the Phase 2 instrumentation guidance.

## Workflow

### Phase 0: Input

User provides one of:

- Path to a sandbox report JSON file
- A URL to a sandbox report — pass it directly to the script, it handles downloading
- A task ID + CIPE URL (fetch report via MCP if available)
- Inline violation data

If a task ID is provided but no report, ask the user for the report file.

**Filtering**: Most invocations will focus on specific files, not the entire report. The user may specify:

- A single file: `e2e.log`
- A comma-separated list: `apps/nx-cloud/e2e.log,apps/nx-cloud/build/client/assets/main.js`
- A glob pattern: `*.tsbuildinfo`, `apps/nx-cloud/build/**`
- A directory prefix: `apps/nx-cloud/build/client/assets`

When the user specifies files to focus on, pass them via `--filter` to the script. When they don't specify a filter and the report has many violations, summarize the groupings (by directory, extension) and ask which group(s) to investigate first rather than trying to investigate everything at once.

### Phase 1: Deterministic Pre-Processing

Run the context-gathering script **immediately** — this is the first tool call after reading the user's input.

Call it exactly as shown — do NOT append `2>&1` or `2>/dev/null` (the script manages its own stderr internally). Run in the **foreground** (no `run_in_background`) with a **3-minute timeout** — reports can be large and the script runs the task + multiple nx commands:

```bash
npx tsx ${CLAUDE_SKILL_DIR}/scripts/gather-sandbox-context.ts <report.json or URL> [--filter <pattern>] [--workspace <path>]
```

Pass `--filter` when the user wants to focus on specific files or patterns. The script filters violations before all downstream processing (grouping, validation, classification), so the output only contains relevant data.

The script produces two outputs:

**stdout** (~3-5KB compact brief) — everything needed to start investigating:

- `summary`: violation counts (total, filtered, confirmed vs undeclared)
- `undeclaredFiles`: the actual file paths that are true violations
- `grouping`: violations grouped by directory and extension
- `commands`: processes with violations (pid, cmd, executable, arguments, counts) — no full file lists
- `classificationSummary`: counts per category (cross-project, build artifacts, config files, etc.)
- `crossProjectDependencyCheck`: whether cross-project file owners are in the task's dependency chain
- `staleDeclarations`: grouped analysis of expectedInputsNotRead / expectedOutputsNotWritten
- `dependentTasksOutputFiles`: extracted from target inputs config and named inputs — shows what dep output globs are declared (critical for cross-project violations)
- `executorInfo`: executor name and resolved source path in `node_modules` — read this file to understand how the tool is invoked
- `checkSample`: results of `--check` on up to 5 undeclared files (catches false positives early)
- `inference` + `pluginRegistration`: plugin metadata
- `verificationCommands`: pre-built `--check` commands with the correct task ref
- `detailFile`: path to the full detail JSON

**detail file** (`/tmp/sandbox-diagnosis-detail-<project>-<target>.json`) — full data for drill-down. Structure:

- `processTree.processTree`: array of `{pid, cmd, parentPid}` entries
- `processTree.processPidToCmd`: `{ "pid": "command string" }` map
- `processTree.readsByPid`: `{ "pid": ["file1", "file2"] }` — violated reads grouped by PID
- `processTree.writesByPid`: `{ "pid": ["file1", "file2"] }` — violated writes grouped by PID
- `targetConfig`: full target configuration (executor, options, inputs, outputs, dependsOn)
- `projectConfig`: full project configuration
- `resolvedInputs`: `{ files: [...], depOutputs: [...], runtime: [...], environment: [...] }`
- `resolvedOutputs`: `{ outputPaths: [...], expandedOutputs: [...] }`
- `validation`: `{ reads: { confirmed: [...], undeclared: [...] }, writes: { ... } }`
- `classification`: `{ reads: { crossProject, buildArtifacts, configFiles, ... }, writes: { ... } }`

Read the brief output — it has everything to start. Use `jq` on the detail file only when you need to drill into specific sections. When querying the detail file, use the structure above — do not guess the schema. Do NOT use Python, ad-hoc scripts, or the Read tool on the detail file — only `jq`.

For reports with many violations, use `--filter` to narrow scope. When investigating without a filter, use the `grouping` data to identify patterns and prioritize — don't try to trace every file individually.

If `summary.undeclaredReads` and `summary.undeclaredWrites` are both 0, all violations were resolved by the script's validation against resolved inputs/outputs. Report this to the user — no further investigation needed.

The `commands` array pre-parses each process — use `executable` and `arguments` to identify the tool without re-parsing `cmd`. When many files share the same root cause, group them under one finding using a glob pattern or count (e.g., "88 `.d.ts` files matching `packages/nx/dist/**/*.d.ts`").

### Phase 2: Command Analysis — the core investigation

**This is the most important phase.** The goal is to determine with 100% certainty why each process reads or writes each violated file. Do not classify violations from file names or paths alone — trace the actual causal chain from command → config → file access.

#### Step 1: Understand the command

The brief's `commands` array pre-parses each process. Use the `executable` and `arguments` fields directly — don't re-parse `cmd`. Identify:

- The tool (from `executable`)
- The arguments (target files/dirs, config flags, extensions — from `arguments`)
- The working directory (from executor options or project root)

#### Step 2: Trace why the command accesses each violated file

For each violated file, establish the **exact causal chain** that leads the command to read or write it. The approach is the same regardless of tool:

1. Identify the tool's config file (usually in the project root or workspace root)
2. Read the config and trace file references: `includes`, `extends`, `presets`, entry points, plugins
3. Follow the reference chain until you can explain exactly why the violated file is accessed

Common causal patterns:

- **Config chain walk-up**: tool reads config, config extends another, chain reaches the violated file (e.g., tsconfig `extends`, eslint config chain, jest preset chain)
- **Directory traversal**: tool scans a directory for matching files and reads everything, including files it won't process (e.g., jest-haste-map scanning `.next/`, eslint reading `.d.ts` alongside `.ts`)
- **Dependency resolution**: tool resolves imports/requires and follows the dependency graph to files outside the project (e.g., esbuild/vite/webpack resolving workspace packages to their dist outputs)
- **Plugin/transformer loading**: tool loads plugins or transformers that read additional files (e.g., ts-jest loading tsconfig for TypeScript compilation)

For any tool, read its source code in `node_modules` to understand its file discovery behavior. Don't assume — trace the actual code.

**You must be able to explain the full path:** e.g., "eslint loads `.eslintrc.json` → configures `@typescript-eslint/parser` → parser resolves `parserOptions.project` → walks up to find `tsconfig.json` → reads it." If you can't trace the full path, keep investigating — do not guess.

**When theoretical analysis is inconclusive, verify empirically.** For difficult cases, instrument `node_modules` with interceptors to capture real stack traces. For example, patch `fs.readFileSync` in the tool's entry point to log stack traces when the violated file is accessed. A confirmed stack trace is worth more than multiple rounds of code reading.

#### Step 3: Confirm the violation with `--check`

**This step is mandatory — do not skip it.** The script already runs `--check` on a sample of up to 5 undeclared files (see `checkSample` in the brief). Review those results first — if the sample files are confirmed as inputs/outputs, the corresponding violations are false positives.

For files not in the sample, use the pre-generated commands from `verificationCommands` in the brief:

```bash
npx nx show target inputs <project>:<target> --check <violated-read-files>
npx nx show target outputs <project>:<target> --check <violated-write-files>
```

If the commands fail because output files don't exist (e.g., the script's task run timed out), run the task first with `verificationCommands.runTask`.

If `--check` shows the file IS already an input/output, the violation is a false positive from the script's static analysis. If it confirms the file is NOT an input/output, proceed to classification.

#### Step 4: Classify

With the causal chain established and the violation confirmed, classify into one of these categories:

1. **Missing input/output** (most common) — the process legitimately needs this file. Understand why:
   - **Direct dependency** — the tool needs this file to do its job (e.g., tsc reads referenced tsconfigs, eslint loads config chain)
   - **Transitive dependency** — a config file references another file that references this one (e.g., jest preset → resolver → module). Trace the full chain.
   - **Directory traversal side effect** — the tool reads all files in a directory even if it only processes some (e.g., eslint reads `.d.ts` files while linting `.ts`). Still a legitimate access from the tool's perspective.

2. **Bad tool configuration** — the tool accesses a file it shouldn't because its scope is too broad. The fix is fixing the tool's config, NOT adding an input. Investigate:
   - Is the command targeting too broad a directory? (e.g., `eslint .` instead of `eslint src/`)
   - Is a config file missing ignore/exclude rules? (e.g., eslint processing a file type it should skip)
   - Is a plugin inferring a target for a project that doesn't match? (e.g., eslint target on a non-JS project)
   - Is an env var causing the tool to behave differently?

3. **Potential sandboxing gap** (last resort) — the access is genuinely irrelevant to correctness (PID files, temp sockets, dev server logs that no task consumes). Only conclude this after exhausting categories 1 and 2.

### Phase 3: Deep Investigation

For violations that aren't immediately obvious, investigate further:

#### If the target is inferred by a plugin

1. Identify which plugin from `inference.plugin` in the brief output, or `nx show project --json` metadata
2. Read the plugin's `createNodesV2` implementation to understand inference logic
3. Determine if this project should have this target at all
4. Check if the plugin has `include`/`exclude` patterns in `nx.json` that should filter this project
5. **Check for input override layers** — `project.json`, `package.json`, or `nx.json` `targetDefaults` may override plugin-inferred inputs, rendering plugin-level fixes invisible. Check all three before concluding a plugin fix is sufficient.

#### If violations come from a subprocess

1. Trace the process tree: which parent spawned the subprocess?
2. Why does the subprocess exist? (dev server for e2e, worker thread, build tool subprocess)
3. What environment does the subprocess inherit? (env vars, cwd)
4. Does the subprocess access files in a different project's directory?

#### If violations involve config file reference chains

1. Read the config file (jest.config, tsconfig, .eslintrc)
2. Trace all file references: `preset`, `extends`, `references`, `setupFiles`, `resolver`, `moduleNameMapper`, `transform`, etc.
3. Recursively resolve references (preset → preset → files)
4. Determine which referenced files are not declared as task inputs

#### If violations involve dependency task outputs

1. Check `dependsOn` to understand task dependency chain
2. Check `dependentTasksOutputFiles` glob pattern — is it too narrow?
3. Compare the glob against actual file types the tool reads from dependencies (e.g., `**/*.d.ts` missing `.tsbuildinfo`)

#### Generalizability analysis

After diagnosing the root cause, determine scope:

1. Is this violation specific to this project, or does it affect all projects using this tool/plugin?
2. What conditions trigger it? (specific config, specific tool version, specific project structure)
3. Should the fix be per-project (declarative input) or systemic (plugin improvement)?
4. If the plugin can be made smarter to infer the correct inputs, that's preferable to manual declarations.

### Phase 4: Output

**You MUST present findings using the structured format below before proceeding to any implementation discussion.** Do not use free-form narrative — the structure ensures completeness and makes findings reviewable.

Present findings grouped by category:

```
=== Sandbox Violation Diagnosis: {project}:{target} ===

## Summary
Unexpected reads:  N total → M validated as declared → K true violations
Unexpected writes: N total → M validated as declared → K true violations

## Findings

### [MISSING INPUT] {short description}
Files: {file list or pattern}
Process: PID {pid} — {command}
Why: {why the process legitimately needs this file}
Scope: {project-specific or affects all projects using this tool/plugin}
Fix: {where/how to add the input declaration — consider both declarative (add input) and systemic (improve plugin inference) options}

### [MISSING OUTPUT] {short description}
Files: {file list or pattern}
Process: PID {pid} — {command}
Why: {why the process produces this file}
Scope: {project-specific or affects all projects using this tool/plugin}
Fix: {where/how to add the output declaration}

### [BAD TOOL CONFIG] {short description}
Files: {file list or pattern}
Process: PID {pid} — {command}
Why: {why the tool accesses files it shouldn't — config too broad, missing ignore, etc.}
Fix: {specific tool config change}

### [POTENTIAL SANDBOXING GAP] {short description}
Files: {file list or pattern}
Process: PID {pid} — {command}
Why: {why this access is irrelevant to correctness}
Evidence: {proof that categories 1-2 were exhausted}

### [INVESTIGATE] {short description}
Files: {file list or pattern}
Notes: {what's known, what needs more info}
Question: {what to ask the user or team}

## Stale Declarations
expectedInputsNotRead: {count and details if relevant}
expectedOutputsNotWritten: {count and details if relevant}

## Verification Plan
For each fix, provide the exact commands to verify:
1. Run the task so output files exist on disk: `npx nx <target> <project> --skip-nx-cache`
2. Check each violation file is now an input: `npx nx show target <project>:<target> inputs --check <space-separated files>`
3. For plugin-level fixes: build the plugin, patch node_modules, then verify with steps 1-2
```

## Principles

1. **Missing declaration is the default.** Most unexpected accesses are legitimate — the process needs the file, it just wasn't declared. Start from this assumption and investigate to understand WHY the access happens.
2. **The command is the unit of analysis.** Don't classify files in isolation. Understand what the command does and whether each file access makes sense given that command's purpose.
3. **Trace the full chain.** Plugin inference → target config → executor → command → file access. The root cause is often several layers removed from the symptom.
4. **Empirical over theoretical.** When code analysis produces a hypothesis, verify it before acting. Instrument `node_modules`, capture stack traces, run with debug flags. Wrong theories waste entire investigation rounds.
5. **Be thorough.** Read plugin source code, config files, executor implementations. Don't guess based on file names alone.
6. **Potential sandboxing gaps are last resort.** Only conclude this after exhausting missing declaration and bad tool config. The access must be genuinely irrelevant to correctness.
7. **Verify claims about Nx behavior in source code.** Any assertion about how Nx works must be traced to the actual implementation. Do not reason from theory or assumptions.
8. **Prefer systemic fixes over per-project declarations.** If a plugin can be improved to infer correct inputs for all projects, that's better than adding manual input declarations to each project.

## Delegating to Subagents

When the investigation is complex and requires parallel research, you can delegate to subagents. Follow this pattern:

1. **Run the context-gathering script yourself first.** The brief output (~3-5KB) is the shared context all subagents need.
2. **Include the brief output in each subagent prompt** along with the specific question to investigate. Subagents should NOT run the script again or try to parse the raw report.
3. **Give subagents the detail file path** so they can `jq` specific sections (process tree, resolved inputs, etc.) without re-running the script.
4. **Each subagent should answer one focused question**, e.g., "Why does PID 12345 (eslint) read `tsconfig.base.json`? Trace the full causal chain from the eslint config."
5. **Subagents must still follow the skill principles** — trace full causal chains, verify empirically, use `--check`, don't guess from file names. Include these instructions in the subagent prompt.
6. **Synthesize subagent results yourself** using the structured Phase 4 output format. Do not delegate the final classification.

## Reference

For the sandbox report data model and field definitions, see `references/data-model.md`.
