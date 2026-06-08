import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { coerce } from 'semver';
import { isTypescriptVersionAtLeast } from './is-typescript-version-at-least';
import { typescriptVersion } from './versions';

describe('isTypescriptVersionAtLeast', () => {
  it.each`
    declared            | version    | expected
    ${'~5.9.2'}         | ${'6.0.0'} | ${false}
    ${'~6.0.3'}         | ${'6.0.0'} | ${true}
    ${'^5.8.0'}         | ${'5.8.0'} | ${true}
    ${'>=5.8 <6.0'}     | ${'6.0.0'} | ${false}
    ${'6.0.0-beta.1'}   | ${'6.0.0'} | ${true}
    ${'latest'}         | ${'6.0.0'} | ${true}
    ${'next'}           | ${'6.0.0'} | ${true}
    ${'<6.0.0'}         | ${'6.0.0'} | ${false}
    ${'<6'}             | ${'6.0.0'} | ${false}
    ${'>=5.9.0 <6.0.0'} | ${'6.0.0'} | ${false}
    ${'>=5.9.0 <6.0.0'} | ${'5.9.0'} | ${true}
    ${'^5 || ^6'}       | ${'6.0.0'} | ${false}
    ${'*'}              | ${'6.0.0'} | ${false}
    ${'>=6.0.0-beta.1'} | ${'6.0.0'} | ${true}
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

  describe('when typescript is installed', () => {
    function setup(declared: string, installed: string) {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { typescript: declared },
      }));
      tree.write(
        'node_modules/typescript/package.json',
        JSON.stringify({ name: 'typescript', version: installed })
      );
      return tree;
    }

    it.each`
      declared      | installed       | version    | expected
      ${'>=5.8.0'}  | ${'6.0.3'}      | ${'6.0.0'} | ${true}
      ${'>=5.8.0'}  | ${'5.9.2'}      | ${'6.0.0'} | ${false}
      ${'^5 || ^6'} | ${'6.0.3'}      | ${'6.0.0'} | ${true}
      ${'*'}        | ${'6.0.3'}      | ${'6.0.0'} | ${true}
      ${'>=5.8.0'}  | ${'6.0.0-rc.1'} | ${'6.0.0'} | ${true}
    `(
      'uses installed "$installed" when it satisfies declared "$declared"',
      ({ declared, installed, version, expected }) => {
        expect(
          isTypescriptVersionAtLeast(setup(declared, installed), version)
        ).toBe(expected);
      }
    );

    it('ignores the installed version when it no longer satisfies a re-pinned range', () => {
      // A generator mid-flight pinning typescript back to 5.x while v6 is still
      // in node_modules: the declared intent wins, not the stale install.
      expect(
        isTypescriptVersionAtLeast(setup('~5.9.2', '6.0.3'), '6.0.0')
      ).toBe(false);
    });

    it('uses the declared floor when installed does not satisfy an upgraded range', () => {
      expect(
        isTypescriptVersionAtLeast(setup('~6.0.3', '5.9.2'), '6.0.0')
      ).toBe(true);
    });

    it('ignores a transitively-installed typescript when none is declared', () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'node_modules/typescript/package.json',
        JSON.stringify({ name: 'typescript', version: '5.9.2' })
      );

      // No direct declaration: assume Nx's default (TS6), not the hoisted 5.9.2.
      expect(isTypescriptVersionAtLeast(tree, '6.0.0')).toBe(true);
    });
  });
});
