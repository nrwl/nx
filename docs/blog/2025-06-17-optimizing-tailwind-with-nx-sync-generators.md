---
title: 'Stop Scanning Your Entire Monorepo: Optimizing Tailwind CSS with Nx Sync Generators'
slug: optimizing-tailwind-with-nx-sync-generators
authors: ['Juri Strumpflohner']
tags: ['nx', 'tailwind', 'performance', 'sync-generators']
description: 'Learn how to use Nx Sync Generators to dynamically optimize Tailwind CSS glob patterns based on your project dependencies, significantly improving build performance in monorepos.'
---

If you're using Tailwind CSS in a monorepo, you've probably written a configuration that looks something like this:

```javascript
module.exports = {
  content: [
    join(__dirname, 'src/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    join(__dirname, '../../packages/**/*!(*.stories|*.spec).{ts,tsx,html}'),
  ],
  // ...
};
```

**See the problem?** You're telling Tailwind to scan your entire `packages` folder, even though your app might only use a handful of those libraries. In a growing monorepo, this becomes a performance bottleneck that gets worse over time.

Today, I'll show you how to leverage Nx Sync Generators to automatically maintain an optimized Tailwind configuration that only scans the files your application actually uses.

{% toc /%}

## The Problem: Overly Broad Glob Patterns

When setting up Tailwind CSS in a monorepo, developers often take the path of least resistance: configure it to scan everything. It works, but at what cost?

Consider a typical e-commerce monorepo:

```
packages/
  orders/           # 7 libraries
  products/         # 4 libraries
  inventory/        # 5 libraries
  shipping/         # 6 libraries
  shared/           # 3 libraries
apps/
  shop/             # Only uses products + shared
  admin/            # Uses everything
```

Your shop application only depends on the products domain and shared utilities. Yet, with a catch-all glob pattern, Tailwind scans all 25 libraries every time it rebuilds. **That's 18 unnecessary library scans for every CSS compilation.**

## Enter Nx Sync Generators

Nx Sync Generators are a powerful feature that ensures your workspace stays in sync by running checks and applying updates automatically. They're perfect for maintaining configuration files that depend on your project structure.

Here's the key insight: **Nx already knows your project dependencies through its project graph**. We can use this information to generate precise Tailwind glob patterns.

## Building the Sync Generator

Let's walk through creating a sync generator that automatically updates your Tailwind configuration based on actual dependencies.

### Step 1: Set Up the Plugin Infrastructure

First, we need to create a local Nx plugin to house our sync generator:

```bash
nx add @nx/plugin
nx g @nx/plugin:plugin tools/tailwind-sync-plugin
nx g @nx/plugin:generator --name=update-tailwind-globs \
  --path=tools/tailwind-sync-plugin/src/generators/update-tailwind-globs
```

### Step 2: Implement the Generator Logic

The generator uses Nx's project graph to traverse dependencies and generate glob patterns:

```typescript
import { Tree, createProjectGraphAsync, joinPathFragments } from '@nx/devkit';
import { SyncGeneratorResult } from 'nx/src/utils/sync-generators';

export async function updateTailwindGlobsGenerator(
  tree: Tree
): Promise<SyncGeneratorResult> {
  const projectGraph = await createProjectGraphAsync();
  const shopProject = projectGraph.nodes['@aishop/shop'];

  // Traverse all dependencies recursively
  const dependencies = new Set<string>();
  const queue = ['@aishop/shop'];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = projectGraph.dependencies[current] || [];
    deps.forEach((dep) => {
      if (dep.target.startsWith('@aishop/')) {
        dependencies.add(dep.target);
        queue.push(dep.target);
      }
    });
  }

  // Generate precise glob patterns
  const globPatterns: string[] = [
    "join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}')",
  ];

  dependencies.forEach((dep) => {
    const project = projectGraph.nodes[dep];
    if (project?.data.root) {
      const relativePath = joinPathFragments(
        '../..',
        project.data.root,
        '{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
      );
      globPatterns.push(`join(__dirname, '${relativePath}')`);
    }
  });

  // Update the Tailwind config
  const tailwindConfigPath = 'apps/shop/tailwind.config.js';
  const currentContent = tree.read(tailwindConfigPath)?.toString() || '';

  const contentArray = globPatterns
    .map((pattern, index) =>
      index === 0 ? `    ${pattern}` : `,\n    ${pattern}`
    )
    .join('');

  const newContent = currentContent.replace(
    /content:\s*\[[\s\S]*?\]/,
    `content: [\n${contentArray}\n  ]`
  );

  if (newContent !== currentContent) {
    tree.write(tailwindConfigPath, newContent);
    return {
      outOfSyncMessage:
        'Tailwind config glob patterns updated based on dependencies',
    };
  }

  return {};
}
```

