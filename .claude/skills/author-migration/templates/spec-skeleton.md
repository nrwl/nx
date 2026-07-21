# Migration spec skeleton

Colocated as `<name>.spec.ts`. Arrange with tree writes, act by calling the imported default export, assert with explicit reads. Inside `packages/nx`, import the tree util relatively (`../../generators/testing-utils/create-tree-with-empty-workspace`) instead of `@nx/devkit/testing`.

```ts
import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-foo-option';

describe('remove-foo-option migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove the foo option from build targets', async () => {
    // arrange: addProjectConfiguration(tree, ...) or tree.write(...)

    await update(tree);

    // assert with explicit reads
    // expect(readJson(tree, 'apps/app1/project.json').targets.build.options.foo).toBeUndefined();
  });

  it('should not change projects that do not use the executor', async () => {
    tree.write('apps/other/project.json', originalContent);

    await update(tree);

    expect(tree.read('apps/other/project.json', 'utf-8')).toEqual(
      originalContent
    );
  });

  it('should be a no-op when run twice', async () => {
    await update(tree);
    const afterFirstRun = tree.read('apps/app1/project.json', 'utf-8');

    await update(tree);

    expect(tree.read('apps/app1/project.json', 'utf-8')).toEqual(afterFirstRun);
  });
});
```

Rules:

- Explicit assertions or `toMatchInlineSnapshot`. Never `toMatchSnapshot` (external snapshot files); no migration spec in the repo uses it.
- The mandatory case list (negative, idempotency, malformed-input, multi-edit, precedence, list-sanity, reproduced-behavior, each with its trigger) lives in SKILL.md section 5; the skeleton above shows the negative and idempotency shapes.
- Prompt-only migrations get no spec file; there is no implementation to import.
- Any migration returning `{ nextSteps, agentContext }` (hybrid or not): assert on the return value.

```ts
const result = await update(tree);
expect(result.nextSteps).toContainEqual(expect.stringContaining('...'));
expect(result.agentContext).toContainEqual(expect.stringContaining('...'));
```
