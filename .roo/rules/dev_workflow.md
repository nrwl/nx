---
description: Guide for using Task Master to manage task-driven development workflows
globs: **/*
alwaysApply: true
---
# Task Master Development Workflow

This guide outlines the typical process for using Task Master to manage software development projects.

## Primary Interaction: MCP Server vs. CLI

Task Master offers two primary ways to interact:

1.  **MCP Server (Recommended for Integrated Tools)**:
    - For AI agents and integrated development environments (like Roo Code), interacting via the **MCP server is the preferred method**.
    - The MCP server exposes Task Master functionality through a set of tools (e.g., `get_tasks`, `add_subtask`).
    - This method offers better performance, structured data exchange, and richer error handling compared to CLI parsing.
    - Refer to [`mcp.md`](mdc:.roo/rules/mcp.md) for details on the MCP architecture and available tools.
    - A comprehensive list and description of MCP tools and their corresponding CLI commands can be found in [`taskmaster.md`](mdc:.roo/rules/taskmaster.md).
    - **Restart the MCP server** if core logic in `scripts/modules` or MCP tool/direct function definitions change.

2.  **`task-master` CLI (For Users & Fallback)**:
    - The global `task-master` command provides a user-friendly interface for direct terminal interaction.
    - It can also serve as a fallback if the MCP server is inaccessible or a specific function isn't exposed via MCP.
    - Install globally with `npm install -g task-master-ai` or use locally via `npx task-master-ai ...`.
    - The CLI commands often mirror the MCP tools (e.g., `task-master list` corresponds to `get_tasks`).
    - Refer to [`taskmaster.md`](mdc:.roo/rules/taskmaster.md) for a detailed command reference.

## Standard Development Workflow Process

-   Start new projects by running `initialize_project` tool / `task-master init` or `parse_prd` / `task-master parse-prd --input='<prd-file.txt>'` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) to generate initial tasks.json
-   Begin coding sessions with `get_tasks` / `task-master list` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) to see current tasks, status, and IDs
-   Determine the next task to work on using `next_task` / `task-master next` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)).
-   Analyze task complexity with `analyze_project_complexity` / `task-master analyze-complexity --research` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) before breaking down tasks
-   Review complexity report using `complexity_report` / `task-master complexity-report` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)).
-   Select tasks based on dependencies (all marked 'done'), priority level, and ID order
-   Clarify tasks by checking task files in tasks/ directory or asking for user input
-   View specific task details using `get_task` / `task-master show <id>` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) to understand implementation requirements
-   Break down complex tasks using `expand_task` / `task-master expand --id=<id> --force --research` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) with appropriate flags like `--force` (to replace existing subtasks) and `--research`.
-   Clear existing subtasks if needed using `clear_subtasks` / `task-master clear-subtasks --id=<id>` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) before regenerating
-   Implement code following task details, dependencies, and project standards
-   Verify tasks according to test strategies before marking as complete (See [`tests.md`](mdc:.roo/rules/tests.md))
-   Mark completed tasks with `set_task_status` / `task-master set-status --id=<id> --status=done` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md))
-   Update dependent tasks when implementation differs from original plan using `update` / `task-master update --from=<id> --prompt="..."` or `update_task` / `task-master update-task --id=<id> --prompt="..."` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md))
-   Add new tasks discovered during implementation using `add_task` / `task-master add-task --prompt="..." --research` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)).
-   Add new subtasks as needed using `add_subtask` / `task-master add-subtask --parent=<id> --title="..."` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)).
-   Append notes or details to subtasks using `update_subtask` / `task-master update-subtask --id=<subtaskId> --prompt='Add implementation notes here...\nMore details...'` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)).
-   Generate task files with `generate` / `task-master generate` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) after updating tasks.json
-   Maintain valid dependency structure with `add_dependency`/`remove_dependency` tools or `task-master add-dependency`/`remove-dependency` commands, `validate_dependencies` / `task-master validate-dependencies`, and `fix_dependencies` / `task-master fix-dependencies` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) when needed
-   Respect dependency chains and task priorities when selecting work
-   Report progress regularly using `get_tasks` / `task-master list`

## Task Complexity Analysis

-   Run `analyze_project_complexity` / `task-master analyze-complexity --research` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) for comprehensive analysis
-   Review complexity report via `complexity_report` / `task-master complexity-report` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) for a formatted, readable version.
-   Focus on tasks with highest complexity scores (8-10) for detailed breakdown
-   Use analysis results to determine appropriate subtask allocation
-   Note that reports are automatically used by the `expand_task` tool/command

## Task Breakdown Process

-   Use `expand_task` / `task-master expand --id=<id>`. It automatically uses the complexity report if found, otherwise generates default number of subtasks.
-   Use `--num=<number>` to specify an explicit number of subtasks, overriding defaults or complexity report recommendations.
-   Add `--research` flag to leverage Perplexity AI for research-backed expansion.
-   Add `--force` flag to clear existing subtasks before generating new ones (default is to append).
-   Use `--prompt="<context>"` to provide additional context when needed.
-   Review and adjust generated subtasks as necessary.
-   Use `expand_all` tool or `task-master expand --all` to expand multiple pending tasks at once, respecting flags like `--force` and `--research`.
-   If subtasks need complete replacement (regardless of the `--force` flag on `expand`), clear them first with `clear_subtasks` / `task-master clear-subtasks --id=<id>`.

## Implementation Drift Handling

-   When implementation differs significantly from planned approach
-   When future tasks need modification due to current implementation choices
-   When new dependencies or requirements emerge
-   Use `update` / `task-master update --from=<futureTaskId> --prompt='<explanation>\nUpdate context...' --research` to update multiple future tasks.
-   Use `update_task` / `task-master update-task --id=<taskId> --prompt='<explanation>\nUpdate context...' --research` to update a single specific task.

## Task Status Management

-   Use 'pending' for tasks ready to be worked on
-   Use 'done' for completed and verified tasks
-   Use 'deferred' for postponed tasks
-   Add custom status values as needed for project-specific workflows

## Task Structure Fields

- **id**: Unique identifier for the task (Example: `1`, `1.1`)
- **title**: Brief, descriptive title (Example: `"Initialize Repo"`)
- **description**: Concise summary of what the task involves (Example: `"Create a new repository, set up initial structure."`)
- **status**: Current state of the task (Example: `"pending"`, `"done"`, `"deferred"`)
- **dependencies**: IDs of prerequisite tasks (Example: `[1, 2.1]`)
    - Dependencies are displayed with status indicators (✅ for completed, ⏱️ for pending)
    - This helps quickly identify which prerequisite tasks are blocking work
- **priority**: Importance level (Example: `"high"`, `"medium"`, `"low"`)
- **details**: In-depth implementation instructions (Example: `"Use GitHub client ID/secret, handle callback, set session token."`) 
- **testStrategy**: Verification approach (Example: `"Deploy and call endpoint to confirm 'Hello World' response."`) 
- **subtasks**: List of smaller, more specific tasks (Example: `[{"id": 1, "title": "Configure OAuth", ...}]`) 
- Refer to task structure details (previously linked to `tasks.md`).

## Configuration Management (Updated)

Taskmaster configuration is managed through two main mechanisms:

1.  **`.taskmasterconfig` File (Primary):**
    *   Located in the project root directory.
    *   Stores most configuration settings: AI model selections (main, research, fallback), parameters (max tokens, temperature), logging level, default subtasks/priority, project name, etc.
    *   **Managed via `task-master models --setup` command.** Do not edit manually unless you know what you are doing.
    *   **View/Set specific models via `task-master models` command or `models` MCP tool.**
    *   Created automatically when you run `task-master models --setup` for the first time.

2.  **Environment Variables (`.env` / `mcp.json`):**
    *   Used **only** for sensitive API keys and specific endpoint URLs.
    *   Place API keys (one per provider) in a `.env` file in the project root for CLI usage.
    *   For MCP/Roo Code integration, configure these keys in the `env` section of `.roo/mcp.json`.
    *   Available keys/variables: See `assets/env.example` or the Configuration section in the command reference (previously linked to `taskmaster.md`).

**Important:** Non-API key settings (like model selections, `MAX_TOKENS`, `LOG_LEVEL`) are **no longer configured via environment variables**. Use the `task-master models` command (or `--setup` for interactive configuration) or the `models` MCP tool.
**If AI commands FAIL in MCP** verify that the API key for the selected provider is present in the `env` section of `.roo/mcp.json`.
**If AI commands FAIL in CLI** verify that the API key for the selected provider is present in the `.env` file in the root of the project.

## Determining the Next Task

- Run `next_task` / `task-master next` to show the next task to work on.
- The command identifies tasks with all dependencies satisfied
- Tasks are prioritized by priority level, dependency count, and ID
- The command shows comprehensive task information including:
    - Basic task details and description
    - Implementation details
    - Subtasks (if they exist)
    - Contextual suggested actions
- Recommended before starting any new development work
- Respects your project's dependency structure
- Ensures tasks are completed in the appropriate sequence
- Provides ready-to-use commands for common task actions

## Viewing Specific Task Details

- Run `get_task` / `task-master show <id>` to view a specific task.
- Use dot notation for subtasks: `task-master show 1.2` (shows subtask 2 of task 1)
- Displays comprehensive information similar to the next command, but for a specific task
- For parent tasks, shows all subtasks and their current status
- For subtasks, shows parent task information and relationship
- Provides contextual suggested actions appropriate for the specific task
- Useful for examining task details before implementation or checking status

## Managing Task Dependencies

- Use `add_dependency` / `task-master add-dependency --id=<id> --depends-on=<id>` to add a dependency.
- Use `remove_dependency` / `task-master remove-dependency --id=<id> --depends-on=<id>` to remove a dependency.
- The system prevents circular dependencies and duplicate dependency entries
- Dependencies are checked for existence before being added or removed
- Task files are automatically regenerated after dependency changes
- Dependencies are visualized with status indicators in task listings and files

## Iterative Subtask Implementation

Once a task has been broken down into subtasks using `expand_task` or similar methods, follow this iterative process for implementation:

1.  **Understand the Goal (Preparation):**
    *   Use `get_task` / `task-master show <subtaskId>` (see [`taskmaster.md`](mdc:.roo/rules/taskmaster.md)) to thoroughly understand the specific goals and requirements of the subtask.

2.  **Initial Exploration & Planning (Iteration 1):**
    *   This is the first attempt at creating a concrete implementation plan.
    *   Explore the codebase to identify the precise files, functions, and even specific lines of code that will need modification.
    *   Determine the intended code changes (diffs) and their locations.
    *   Gather *all* relevant details from this exploration phase.

3.  **Log the Plan:**
    *   Run `update_subtask` / `task-master update-subtask --id=<subtaskId> --prompt='<detailed plan>'`.
    *   Provide the *complete and detailed* findings from the exploration phase in the prompt. Include file paths, line numbers, proposed diffs, reasoning, and any potential challenges identified. Do not omit details. The goal is to create a rich, timestamped log within the subtask's `details`.

4.  **Verify the Plan:**
    *   Run `get_task` / `task-master show <subtaskId>` again to confirm that the detailed implementation plan has been successfully appended to the subtask's details.

5.  **Begin Implementation:**
    *   Set the subtask status using `set_task_status` / `task-master set-status --id=<subtaskId> --status=in-progress`.
    *   Start coding based on the logged plan.

6.  **Refine and Log Progress (Iteration 2+):**
    *   As implementation progresses, you will encounter challenges, discover nuances, or confirm successful approaches.
    *   **Before appending new information**: Briefly review the *existing* details logged in the subtask (using `get_task` or recalling from context) to ensure the update adds fresh insights and avoids redundancy.
    *   **Regularly** use `update_subtask` / `task-master update-subtask --id=<subtaskId> --prompt='<update details>\n- What worked...\n- What didn't work...'` to append new findings.
    *   **Crucially, log:**
        *   What worked ("fundamental truths" discovered).
        *   What didn't work and why (to avoid repeating mistakes).
        *   Specific code snippets or configurations that were successful.
        *   Decisions made, especially if confirmed with user input.
        *   Any deviations from the initial plan and the reasoning.
    *   The objective is to continuously enrich the subtask's details, creating a log of the implementation journey that helps the AI (and human developers) learn, adapt, and avoid repeating errors.

7.  **Review & Update Rules (Post-Implementation):**
    *   Once the implementation for the subtask is functionally complete, review all code changes and the relevant chat history.
    *   Identify any new or modified code patterns, conventions, or best practices established during the implementation.
    *   Create new or update existing rules following internal guidelines (previously linked to `cursor_rules.md` and `self_improve.md`).

8.  **Mark Task Complete:**
    *   After verifying the implementation and updating any necessary rules, mark the subtask as completed: `set_task_status` / `task-master set-status --id=<subtaskId> --status=done`.

9.  **Commit Changes (If using Git):**
    *   Stage the relevant code changes and any updated/new rule files (`git add .`).
    *   Craft a comprehensive Git commit message summarizing the work done for the subtask, including both code implementation and any rule adjustments.
    *   Execute the commit command directly in the terminal (e.g., `git commit -m 'feat(module): Implement feature X for subtask <subtaskId>\n\n- Details about changes...\n- Updated rule Y for pattern Z'`).
    *   Consider if a Changeset is needed according to internal versioning guidelines (previously linked to `changeset.md`). If so, run `npm run changeset`, stage the generated file, and amend the commit or create a new one.

10. **Proceed to Next Subtask:**
    *   Identify the next subtask (e.g., using `next_task` / `task-master next`).

## Code Analysis & Refactoring Techniques

- **Top-Level Function Search**:
    - Useful for understanding module structure or planning refactors.
    - Use grep/ripgrep to find exported functions/constants:
      `rg "export (async function|function|const) \w+"` or similar patterns.
    - Can help compare functions between files during migrations or identify potential naming conflicts.

---
*This workflow provides a general guideline. Adapt it based on your specific project needs and team practices.*