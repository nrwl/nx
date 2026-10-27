<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo-light.svg">
    <img alt="Nx Logo" src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.svg" width="140">
  </picture>
</p>

{{links}}

<hr>

# Nx: Smart Monorepos · Fast Builds

Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents.

This package is a [Conformance plugin for Nx](https://nx.dev/docs/reference/conformance/overview). It lets you write and apply rules across your entire workspace that help with consistency, maintainability, reliability and security.

{{content}}

## Writing Conformance Rules

Conformance rule violations can be attributed to one of three levels:

- Entire workspace (e.g. inappropriate global configuration or structure)
- Individual projects (e.g. inappropriate project configuration or structure)
- Individual files (e.g. inappropriate code)

The shape of the violation objects that are returned from the rule implementation will influence this attribution and how they are displayed in the terminal and in the Nx Cloud UI https://cloud.nx.app.

### Context

The rule implementation is passed a `context` object which contains the following properties:

- `tree`: A `ReadOnlyConformanceTree` that can be used to read files from the workspace instead of directly from disk. Useful for unit testing rules as a test tree can be provided to the rule implementation instead (see [Testing Conformance Rules](#testing-conformance-rules) below).
- `projectGraph`: The Nx project graph
- `fileMapCache`: The Nx file map cache
- `ruleOptions`: The resolved rule configuration options based on the current workspace (including Nx Cloud configuration for Nx Cloud Enterprise workspaces)

### Violation Interface

```typescript
interface ConformanceViolation {
  message: string;
  file?: string; // Used if the violation is attributed to a specific file
  sourceProject?: string; // Used if the violation is attributed to a specific project
  workspaceViolation?: boolean; // Used if the violation is attributed to the entire workspace
}
```

If you want to report the entire workspace as being in violation of the rule, you must be explicit by setting `workspaceViolation: true`. This is to avoid missing off both of the optional properties `file` and `sourceProject` by mistake and inadvertently reporting the entire workspace.

The rules runner will validate the return values at runtime to ensure correct usage.

### Rule Structure

```typescript
import { createConformanceRule } from '@nx/conformance';

type RuleOptions = {
  // Rule-specific options
};

export default createConformanceRule<RuleOptions>({
  name: 'my-rule',
  category: 'maintainability',
  description: 'Ensure workspace standards',
  implementation: async (context) => {
    const { projectGraph, fileMapCache, ruleOptions } = context;
    const violations: ConformanceViolation[] = [];

    // Your rule logic here
    violations.push({
      message: 'Violation description',
      file: 'path/to/file.ts',
      sourceProject: 'my-project',
    });

    return {
      severity: 'medium',
      details: { violations },
    };
  },
});
```

### Violation Types & Display

The system automatically displays violations in the most appropriate format:

#### Workspace Violations

When `workspaceViolation: true` is set (required when neither `file` nor `sourceProject` is provided to avoid accidentally reporting the entire workspace):

```
┌  my-rule - maintainability | medium severity | status: enforced
│
🌐  Workspace
│    ▲ Missing required global configuration
│
🌐  Workspace
└    ▲ Invalid workspace settings
```

#### Project + File Violations

When both `sourceProject` and `file` are provided, violations are grouped by project:

```
┌  my-rule - maintainability | medium severity | status: enforced
│
◼  my-lib
│    ▲ Missing proper imports
│    - libs/my-lib/src/file1.ts
│    - libs/my-lib/src/file2.ts
│
◼  my-app
│    ▲ Invalid export pattern
└    - apps/my-app/src/main.ts
```

#### Project-Only Violations

When only `sourceProject` is provided (no specific files):

```
┌  my-rule - maintainability | medium severity | status: enforced
│
◼  my-lib
│    ▲ Missing required configuration
│
◼  my-app
└    ▲ Invalid project structure
```

#### File-Only Violations

When only `file` is provided (the project that owns the file will be automatcally inferred if possible):

```
┌  my-rule - maintainability | medium severity | status: enforced
│
-  .github/workflows/ci.yml
│    ▲ Workflow configuration issue
│
-  README.md
└    ▲ Missing license header
```

### Violation Priority & Ordering

The terminal reporter displays violations in the following order for optimal clarity:

1. **Workspace violations** (most global scope) - shown first with 🌐 symbol
2. **Project violations** (grouped by project) - shown with ◼ symbol
3. **File violations** (ungrouped) - shown with - symbol

### Automatic Project Inference

If you provide a `file` path without a `sourceProject`, the system will automatically infer the owning project from the Nx project file map when possible. This allows you to write simpler rules:

```typescript
violations.push({
  message: 'File violates standards',
  file: 'libs/my-lib/src/problematic.ts', // sourceProject auto-inferred as 'my-lib'
});
```

### Best Practices

1. **Use `workspaceViolation: true`** for issues affecting the entire workspace (global configs, workspace structure, etc.)
2. **Use `sourceProject` only** for project-wide issues (missing configuration, structure problems)
3. **Use `file` (and optional explicit `sourceProject`)** for violations tied to specific files in projects
4. **Use `file` only** for files that may not belong to projects (CI configs, root files, etc.)

### Example Rule

```typescript
import { createConformanceRule } from '@nx/conformance';

type RuleOptions = object;

export default createConformanceRule<RuleOptions>({
  name: 'enforce-standards',
  category: 'maintainability',
  description: 'Enforce various workspace standards',
  implementation: async ({ projectGraph, fileMapCache, ruleOptions }) => {
    const violations = [];

    // Workspace-level violation
    violations.push({
      message: 'Workspace missing required configuration',
      workspaceViolation: true, // required when neither file nor sourceProject is provided
    });

    // Project-level violation
    for (const [name, project] of Object.entries(projectGraph.nodes)) {
      if (!project.data.targets?.build) {
        violations.push({
          message: 'Project missing build target',
          sourceProject: name,
        });
      }
    }

    // File-level violation (project auto-inferred)
    violations.push({
      message: 'Missing license header',
      file: 'libs/utils/src/index.ts',
    });

    return {
      severity: 'medium',
      details: { violations },
    };
  },
});
```

### Auto-fixing Violations with Fix Generators

Rules can optionally implement a `fixGenerator` function that will be used to automatically fix violations.

#### When fix generators run

- `nx conformance`: evaluates rules and applies any available fix generators. Changes are written to disk and rules are evaluated once more to calculate how many violations were fixed.
- Fix generators are only ever applied for rules whose final status is not `disabled`.
- `nx conformance:check`: evaluates rules only. Fix generators are not applied (useful for CI).

#### Function signature

Fix generators are essentially standard Nx generators. They receive a `WritableConformanceTree` (an extension of the `FsTree` used in other Nx generators) and a schema containing violations, rule options, and optional extra data exposed by the rule implementation via `result.details.fixGeneratorData`.

```ts
type ConformanceRuleFixGenerator<RuleOptions> = (
  tree: WritableConformanceTree,
  schema: {
    violations: ConformanceViolation[];
    ruleOptions: RuleOptions;
    fixGeneratorData?: Record<string, unknown>;
  }
) => Promise<void> | void;
```

To reiterate, during rule evaluation (diagnostics phase) the `tree` is read-only. During the fix phase, the `tree` is writable for generators to be able to modify files.

#### Passing data from rules to fix generators

There are two supported ways to pass data from your rule implementation to its fix generator:

- **violations (per-item data)**: The exact `details.violations` array returned by your rule is provided to the fix generator. Each violation can carry provide `fixGeneratorData` for targeted fixes.

  - Note: Before final results are reported, any `fixGeneratorData` fields are stripped out.

- **details-level fixGeneratorData (global data)**: Put shared data on `details.fixGeneratorData`. If present, it will be passed as `schema.fixGeneratorData` to the fix generator and then stripped from the final report.

  - Useful for expensive precomputed lookups or workspace-wide context that applies to all violations.

Additional notes:

- **Project filtering**: If the rule is configured with `projects`, the runner filters the violations accordingly before calling the fix generator. The generator receives only the filtered set.
- **File-to-project inference**: If a violation specifies `file` but not `sourceProject`, the runner attempts to infer the owning project and will include that on the violation provided to the fix generator where possible.
- **Data privacy**: Both `details.fixGeneratorData` and per-violation `fixGeneratorData` are never included in the emitted report. They are only available to the fix generator.

#### Example: rule with per-violation data and a fix generator

```ts
import { createConformanceRule } from '@nx/conformance';
import type { ConformanceViolation } from '@nx/conformance';

type RuleOptions = {
  addHeader: boolean;
};

export default createConformanceRule<RuleOptions>({
  name: 'license-header',
  category: 'maintainability',
  description: 'Ensure files contain a license header',
  implementation: async ({ tree, ruleOptions }) => {
    const violations: ConformanceViolation[] = [];

    for (const filePath of tree.children('libs/my-lib/src')) {
      if (!filePath.endsWith('.ts')) continue;
      const contents = tree.read(filePath, 'utf-8') ?? '';
      if (!contents.startsWith('/* LICENSE */')) {
        violations.push({
          message: 'Missing license header',
          file: `libs/my-lib/src/${filePath}`,
          // Per-violation data the fix generator can use
          fixGeneratorData: { header: '/* LICENSE */\n', missing: true },
        });
      }
    }

    return {
      severity: 'low',
      details: {
        violations,
        // Global data available to the fix generator only
        fixGeneratorData: { dryRun: ruleOptions.addHeader === false },
      },
    };
  },
  fixGenerator: async (tree, { violations, ruleOptions, fixGeneratorData }) => {
    if (fixGeneratorData?.dryRun) return; // example usage of global data

    for (const v of violations) {
      if (!('file' in v) || !v.file) continue;
      const header = (v as any).fixGeneratorData?.header ?? '/* LICENSE */\n';
      const existing = tree.read(v.file, 'utf-8') ?? '';
      if (!existing.startsWith(header) && ruleOptions.addHeader !== false) {
        tree.write(v.file, header + existing);
      }
    }
  },
});
```

#### Best practices for fix generators

- **Idempotent**: Generators should be safe to run multiple times without changing files after the first successful run.
- **Minimal changes**: Modify only what is necessary to address the reported violations.
- **Respect options**: Honor `ruleOptions` so users can tune behavior.
- **Avoid re-discovery**: Prefer using the provided `violations` and optional `fixGeneratorData` rather than rescanning the workspace.
- **Clear boundaries**: Keep heavy computation inside the rule implementation and pass the results via `fixGeneratorData` to the generator.

## Testing Conformance Rules

There is a dedicated `@nx/conformance/testing` entrypoint which provides utilities for testing conformance rules.

It's recommended for all conformance rule tests to follow the same pattern using `createReadOnlyTree` and `createStubbedProjectGraphAndFileMapCache` when setting up test workspaces:

```ts
import type { ReadOnlyConformanceTree } from '@nx/conformance';
import {
  applyProjectNodesAndFiles,
  createReadOnlyTree,
  createStubbedProjectGraphAndFileMapCache,
} from '@nx/conformance/testing';
import type { ProjectGraph } from '@nx/devkit';
import type { FileMapCache } from 'nx/src/project-graph/nx-deps-cache';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import rule from './index';

describe('my-rule', () => {
  let tree: ReadOnlyConformanceTree;
  let projectGraph: ProjectGraph;
  let fileMapCache: FileMapCache;
  let cleanup: () => void;

  beforeEach(async () => {
    // Create the test workspace in a temporary directory and return a read-only tree and a cleanup function
    ({ tree, cleanup } = await createReadOnlyTree());
    // Prepare a stubbed project graph and file map cache for the test workspace
    ({ projectGraph, fileMapCache } =
      await createStubbedProjectGraphAndFileMapCache(tree, [
        // Optionally add projects and files to the tree, project graph and file map cache if the rule implementation needs them
        // This can also be done later in specific tests using the `applyProjectNodesAndFiles` function
      ]));
  });

  // Invoke the cleanup function to remove the generated temporary directory after each test
  afterEach(() => cleanup());

  it('should return a violation when something specific happens', async () => {
    // Optionally add projects and files to the tree, project graph and file map cache if the rule implementation needs them
    applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
      {
        projectNode: {
          name: 'my-lib',
          type: 'lib',
          data: {
            root: 'libs/my-lib',
          },
        },
        projectFiles: [
          // If our specific rule needs to know about project graph dependencies, we add them like so
          // In this example this entry causes my-lib to depend on my-app on the project graph and have it correctly attributed to my-lib in the file map cache
          {
            projectRootRelativeFile: 'src/index.ts',
            depsItCreates: ['my-app'],
          },
        ],
      },
      {
        projectNode: {
          name: 'my-app',
          type: 'app',
          data: {
            root: 'apps/my-app',
          },
        },
      },
    ]);

    const result = await rule.implementation({
      tree,
      projectGraph,
      fileMapCache,
      ruleOptions: {},
    });

    expect(result.details.violations).toMatchInlineSnapshot(`
      // YOUR SNAPSHOT HERE
    `);
  });
});
```

### Adding Files to the Test Workspace on setup

You can optionally provide an async callback to `createReadOnlyTree` to add files or even run Nx generators before the tests run:

```ts
const { tree, cleanup } = await createReadOnlyTree(async (writableTree) => {
  // Add files to the tree before it becomes read-only
  writableTree.write(
    'libs/my-lib/custom-config.json',
    JSON.stringify({ setting: 'value' })
  );
  // Some Nx generator
  await libraryGenerator(
    tree // ...
  );
});
```

### Testing Fix Generators

If your rule includes a fix generator, you can test it by converting the read-only tree to a writable one using `convertToWritable` and then running the fix generator:

```ts
import { convertToWritable, convertToReadOnly } from '@nx/conformance/testing';

it('should fix violations when fix generator is applied', async () => {
  // ... setup and rule implementation test ...

  // Convert to a WritableConformanceTree and run fix generator
  const writableTree = convertToWritable(tree);
  await rule.fixGenerator(writableTree, {
    violations: result.details.violations,
    ruleOptions: {},
  });

  const resultAfterFix = await rule.implementation({
    // Convert back to a ReadOnlyConformanceTree for the rule implementation and verify the fix worked
    tree: convertToReadOnly(writableTree),
    projectGraph,
    fileMapCache,
    ruleOptions: {},
  });

  expect(resultAfterFix.details.violations).toMatchInlineSnapshot(`[]`);
});
```

### Available Testing Utilities

The `@nx/conformance/testing` package exports the following utilities:

- **`createReadOnlyTree(callback?)`** - Creates a read-only tree with a basic Nx workspace structure. Returns `Promise<{ tree, cleanup }>`.
- **`createStubbedProjectGraphAndFileMapCache(tree, projectNodesWithFiles)`** - Creates a stubbed project graph and file map cache for testing. Returns `Promise<{ projectGraph, fileMapCache }>`.
- **`applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, projectNodesWithFiles)`** - Adds projects and files to the test workspace.
- **`convertToWritable(tree)`** - Converts a `ReadOnlyConformanceTree` to a `WritableConformanceTree` for fix generator testing.
- **`convertToReadOnly(tree)`** - Converts a `WritableConformanceTree` back to a`ReadOnlyConformanceTree`.
- **`type ProjectNodesWithFiles`** - A type that represents the projects and files to be added to the test workspace.

## Writing performant conformance rules

Each rule will show its respective execution time and you can use this to identify rules that are slow to run.

### Avoid blocking the main thread

Sometimes you may notice that a rule that seems to take a while to complete when run as part of the full rule set but is much faster when run individually. This is because another rule is blocking the main thread. Conformance rules are executed in parallel on the main thread so it is important to avoid blocking actions in a particular rule or it will impact the execution of others.
