import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addBuildTargetToComponentTestingPreset } from './add-build-target-to-ct-preset';

describe('addBuildTargetToComponentTestingPreset', () => {
  it.each([
    ['a', 'a || "myapp:build"'],
    ['a.b', 'a.b || "myapp:build"'],
    ['a()', 'a() || "myapp:build"'],
    [`''`, `'' || "myapp:build"`],
    ['`x${a}`', '`x${a}` || "myapp:build"'],
    ['<string>a', '<string>a || "myapp:build"'],
    ['{}', '{} || "myapp:build"'],
    ['await a', 'await a || "myapp:build"'],
    ['a || b', 'a || b || "myapp:build"'],
    ['a && b', 'a && b || "myapp:build"'],
    ['a ? b : c', '(a ? b : c) || "myapp:build"'],
    ['a ? b : c ?? d', '(a ? b : c ?? d) || "myapp:build"'],
    ['a ?? b', '(a ?? b) || "myapp:build"'],
    ['a ?? b ?? c', '(a ?? b ?? c) || "myapp:build"'],
    ['a = b', '(a = b) || "myapp:build"'],
    ['a ??= b', '(a ??= b) || "myapp:build"'],
    ['x => y', '(x => y) || "myapp:build"'],
    ['async () => y', '(async () => y) || "myapp:build"'],
    ['(x) => x', '((x) => x) || "myapp:build"'],
    ['(a)', '(a) || "myapp:build"'],
    ['(a ?? b)', '(a ?? b) || "myapp:build"'],
  ])('should add the fallback to buildTarget: %s', (value, expected) => {
    const tree = createTreeWithEmptyWorkspace();
    const config = (buildTarget: string) =>
      `export default defineConfig({ component: nxComponentTestingPreset(__filename, { buildTarget: ${buildTarget} }) });`;
    tree.write('cypress.config.ts', config(value));

    expect(
      addBuildTargetToComponentTestingPreset(
        tree,
        'cypress.config.ts',
        'myapp:build'
      )
    ).toBe(true);
    expect(tree.read('cypress.config.ts', 'utf-8')).toBe(config(expected));
  });
});
