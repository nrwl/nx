import { MigrationsJson, MigrationsJsonEntry } from '../config/misc-interfaces';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function assertValidMigrationPaths(json: MigrationsJson, root: string) {
  Object.entries(json.generators).forEach(([generator, m]) => {
    it(`should have valid path generator: ${generator}`, () => {
      validateMigration(m, root);
    });
  });

  Object.entries(json.schematics ?? {}).forEach(([schematic, m]) => {
    it(`should have valid path schematic: ${schematic}`, () => {
      validateMigration(m, root);
    });
  });

  it('should contain all folders under ./src/migrations', () => {
    const migrationsPath = path.join(root, 'src/migrations');
    if (!fs.existsSync(migrationsPath)) return;
    const dirs = fs.readdirSync(migrationsPath);
    const knownDirs = new Set<string>(['utils']);
    const migrations = Object.values(json.generators);
    for (const m of migrations) {
      const impl = m.factory ?? m.implementation;
      if (impl) {
        knownDirs.add(path.basename(path.dirname(impl)));
      }
      if (m.prompt) {
        knownDirs.add(path.basename(path.dirname(m.prompt)));
      }
    }
    for (const dir of dirs) {
      expect(knownDirs).toContain(dir);
    }
  });
}

function validateMigration(m: MigrationsJsonEntry, root: string) {
  const impl = m.factory ?? m.implementation;
  if (impl) {
    let [implPath, implMember] = impl.includes('#')
      ? impl.split('#')
      : [impl, null];
    implPath = implPath.replace(/dist\//, '');
    let implModule;
    expect(() => {
      implModule = require(path.join(root, `${implPath}.ts`));
    }).not.toThrow();
    if (implMember) {
      expect(implModule).toHaveProperty(implMember);
    }
  }
  if (m.prompt) {
    // migrations.json is the published shape — prompt paths point at the
    // built `./dist/src/.../foo.md`. The spec runs against the source tree,
    // so map the published path back to its source location.
    const promptSourcePath = m.prompt.replace(/^\.?\/?dist\//, '');
    expect(fs.existsSync(path.join(root, promptSourcePath))).toBe(true);
  }
}
