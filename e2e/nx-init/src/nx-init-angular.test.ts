import { PackageManager } from 'nx/src/utils/package-manager';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  getPublishedVersion,
  getSelectedPackageManager,
  runCLI,
  runCommand,
  runNgNew,
} from '../../utils';

describe('nx init (Angular CLI)', () => {
  let project: string;
  let packageManager: PackageManager;
  let pmc: ReturnType<typeof getPackageManagerCommand>;

  beforeEach(() => {
    packageManager = getSelectedPackageManager();
    // TODO: solve issues with pnpm and remove this fallback
    packageManager = packageManager === 'pnpm' ? 'yarn' : packageManager;
    pmc = getPackageManagerCommand({ packageManager });
    project = runNgNew(packageManager);
  });

  afterEach(() => {
    cleanupProject();
  });

  it('should successfully convert an Angular CLI workspace to an Nx standalone workspace', () => {
    const output = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --no-interactive`
    );

    expect(output).toContain('🎉 Done!');
    // angular.json should have been deleted
    checkFilesDoNotExist('angular.json');
    // check nx config files exist
    checkFilesExist('nx.json', 'project.json');

    // check build
    const coldBuildOutput = runCLI(`build ${project} --outputHashing none`);
    expect(coldBuildOutput).toContain(
      `> nx run ${project}:build:production --outputHashing none`
    );
    expect(coldBuildOutput).toContain(
      `Successfully ran target build for project ${project}`
    );
    checkFilesExist(`dist/${project}/main.js`);

    // run build again to check is coming from cache
    const cachedBuildOutput = runCLI(`build ${project} --outputHashing none`);
    expect(cachedBuildOutput).toContain(
      `> nx run ${project}:build:production --outputHashing none  [local cache]`
    );
    expect(cachedBuildOutput).toContain('Nx read the output from the cache');
    expect(cachedBuildOutput).toContain(
      `Successfully ran target build for project ${project}`
    );
  });

  it('should successfully convert an Angular CLI workspace to an Nx integrated workspace', () => {
    const output = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --integrated --no-interactive`
    );

    expect(output).toContain('🎉 Done!');
    // angular.json should have been deleted
    checkFilesDoNotExist('angular.json');
    // check nx config files exist
    checkFilesExist('nx.json', `apps/${project}/project.json`);

    // check build
    const coldBuildOutput = runCLI(`build ${project} --outputHashing none`);
    expect(coldBuildOutput).toContain(
      `> nx run ${project}:build:production --outputHashing none`
    );
    expect(coldBuildOutput).toContain(
      `Successfully ran target build for project ${project}`
    );
    checkFilesExist(`dist/apps/${project}/main.js`);

    // run build again to check is coming from cache
    const cachedBuildOutput = runCLI(`build ${project} --outputHashing none`);
    expect(cachedBuildOutput).toContain(
      `> nx run ${project}:build:production --outputHashing none  [local cache]`
    );
    expect(cachedBuildOutput).toContain('Nx read the output from the cache');
    expect(cachedBuildOutput).toContain(
      `Successfully ran target build for project ${project}`
    );
  });
});
