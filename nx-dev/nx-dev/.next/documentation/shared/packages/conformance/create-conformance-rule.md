---
title: Create a Conformance Rule
description: Learn how to create custom conformance rules for Nx Powerpack to enforce standards and best practices across your Nx workspace.
---

# Create a Conformance Rule

For local conformance rules, the resolution utilities from `@nx/js` are used in the same way they are for all other JavaScript/TypeScript files in Nx. Therefore, you can simply reference an adhoc JavaScript file or TypeScript file in your `"rule"` property (as long as the path is resolvable based on your package manager and/or tsconfig setup), and the rule will be loaded/transpiled as needed. The rule implementation file should also have a `schema.json` file next to it that defines the available rule options, if any.

Therefore, in practice, writing your local conformance rules in an Nx generated library is the easiest way to organize them and ensure that they are easily resolvable via TypeScript. The library in question could also be an Nx plugin, but it does not have to be.

To write your own conformance rule, run the `@nx/conformance:create-rule` generator and answer the prompts.

```text {% command="nx g @nx/conformance:create-rule" %}
 NX  Generating @nx/conformance:create-rule

✔ What is the name of the rule? · local-conformance-rule-example
✔ Which directory do you want to create the rule directory in? · packages/my-plugin/local-conformance-rule
✔ What category does this rule belong to? · security
✔ What reporter do you want to use for this rule? · project-reporter
✔ What is the description of the rule? · an example of a conformance rule
CREATE packages/my-plugin/local-conformance-rule/local-conformance-rule-example/index.ts
CREATE packages/my-plugin/local-conformance-rule/local-conformance-rule-example/schema.json
```

The generated rule definition file should look like this:

```ts {% fileName="packages/my-plugin/local-conformance-rule/index.ts" %}
import { createConformanceRule, ProjectViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'local-conformance-rule-example',
  category: 'security',
  description: 'an example of a conformance rule',
  reporter: 'project-reporter',
  implementation: async (context) => {
    const violations: ProjectViolation[] = [];

    return {
      severity: 'low',
      details: {
        violations,
      },
    };
  },
});
```

To enable the rule, you need to register it in the `nx.json` file.

```json {% fileName="nx.json" %}
{
  "conformance": {
    "rules": [
      {
        "rule": "./packages/my-plugin/local-conformance-rule/index.ts"
      }
    ]
  }
}
```

Note that the severity of the error is defined by the rule author and can be adjusted based on the specific violations that are found.

## Conformance Rule Examples

There are three types of reporters that a rule can use.

- `project-reporter` - The rule evaluates an entire project at a time.
- `project-files-reporter` - The rule evaluates a single project file at a time.
- `non-project-files-reporter` - The rule evaluates files that don't belong to any project.

{% tabs %}
{% tab label="project-reporter" %}

The `@nx/conformance:ensure-owners` rule provides us an example of how to write a `project-reporter` rule. The `@nx/owners` plugin adds an `owners` metadata property to every project node that has an owner in the project graph. This rule checks each project node metadata to make sure that each project has some owner defined.

```ts
import { ProjectGraphProjectNode } from '@nx/devkit';
import { createConformanceRule, ProjectViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'ensure-owners',
  category: 'consistency',
  description: 'Ensure that all projects have owners defined via Nx Owners.',
  reporter: 'project-reporter',
  implementation: async (context) => {
    const violations: ProjectViolation[] = [];

    for (const node of Object.values(
      context.projectGraph.nodes
    ) as ProjectGraphProjectNode[]) {
      const metadata = node.data.metadata;
      if (!metadata?.owners || Object.keys(metadata.owners).length === 0) {
        violations.push({
          sourceProject: node.name,
          message: `This project currently has no owners defined via Nx Owners.`,
        });
      }
    }

    return {
      severity: 'medium',
      details: {
        violations,
      },
    };
  },
});
```

{% /tab %}
{% tab label="project-files-reporter" %}

This rule uses TypeScript AST processing to ensure that `index.ts` files use a client-side style of export syntax and `server.ts` files use a server-side style of export syntax.

