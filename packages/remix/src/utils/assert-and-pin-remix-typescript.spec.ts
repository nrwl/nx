import { addDependenciesToPackageJson, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertAndPinRemixTypescript } from './assert-and-pin-remix-typescript';
import { typescriptVersion } from './versions';

describe('assertAndPinRemixTypescript', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each(['~6.0.3', '^6.0.0', '>=6.0.0'])(
    'should throw when typescript is declared as %s',
    (version) => {
      addDependenciesToPackageJson(tree, {}, { typescript: version });

      expect(() => assertAndPinRemixTypescript(tree)).toThrow(
        /Remix does not support TypeScript 6/
      );
    }
  );

  it('should not throw when typescript is declared as <6 and should not overwrite the declaration', () => {
    addDependenciesToPackageJson(tree, {}, { typescript: '<6' });

    expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.typescript).toBe('<6');
  });

  it('should pin typescript to the Remix version when typescript is absent', () => {
    expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.typescript).toBe(typescriptVersion);
  });

  it('should keep an existing 5.x pin', () => {
    addDependenciesToPackageJson(tree, {}, { typescript: '~5.8.3' });

    expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.typescript).toBe('~5.8.3');
  });

  it('should skip the throw for dist-tags', () => {
    addDependenciesToPackageJson(tree, {}, { typescript: 'latest' });

    expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies.typescript).toBe('latest');
  });

  describe('with an installed typescript', () => {
    function installTypescript(version: string) {
      tree.write(
        'node_modules/typescript/package.json',
        JSON.stringify({ name: 'typescript', version })
      );
    }

    it('should throw when an open range is satisfied by an installed TS6', () => {
      addDependenciesToPackageJson(tree, {}, { typescript: '>=5.9.0' });
      installTypescript('6.0.3');

      expect(() => assertAndPinRemixTypescript(tree)).toThrow(
        /Remix does not support TypeScript 6/
      );
    });

    it('should not throw when an open range is satisfied by an installed TS5', () => {
      addDependenciesToPackageJson(tree, {}, { typescript: '>=5.9.0' });
      installTypescript('5.9.2');

      expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.typescript).toBe('>=5.9.0');
    });

    it('should pin 5.x when TS6 is only present transitively (no direct declaration)', () => {
      installTypescript('6.0.3');

      expect(() => assertAndPinRemixTypescript(tree)).not.toThrow();

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.typescript).toBe(typescriptVersion);
    });
  });
});
