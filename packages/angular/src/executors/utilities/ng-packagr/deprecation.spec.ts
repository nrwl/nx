import { logger, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as angularVersionUtils from '../angular-version-utils';
import { warnOnDeprecatedNgPackagrExecutor } from './deprecation';

describe('warnOnDeprecatedNgPackagrExecutor', () => {
  const originalPlatform = process.platform;
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setPlatform(originalPlatform);
  });

  it('should warn when the Angular versions support the library executor', () => {
    const warn = run({
      core: '~22.3.0',
      build: '~22.3.0',
      installed: '22.3.0',
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'The "@nx/angular:package" executor is deprecated. Use the "@nx/angular:library" executor instead. ' +
        "Run `nx g @nx/angular:convert-to-library-executor --project=ui` to convert the library, or to see why it can't be converted."
    );
  });

  it.each`
    core         | build        | installed
    ${'~22.3.0'} | ${'~22.2.0'} | ${'22.3.0'}
    ${'^22.0.0'} | ${'~22.3.0'} | ${'22.3.1'}
    ${'~22.3.0'} | ${'~22.3.0'} | ${'22.2.9'}
  `(
    'should not warn when @angular/core is $core ($installed installed) and @angular/build is $build',
    ({ core, build, installed }) => {
      expect(run({ core, build, installed })).not.toHaveBeenCalled();
    }
  );

  it('should quote a project name the shell would split', () => {
    setPlatform('linux');

    const warn = run({
      core: '~22.3.0',
      build: '~22.3.0',
      installed: '22.3.0',
      projectName: 'shared ui',
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Run `nx g @nx/angular:convert-to-library-executor '--project=shared ui'`"
      )
    );
  });

  it.each(['ui%HOME%', 'ui!TEAM!'])(
    'should name the generator instead of printing a command the Windows shell would expand in %s',
    (projectName) => {
      setPlatform('win32');

      const warn = run({
        core: '~22.3.0',
        build: '~22.3.0',
        installed: '22.3.0',
        projectName,
      });

      expect(warn).toHaveBeenCalledWith(
        'The "@nx/angular:package" executor is deprecated. Use the "@nx/angular:library" executor instead. ' +
          'Run the "@nx/angular:convert-to-library-executor" generator to convert the library, or to see why it can\'t be converted.'
      );
    }
  );

  function run({
    core,
    build,
    installed,
    projectName = 'ui',
  }: {
    core: string;
    build: string;
    installed: string;
    projectName?: string;
  }) {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, '@angular/core': core };
      json.devDependencies = {
        ...json.devDependencies,
        '@angular/build': build,
      };
      return json;
    });
    vi.spyOn(
      angularVersionUtils,
      'getInstalledAngularVersionInfo'
    ).mockReturnValue({ major: 22, version: installed });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    warnOnDeprecatedNgPackagrExecutor('@nx/angular:package', projectName, tree);
    return warn;
  }

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }
});
