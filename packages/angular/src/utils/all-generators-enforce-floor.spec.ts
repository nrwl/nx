import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const generatorsJson = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'generators.json'), 'utf-8')
);

const generatorEntries = Object.entries<{ factory: string }>(
  generatorsJson.generators
);

describe('all generators enforce supported Angular version floor', () => {
  it.each(generatorEntries)(
    '`%s` throws on sub-floor @angular/core',
    async (_name, def) => {
      const factoryRelative = def.factory.replace(/^\.\//, '');
      const factoryModule = require(
        join(__dirname, '..', '..', factoryRelative)
      );
      const factory = factoryModule.default ?? factoryModule;

      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { '@angular/core': '~18.2.0' },
      }));

      await expect(
        Promise.resolve().then(() => factory(tree, {}))
      ).rejects.toThrow(/Unsupported version of `@angular\/core` detected/);
    }
  );
});
