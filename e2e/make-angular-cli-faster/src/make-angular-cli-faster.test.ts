import {
  cleanupProject,
  getSelectedPackageManager,
  runNgNew,
  tmpProjPath,
} from '../../utils';
import { PackageManager } from 'nx/src/utils/package-manager';
import { execSync } from 'child_process';

describe('make-angular-cli-faster', () => {
  let project: string;
  let packageManager: PackageManager;

  beforeEach(() => {
    packageManager = getSelectedPackageManager();
    // TODO: solve issues with pnpm and remove this fallback
    packageManager = packageManager === 'pnpm' ? 'yarn' : packageManager;
    project = runNgNew(packageManager);
  });

  afterEach(() => {
    cleanupProject();
  });

  // TODO(colum): skip until we can investigate why it is installing incorrect version
  xit('should successfully install make-angular-cli-faster with nx cloud', () => {
    expect(() =>
      execSync(
        `NPM_CONFIG_REGISTRY=https://registry.npmjs.org npx --yes make-angular-cli-faster@latest --useNxCloud=true`,
        {
          cwd: tmpProjPath(),
          env: process.env,
          encoding: 'utf-8',
          stdio: 'pipe',
        }
      )
    ).not.toThrow();
  });
});