```ts
import { createConformanceRule, ProjectFilesViolation } from '@nx/conformance';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createSourceFile,
  isExportDeclaration,
  isStringLiteral,
  isToken,
  ScriptKind,
  ScriptTarget,
} from 'typescript';

export default createConformanceRule({
  name: 'server-client-public-api',
  category: 'consistency',
  description: 'Ensure server-only and client-only public APIs are not mixed',
  reporter: 'project-files-reporter',
  implementation: async ({ projectGraph }) => {
    const violations: ProjectFilesViolation[] = [];

    for (const nodeId in projectGraph.nodes) {
      const node = projectGraph.nodes[nodeId];

      const sourceRoot = node.data.root;

      const indexPath = join(sourceRoot, 'src/index.ts');
      const serverPath = join(sourceRoot, 'src/server.ts');

      if (existsSync(indexPath)) {
        const fileContent = readFileSync(indexPath, 'utf8');
        violations.push(
          ...processEntryPoint(fileContent, indexPath, nodeId, 'client')
        );
      }

      if (existsSync(serverPath)) {
        const fileContent = readFileSync(serverPath, 'utf8');
        violations.push(
          ...processEntryPoint(fileContent, serverPath, nodeId, 'server')
        );
      }
    }

    return {
      severity: 'medium',
      details: { violations },
    };
  },
});

export function processEntryPoint(
  fileContent: string,
  entryPoint: string,
  project: string,
  style: 'server' | 'client'
) {
  const violations: ProjectFilesViolation[] = [];

  const sf = createSourceFile(
    entryPoint,
    fileContent,
    ScriptTarget.Latest,
    true,
    ScriptKind.TS
  );

  let hasNotOnlyExports = false;
  sf.forEachChild((node) => {
    if (isExportDeclaration(node)) {
      const moduleSpecifier =
        node.moduleSpecifier && isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.getText()
          : '';

      if (isModuleSpecifierViolated(moduleSpecifier, style)) {
        if (
          violations.find(
            (v) => v.file === entryPoint && v.sourceProject === project
          )
        ) {
          // we already have a violation for this file and project, so we don't need to add another one
          return;
        }

        violations.push({
          message:
            style === 'client'
              ? 'Client-side only entry point cannot export from server-side modules'
              : 'Server-side only entry point can only export server-side modules ',
          file: entryPoint,
          sourceProject: project,
        });
      }
    } else if (isToken(node) && node === sf.endOfFileToken) {
      // do nothing
    } else {
      hasNotOnlyExports = true;
    }
  });

  if (hasNotOnlyExports) {
    violations.push({
      message: `Entry point should only contain exported APIs`,
      file: entryPoint,
      sourceProject: project,
    });
  }

  return violations;
}

function isModuleSpecifierViolated(
  moduleSpecifier: string,
  style: 'server' | 'client'
) {
  // should not get here. if this is the case, it's a grammar error in the source code.
  if (!moduleSpecifier) return false;

  if (style === 'server' && !moduleSpecifier.includes('.server')) {
    return true;
  }

  if (style === 'client' && moduleSpecifier.includes('.server')) {
    return true;
  }

  return false;
}
```

{% /tab %}
{% tab label="non-project-files-reporter" %}

This rule checks the root `package.json` file and ensures that if the `tmp` package is included as a dependency, it has a minimum version of 0.2.3.

```ts
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import {
  createConformanceRule,
  NonProjectFilesViolation,
} from '@nx/conformance';
import { join } from 'node:path';
import { satisfies } from 'semver';

export default createConformanceRule<object>({
  name: 'package-tmp-0.2.3',
  category: 'maintainability',
  description: 'The tmp dependency should be a minimum version of 0.2.3',
  reporter: 'non-project-files-reporter',
  implementation: async () => {
    const violations: NonProjectFilesViolation[] = [];
    const applyViolationIfApplicable = (version: string | undefined) => {
      if (version && !satisfies(version, '>=0.2.3')) {
        violations.push({
          message: 'The "tmp" package must be version "0.2.3" or higher',
          file: 'package.json',
        });
      }
    };

    const workspaceRootPackageJson = await readJsonFile(
      join(workspaceRoot, 'package.json')
    );
    applyViolationIfApplicable(workspaceRootPackageJson.dependencies?.['tmp']);
    applyViolationIfApplicable(
      workspaceRootPackageJson.devDependencies?.['tmp']
    );

    return {
      severity: 'low',
      details: {
        violations,
      },
    };
  },
});
```

{% /tab %}
{% /tabs %}

## Share Conformance Rules Across Workspaces

If you have an Enterprise Nx Cloud contract, you can share your conformance rules across every repository in your organization. Read more in these articles:

- [Publish Conformance Rules to Nx Cloud](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud)
- [Configure Conformance Rules in Nx Cloud](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud)