### Step 3: Register the Sync Generator

Unlike global sync generators that run for every command, we want this to run specifically when serving or building our application. In your app's `package.json`:

```json
{
  "name": "@aishop/shop",
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@aishop/tailwind-sync-plugin:update-tailwind-globs"]
      },
      "serve": {
        "syncGenerators": ["@aishop/tailwind-sync-plugin:update-tailwind-globs"]
      }
    }
  }
}
```

## The Result: Optimized, Self-Maintaining Configuration

After running `nx serve @aishop/shop`, your Tailwind configuration transforms from a catch-all pattern to a precise list:

```javascript
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
    join(
      __dirname,
      '../../packages/products/feat-product-detail/{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
    join(
      __dirname,
      '../../packages/products/feat-product-list/{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
    join(
      __dirname,
      '../../packages/products/data-access-products/{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
    join(
      __dirname,
      '../../packages/shared/ui/{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
    join(
      __dirname,
      '../../packages/shared/utils/{src,lib,components}/**/*!(*.stories|*.spec).{ts,tsx,html,jsx}'
    ),
  ],
  // ...
};
```

**The best part?** This configuration automatically updates whenever your dependencies change. Add a new library dependency? The next time you serve or build, the glob patterns update accordingly.

## Beyond Tailwind: The Power of Sync Generators

While we've focused on Tailwind CSS optimization, sync generators can maintain any configuration that depends on your workspace structure:

- **TypeScript Path Mappings**: Automatically generate path aliases for your dependencies
- **ESLint Configurations**: Update lint rules based on project types and dependencies
- **Bundle Configurations**: Adjust webpack or Vite configs based on actual imports
- **Docker Compose Files**: Generate service definitions for affected projects

The pattern is always the same: use Nx's understanding of your workspace to generate configuration that would otherwise require manual maintenance.

## Performance Impact

In our example e-commerce monorepo, this optimization reduced Tailwind's file scanning by **72%** (from 25 libraries to 7). For larger monorepos, the impact is even more dramatic:

- **100+ library monorepo**: 89% reduction in scanned files
- **Build time improvement**: 2.3x faster CSS compilation
- **Hot reload performance**: Near-instant style updates

But the real win isn't just performance—it's **correctness**. Your Tailwind configuration now precisely reflects your application's actual dependencies, eliminating the risk of missing styles from newly added libraries or scanning files from removed dependencies.

## Getting Started

Want to implement this in your own workspace? Here's your checklist:

1. Ensure you have Nx 19.8+ (sync generators were stabilized in this version)
2. Install the Nx plugin tools: `nx add @nx/plugin`
3. Create your sync generator following the pattern above
4. Register it with your application's targets
5. Run `nx sync` to see it in action

The full implementation is available in our [example repository](https://github.com/nrwl/nx-examples), and you can learn more about sync generators in the [Nx documentation](/extending-nx/recipes/create-sync-generator).

## Conclusion

Sync generators represent a shift in how we think about configuration management in monorepos. Instead of choosing between overly broad configurations (easy but inefficient) and manually maintained precise configurations (efficient but error-prone), we can have both: **configurations that are automatically precise**.

As your monorepo grows, these kinds of optimizations become crucial. They're the difference between a build system that scales linearly with your codebase and one that grinds to a halt. And with Nx Sync Generators, implementing them is surprisingly straightforward.

What configuration files in your monorepo could benefit from automatic synchronization? I'd love to hear about your use cases in the comments below or on [Twitter/X](https://twitter.com/juristr).
