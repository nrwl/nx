import {
  cleanupProject,
  getSelectedPackageManager,
  packageInstall,
  readJson,
  runNgNew,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { PackageManager } from 'nx/src/utils/package-manager';

export interface NgAddTestContext {
  project: string;
  packageManager: PackageManager;
}

export function setupNgAddTest(): NgAddTestContext {
  let packageManager = getSelectedPackageManager();
  // TODO: solve issues with pnpm and remove this fallback
  packageManager = packageManager === 'pnpm' ? 'yarn' : packageManager;
  const project = runNgNew(packageManager);
  packageInstall('nx', null, 'latest');
  packageInstall('@nx/angular', null, 'latest');

  return { project, packageManager };
}

export function cleanupNgAddTest() {
  cleanupProject();
}

export function addProtractor(project: string) {
  updateFile('e2e/protractor.conf.js', 'exports.config = {};');
  updateFile(
    'e2e/tsconfig.json',
    JSON.stringify({ extends: '../tsconfig.json' }, null, 2)
  );
  updateFile(
    'e2e/src/app.e2e-spec.ts',
    `describe('app', () => {
      it('should pass', () => {
        expect(true).toBe(true);
      });
    });`
  );

  const angularJson = readJson('angular.json');
  angularJson.projects[project].architect.e2e = {
    builder: '@angular-devkit/build-angular:protractor',
    options: {
      protractorConfig: 'e2e/protractor.conf.js',
      devServerTarget: `${project}:serve`,
    },
    configurations: {
      production: { devServerTarget: `${project}:serve:production` },
    },
  };
  updateFile('angular.json', JSON.stringify(angularJson, null, 2));
}
