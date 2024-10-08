import { MigrationsJson, MigrationsJsonEntry } from '../config/misc-interfaces';
import * as path from 'path';

export function assertValidMigrationPaths(json: MigrationsJson, root: string) {
  let hasTests = false;
  Object.entries(json.generators).forEach(([generator, m]) => {
    hasTests = true;
    it(`should have valid path generator: ${generator}`, () => {
      validateMigration(m, root);
    });
  });

  Object.entries(json.schematics ?? {}).forEach(([schematic, m]) => {
    hasTests = true;
    it(`should have valid path schematic: ${schematic}`, () => {
      validateMigration(m, root);
    });
  });

  if (!hasTests) {
    it('should pass without migrations', () => {
      // no-op
    });
  }
}

function validateMigration(m: MigrationsJsonEntry, root: string) {
  const impl = m.factory ?? m.implementation;
  const [implPath, implMember] = impl.includes('#')
    ? impl.split('#')
    : [impl, null];
  let implModule;
  expect(() => {
    implModule = require(path.join(root, `${implPath}.ts`));
  }).not.toThrow();
  if (implMember) {
    expect(implModule).toHaveProperty(implMember);
  }
}
