import { chain, Rule, SchematicContext } from '@angular-devkit/schematics';
import {
  formatFiles,
  readPackageJson,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join } from 'path';

export default function update(): Rule {
  let migrations;

  const packageJson = readPackageJson();
  const hasNgrx = Object.keys(packageJson.dependencies || {}).find((dep) =>
    dep.startsWith('@ngrx/')
  );

  if (hasNgrx) {
    // NestJS 7 stays on NestJS 7 and RxJS 6 if NgRX is a dependency
    migrations = [];
  } else {
    // NestJS 7 and RxJS will be bumped to 8 and 7 respectively
    migrations = [
      updatePackagesInPackageJson(
        join(__dirname, '../../../', 'migrations.json'),
        '13.2.0'
      ),
    ];
  }

  return chain([
    ...migrations,
    formatFiles(),
    (_, context: SchematicContext) => {
      if (hasNgrx) {
        console.info(
          'NX We detect Ngrx in your workspace so Nest.js will remain in v7. Make sure to read the migration guide: https://docs.nestjs.com/migration-guide'
        );
      } else {
        console.info(
          'NX We upgraded Nest.js to v8. Make sure to read the migration guide: https://docs.nestjs.com/migration-guide'
        );
      }
    },
  ]);
}
