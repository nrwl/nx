---
title: Create a Conformance Rule
description: Learn how to create custom conformance rules for Nx Powerpack and Nx Enterprise to enforce standards and best practices across your Nx workspace.
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
✔ What is the description of the rule? · an example of a conformance rule
CREATE packages/my-plugin/local-conformance-rule/local-conformance-rule-example/index.ts
CREATE packages/my-plugin/local-conformance-rule/local-conformance-rule-example/schema.json
```

The generated rule definition file should look like this:

```ts {% fileName="packages/my-plugin/local-conformance-rule/index.ts" %}
import { createConformanceRule, ConformanceViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'local-conformance-rule-example',
  category: 'security',
  description: 'an example of a conformance rule',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

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

Rules should report on the most specific thing that is in violation of the rule. They can report on one or more of the following things within a workspace:

- file - The rule reports on a particular file being in violation of the rule.
- project - The rule reports on a particular project being in violation of the rule, because no one file within it would be applicable to flag up.
- the workspace itself - Sometimes there is no specific file or project that is most applicable to flag up, so the rule can report on the workspace itself.

{% tabs %}
{% tab label="project violation" %}

The `@nx/conformance:ensure-owners` rule provides us an example of how to write a rule that reports on a project being in violation of the rule. The `@nx/owners` plugin adds an `owners` metadata property to every project node that has an owner in the project graph. This rule checks each project node metadata to make sure that each project has some owner defined.

```ts
import { ProjectGraphProjectNode } from '@nx/devkit';
import { createConformanceRule, ConformanceViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'ensure-owners',
  category: 'consistency',
  description: 'Ensure that all projects have owners defined via Nx Owners.',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

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
{% tab label="file violation" %}

This rule uses TypeScript AST processing to ensure that `index.ts` files use a client-side style of export syntax and `server.ts` files use a server-side style of export syntax.

```ts
import { createConformanceRule, ConformanceViolation } from '@nx/conformance';
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
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

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
  const violations: ConformanceViolation[] = [];

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
{% tab label="workspace violation" %}

This rule checks to see if there is a root README.md file in the workspace, and if there is not, it reports on the workspace itself.

```ts
import { workspaceRoot } from '@nx/devkit';
import { createConformanceRule, ConformanceViolation } from '@nx/conformance';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export default createConformanceRule<object>({
  name: 'readme-file',
  category: 'maintainability',
  description: 'The workspace should have a root README.md file',
  implementation: async () => {
    const violations: ConformanceViolation[] = [];

    const readmePath = join(workspaceRoot, 'README.md');
    if (!existsSync(readmePath)) {
      violations.push({
        message: 'The workspace should have a root README.md file',
        workspaceViolation: true,
      });
    }

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
