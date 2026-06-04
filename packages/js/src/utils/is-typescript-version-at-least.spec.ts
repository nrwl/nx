import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { coerce } from 'semver';
import { isTypescriptVersionAtLeast } from './is-typescript-version-at-least';
import { typescriptVersion } from './versions';

describe('isTypescriptVersionAtLeast', () => {
  it.each`
    declared          | version    | expected
    ${'~5.9.2'}       | ${'6.0.0'} | ${false}
    ${'~6.0.3'}       | ${'6.0.0'} | ${true}
    ${'^5.8.0'}       | ${'5.8.0'} | ${true}
    ${'>=5.8 <6.0'}   | ${'6.0.0'} | ${false}
    ${'6.0.0-beta.1'} | ${'6.0.0'} | ${true}
    ${'latest'}       | ${'6.0.0'} | ${true}
    ${'next'}         | ${'6.0.0'} | ${true}
  `(
    'returns $expected for declared "$declared" against "$version"',
    ({ declared, version, expected }) => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { typescript: declared },
      }));

      expect(isTypescriptVersionAtLeast(tree, version)).toBe(expected);
    }
  );

  it('reads typescript from "dependencies" as well', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { typescript: '~6.0.3' },
    }));

    expect(isTypescriptVersionAtLeast(tree, '6.0.0')).toBe(true);
  });

  it('assumes the default install version when typescript is not declared', () => {
    const tree = createTreeWithEmptyWorkspace();

    // at-least its own default is always true; an impossible version is not
    expect(
      isTypescriptVersionAtLeast(tree, coerce(typescriptVersion).version)
    ).toBe(true);
    expect(isTypescriptVersionAtLeast(tree, '99.0.0')).toBe(false);
  });
});
