import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertSupportedTypescriptVersion } from './assert-supported-typescript-version';

describe('assertSupportedTypescriptVersion', () => {
  it('throws when typescript is below the supported floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: '~5.3.0' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).toThrow(
      'Unsupported version of `typescript` detected'
    );
  });

  it('throws when typescript is right below the supported floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: '~5.7.3' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).toThrow(
      'Unsupported version of `typescript` detected'
    );
  });

  it('does not throw when typescript is not installed (fresh-install path)', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(() => assertSupportedTypescriptVersion(tree)).not.toThrow();
  });

  it('does not throw when typescript is `latest`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: 'latest' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).not.toThrow();
  });

  it('does not throw when typescript is `next`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: 'next' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).not.toThrow();
  });

  it('does not throw when the declared range straddles the floor and the installed version meets it (e.g. typescript-eslint style ranges)', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: '>=4.8.4 <6.1.0' },
    }));
    tree.write(
      'node_modules/typescript/package.json',
      JSON.stringify({ name: 'typescript', version: '6.0.2' })
    );

    expect(() => assertSupportedTypescriptVersion(tree)).not.toThrow();
  });

  it('asks to install dependencies when the declared range straddles the floor and no installed version resolves', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: '>=4.8.4 <6.1.0' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).toThrow(
      /Unable to determine the installed version of `typescript`/
    );
  });

  it('does not throw when typescript is within the supported window', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { typescript: '~5.9.2' },
    }));

    expect(() => assertSupportedTypescriptVersion(tree)).not.toThrow();
  });
});
