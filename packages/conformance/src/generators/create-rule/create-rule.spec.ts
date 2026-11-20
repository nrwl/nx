import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRuleGenerator } from './create-rule';

describe('createRuleGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a rule directory and index.ts and schema.json based on the given options', async () => {
    await createRuleGenerator(tree, {
      name: 'test-rule',
      directory: 'packages/nx-plugin/src/conformance-rules',
      category: 'consistency',
      description: 'Some description here',
    });

    expect(
      tree
        .read('packages/nx-plugin/src/conformance-rules/test-rule/schema.json')
        ?.toString()
    ).toMatchInlineSnapshot(`
"{
  "$schema": "http://json-schema.org/schema",
  "$id": "test-rule",
  "title": "test-rule rule configuration",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
"
`);

    expect(
      tree
        .read('packages/nx-plugin/src/conformance-rules/test-rule/index.ts')
        ?.toString()
    ).toMatchInlineSnapshot(`
"import { createConformanceRule, ConformanceViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'test-rule',
  category: 'consistency',
  description: 'Some description here',
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
"
`);
  });
});
