---
name: nx-generate
description: Generate code using nx generators. USE WHEN scaffolding code or transforming existing code - for example creating libraries or applications, or anything else that is boilerplate code or automates repetitive tasks. ALWAYS use this first when generating code with Nx instead of calling MCP tools or running nx generate immediately.
---

# Run Nx Generator

Nx generators are powerful tools that scaffold projects, make automated code migrations or automate repetitive tasks in a monorepo. They ensure consistency across the codebase and reduce boilerplate work.

This skill applies when the user wants to:

- Create new projects like libraries or applications
- Scaffold features or boilerplate code
- Run workspace-specific or custom generators
- Do anything else that an nx generator exists for

## Generator Discovery Flow

### Step 1: List Available Generators

Use the Nx CLI to discover available generators:

- List all generators for a plugin: `npx nx list @nx/react`
- View available plugins: `npx nx list`

This includes:

- Plugin generators (e.g., `@nx/react:library`, `@nx/js:library`)
- Local workspace generators (defined in the repo's own plugins)

### Step 2: Match Generator to User Request

Based on the user's request, identify which generator(s) could fulfill their needs. Consider:

- What artifact type they want to create (library, application, etc.)
- Which framework or technology stack is relevant
- Whether they mentioned specific generator names

**IMPORTANT**: When both a local workspace generator and an external plugin generator could satisfy the request, **always prefer the local workspace generator**. Local generators are customized for the specific repo's patterns and conventions.

It's possible that the user request is something that no Nx generator exists for whatsoever. In this case, you can stop using this skill and try to help the user another way. HOWEVER, the burden of proof for this is high. Before aborting, carefully consider each and every generator that's available. Look into details for any that could be related in any way before making this decision.

## Pre-Execution Checklist

Before running any generator, complete these steps:

### 1. Fetch Generator Schema

Use the `--help` flag to understand all available options:

```bash
npx nx g @nx/react:library --help
```

Pay attention to:

- Required options that must be provided
- Optional options that may be relevant to the user's request
- Default values that might need to be overridden

### 2. Read Generator Source Code

Understanding what the generator actually does helps you:

- Know what files will be created/modified
- Understand any side effects (updating configs, installing deps, etc.)
- Identify options that might not be obvious from the schema

To find generator source code:

- For plugin generators: Use `node -e "console.log(require.resolve('@nx/<plugin>/generators.json'));"` to find the generators.json, then locate the source from there
- If that fails, read directly from `node_modules/<plugin>/generators.json`
- For local generators: They are typically in `tools/generators/` or a local plugin directory. You can search the repo for the generator name to find it.

### 2.5 Reevaluate if the generator is right

Once you have built up an understanding of what the selected generator does, reconsider: Is this the right generator to service the user request?
If not, it's okay to go back to the Generator Discovery Flow and select a different generator before proceeding. If you do, make sure to go through the entire pre-execution checklist once more.

### 3. Understand Repo Context

Before generating, examine the target area of the codebase:

- Look at similar existing artifacts (other libraries, applications, etc.)
- Identify patterns and conventions used in the repo
- Note naming conventions, file structures, and configuration patterns
- Try to match these patterns when configuring the generator

For example, if similar libraries are using a specific test runner, build tool or linter, try to match that if possible.
If projects or other artifacts are organized with a specific naming convention, try to match it.

### 4. Validate Required Options

Ensure all required options have values:

- Map the user's request to generator options
- Infer values from context where possible
- Ask the user for any critical missing information

## Execution

Keep in mind that you might have to prefix things with npx/pnpx/yarn if the user doesn't have nx installed globally.
Many generators will behave differently based on where they are executed. For example, first-party nx library generators use the cwd to determine the directory that the library should be placed in. This is highly important.

### Consider Dry-Run (Optional)

Running with `--dry-run` first is strongly encouraged but not mandatory. Use your judgment:

- For complex generators or unfamiliar territory: do a dry-run first
- For simple, well-understood generators: may proceed directly
- Dry-run shows file names and created/deleted/modified markers, but not content
- There are cases where a generator does not support dry-run (for example if it had to install an npm package) - in that case --dry-run might fail. Don't be discouraged but simply move on to running the generator for real and iterating from there.

### Running the Generator

Execute the generator with:

```bash
nx generate <generator-name> <options> --no-interactive
```

**CRITICAL**: Always include `--no-interactive` to prevent prompts that would hang the execution.

Example:

```bash
nx generate @nx/react:library --name=my-utils --no-interactive
```

### Handling Generator Failures

If the generator fails:

1. **Diagnose the error** - Read the error message carefully
2. **Identify the cause** - Missing options, invalid values, conflicts, etc.
3. **Attempt automatic fix** - Adjust options or resolve conflicts
4. **Retry** - Run the generator again with corrected options

Common failure reasons:

- Missing required options
- Invalid option values
- Conflicting with existing files
- Missing dependencies
- Generator doesn't support certain flag combinations

## Post-Generation

### 1. Modify Generated Code (If Needed)

Generators provide a starting point, but the output may need adjustment to match the user's specific requirements:

- Add or modify functionality as requested
- Adjust imports, exports, or configurations
- Integrate with existing code patterns in the repo

### 2. Format Code

Run formatting on all generated/modified files:

```bash
nx format --fix
```

Languages other than javascript/typescript might need other formatting invocations too.

### 3. Run Verification

Verify that the generated code works correctly. What this looks like will vary depending on the type of generator and the targets available.
If the generator created a new project, run its targets directly
Use your best judgement to determine what needs to be verified.

Example:

```bash
nx lint <new-project>
nx test <new-project>
nx build <new-project>
```

### 4. Handle Verification Failures

When verification fails:

**If scope is manageable** (a few lint errors, minor type issues):

- Fix the issues
- Re-run verification to confirm

**If issues are extensive** (many errors, complex problems):

- Attempt simple, obvious fixes first
- If still failing, escalate to the user with:
  - Description of what was generated
  - What verification is failing
  - What you've attempted to fix
  - Remaining issues that need user input

## Error Handling

### Generator Failures

- Check the error message for specific causes
- Verify all required options are provided
- Check for conflicts with existing files
- Ensure the generator name and options are correct

### Missing Options

- Consult the generator schema for required fields
- Infer values from context when reasonable
- Ask the user for values that cannot be inferred

## Key Principles

1. **Local generators first** - Always prefer workspace/local generators over external plugin generators when both could work

2. **Understand before running** - Read both the schema AND the source code to fully understand what will happen

3. **No prompts** - Always use `--no-interactive` to prevent hanging

4. **Generators are starting points** - Modify the output as needed to fully satisfy the user's requirements

5. **Verify changes work** - Don't just generate; ensure the code builds, lints, and tests pass

6. **Be proactive about fixes** - Don't just report errors; attempt to resolve them automatically when possible

7. **Match repo patterns** - Study existing similar code in the repo and match its conventions
