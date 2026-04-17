import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('nx affected -- projectsAffectedByDependencyUpdates (e2e)', () => {
  const packageManager = getSelectedPackageManager();
  let libA: string;
  let libB: string;
  let baselineSha: string;

  const setMode = (value: 'all' | 'auto') => {
    updateJson('nx.json', (json) => {
      json.pluginsConfig ??= {};
      json.pluginsConfig['@nx/js'] ??= {};
      json.pluginsConfig['@nx/js'].projectsAffectedByDependencyUpdates = value;
      return json;
    });
  };

  beforeAll(() => {
    newProject({ packages: ['@nx/js'], packageManager });

    libA = uniq('lib-a');
    libB = uniq('lib-b');
    runCLI(
      `generate @nx/js:lib libs/${libA} --bundler=none --unitTestRunner=none`
    );
    runCLI(
      `generate @nx/js:lib libs/${libB} --bundler=none --unitTestRunner=none`
    );

    updateFile(
      `libs/${libA}/src/index.ts`,
      `import isOdd from 'is-odd';\nexport default isOdd;\n`
    );
    updateFile(
      `libs/${libB}/src/index.ts`,
      `import isEven from 'is-even';\nexport default isEven;\n`
    );

    updateJson('package.json', (json) => {
      json.dependencies ??= {};
      json.dependencies['is-odd'] = '3.0.0';
      json.dependencies['is-even'] = '1.0.0';
      return json;
    });

    runCommand(getPackageManagerCommand().install);
    runCommand(`git add . && git commit -am "chore: baseline"`);
    baselineSha = runCommand(`git rev-parse HEAD`).trim();
  });

  afterAll(() => cleanupProject());

  describe('default "all" mode', () => {
    beforeAll(() => {
      runCommand(`git reset --hard ${baselineSha}`);
      setMode('all');
      runCommand(`git add nx.json && git commit -m "chore: set mode=all"`);

      updateJson('package.json', (json) => {
        json.dependencies['is-odd'] = '3.0.1';
        return json;
      });
      runCommand(getPackageManagerCommand().install);
      runCommand(`git add . && git commit -am "chore: bump is-odd (all mode)"`);
    });

    it('marks every project affected when any lock-file entry changes', () => {
      const out = runCLI(`show projects --affected --base=HEAD~1 --head=HEAD`);
      expect(out).toContain(libA);
      expect(out).toContain(libB);
    });
  });

  describe('"auto" mode', () => {
    beforeAll(() => {
      runCommand(`git reset --hard ${baselineSha}`);
      setMode('auto');
      runCommand(`git add nx.json && git commit -m "chore: set mode=auto"`);
    });

    it('reports no affected projects when the lock file is unchanged', () => {
      const out = runCLI(`show projects --affected --base=HEAD --head=HEAD`);
      expect(out).not.toContain(libA);
      expect(out).not.toContain(libB);
    });

    it('marks only the dependent project affected when a single dependency version bumps', () => {
      updateJson('package.json', (json) => {
        json.dependencies['is-odd'] = '3.0.1';
        return json;
      });
      runCommand(getPackageManagerCommand().install);
      runCommand(
        `git add . && git commit -am "chore: bump is-odd (auto mode)"`
      );

      const out = runCLI(`show projects --affected --base=HEAD~1 --head=HEAD`);
      expect(out).toContain(libA);
      expect(out).not.toContain(libB);
    });
  });
});
