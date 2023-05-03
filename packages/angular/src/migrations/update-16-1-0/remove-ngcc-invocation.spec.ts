import type { Tree } from '@nx/devkit';
import { readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import removeNgccInvocation from './remove-ngcc-invocation';

describe('remove-ngcc-invocation migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not throw when there is no scripts entry', async () => {
    updateJson(tree, 'package.json', (json) => {
      delete json.scripts;
      return json;
    });

    await expect(removeNgccInvocation(tree)).resolves.not.toThrow();
  });

  it('should not throw when there is no postinstall script', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.scripts = {};
      return json;
    });

    await expect(removeNgccInvocation(tree)).resolves.not.toThrow();
  });

  it('should handle postinstall script without ngcc invocation', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall:
          'node ./some-awesome-script.js && node ./another-awesome-script.js',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBe(
      'node ./some-awesome-script.js && node ./another-awesome-script.js'
    );
  });

  it('should handle postinstall script with only ngcc invocation', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall: 'ngcc --properties es2020 browser module main',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBeUndefined();
  });

  it('should handle postinstall script with extra leading command', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall:
          'node ./some-awesome-script.js && ngcc --properties es2020 browser module main',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBe('node ./some-awesome-script.js');
  });

  it('should handle postinstall script with extra trailing command', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall:
          'ngcc --properties es2020 browser module main && node ./some-awesome-script.js',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBe('node ./some-awesome-script.js');
  });

  it('should handle postinstall script with extra leading and trailing commands', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall:
          'node ./some-awesome-script.js && ngcc --properties es2020 browser module main && node ./another-awesome-script.js',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBe(
      'node ./some-awesome-script.js && node ./another-awesome-script.js'
    );
  });

  it('should remove ngcc invocation with an arbitrary amount of spaces around "&&"', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      scripts: {
        postinstall:
          'node ./some-awesome-script.js    &&    ngcc --properties es2020 browser module main    &&node ./another-awesome-script.js',
      },
    }));

    await removeNgccInvocation(tree);

    const { scripts } = readJson(tree, 'package.json');
    expect(scripts.postinstall).toBe(
      'node ./some-awesome-script.js    &&node ./another-awesome-script.js'
    );
  });
});
