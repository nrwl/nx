import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import { updateJson } from '../generators/utils/json';

interface GeneratorsJson {
  generators?: Record<string, { factory: string }>;
  schematics?: Record<string, { factory: string }>;
}

export function assertGeneratorsEnforceVersionFloor(options: {
  packageRoot: string;
  packageName: string;
  subFloorVersion: string;
}): void {
  const { packageRoot, packageName, subFloorVersion } = options;
  const generatorsJson: GeneratorsJson = JSON.parse(
    readFileSync(join(packageRoot, 'generators.json'), 'utf-8')
  );
  const entries = Object.entries(generatorsJson.generators ?? {});

  it('has generators registered in generators.json', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [name, def] of entries) {
    it(`\`${name}\` throws on sub-floor ${packageName}`, async () => {
      const [factoryRelative, exportName] = def.factory
        .replace(/^\.\//, '')
        .split('#');
      const factoryModule = require(join(packageRoot, factoryRelative));
      const factory = exportName
        ? factoryModule[exportName]
        : (factoryModule.default ?? factoryModule);

      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { [packageName]: subFloorVersion },
      }));

      await expect(
        Promise.resolve().then(() => factory(tree, {}))
      ).rejects.toThrow(`Unsupported version of \`${packageName}\` detected`);
    });
  }
}
