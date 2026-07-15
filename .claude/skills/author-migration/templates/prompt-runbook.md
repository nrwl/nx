# Prompt .md template (runbook genre)

For files wired as `prompt`. These are executed by an AI agent during agentic migration runs; write them as an operator runbook, not as documentation. Exemplars: `packages/react/src/migrations/update-23-1-0/ai-instructions-for-react-19.md` (whole-framework upgrade), `packages/eslint/src/migrations/update-23-1-0/migrate-ban-types-rule.md` (scoped task with a no-op guard).

Structure:

````markdown
# <Thing> Migration Instructions for LLM

## Overview

One paragraph: what changed upstream, what this migration accomplishes, and what
is out of scope.

## Pre-Migration Checklist

Preconditions to confirm before changing anything. For scoped tasks this is a hard
no-op guard: "Confirm both conditions before changing anything. If either fails,
make no changes and stop."

1. <condition, with the exact command or file check to run>
2. <condition>

## Step 1: <action>

Concrete instructions. Show code shapes:

**Before:**

```ts
<before>
```

**After:**

```ts
<after>
```

## Step 2: <action>

...

## Post-Migration Validation

Concrete commands and the loop to run them until green:

1. `npx nx run-many -t build,test,lint -p <affected projects>`
2. Fix failures caused by this migration and re-run until green.
3. <manual checks that commands cannot cover>

## Nx-Specific Notes

Anything about executors, inferred targets, or workspace layout the upstream guide
does not cover.
````

Rules:

- Hybrid prompts additionally instruct the agent to verify (not redo) the deterministic pre-pass: review the changed files, and treat every advisory-context item as pending work.
- When upstream publishes an npx-runnable codemod, instruct the agent to run it and verify the result rather than reimplementing the transform.
- Scope statements are load-bearing: state explicitly what the agent must not touch.
- The filename must differ from any implementation basename in the same directory (the docs site inlines `<implementation>.md` into public docs).
