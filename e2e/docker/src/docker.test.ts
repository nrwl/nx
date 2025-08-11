import {
  checkFilesExist,
  cleanupProject,
  createFile,
  killPort,
  newProject,
  readJson,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
  stripIndents,
  runCommand,
  runCommandAsync,
  isDockerAvailable,
} from '@nx/e2e-utils';

const TEN_MINS_MS = 600_000;

describe('Docker E2Es', () => {
  if (isDockerAvailable()) {
    beforeEach(async () => {
      newProject({ packages: ['@nx/docker'] });
      addDockerPluginIfNotExists();
      // Normalize git committer information so it is deterministic in snapshots
      await runCommandAsync(`git config user.email "test@test.com"`);
      await runCommandAsync(`git config user.name "Test"`);
      // Create a baseline version tag
      await runCommandAsync(`git tag v0.0.0`);

      // We need a valid git origin to exist for the commit references to work (and later the test for createRelease)
      await runCommandAsync(
        `git remote add origin https://github.com/nrwl/fake-repo.git`
      );
    });

    afterEach(() => cleanupProject());

    it(
      'should build and run docker projects',
      () => {
        const myapp = uniq('myapp');
        createDockerApp(myapp);
        const result = runCLI(`run ${myapp}:docker:build`);
        expect(result.includes('Successfully ran target')).toBeTruthy();

        const runResult = runCLI(`run ${myapp}:docker:run`);
        expect(runResult.includes('Hello World')).toBeTruthy();
      },
      TEN_MINS_MS
    );

    it('should allow releasing docker images to registry', () => {
      const myapp = 'api';
      createDockerApp(myapp);
      addDockerReleaseConfiguration(myapp);
      addDockerPluginIfNotExists();

      // Ensure project graph up to date
      runCLI(`reset`);

      const result = runCLI(`run ${myapp}:docker:build`);
      expect(result.includes('Successfully ran target')).toBeTruthy();

      const releaseResult = runCLI(
        'release --dockerVersionScheme=production --yes --verbose'
      );
      expect(releaseResult.includes('Successfully ran target')).toBeTruthy();
    });
  } else {
    it('docker is not available', () => expect(true).toBe(true));
  }
});

function createDockerApp(name: string) {
  createFile(
    `packages/${name}/project.json`,
    JSON.stringify({
      name,
      projectType: 'application',
      root: `packages/${name}`,
      sourceRoot: `packages/${name}`,
    })
  );
  createFile(`packages/${name}/main.js`, `console.log("Hello World!")`);
  createFile(
    `packages/${name}/Dockerfile`,
    stripIndents`FROM node:latest
        WORKDIR /app
        
        COPY . .
        
        CMD ["node", "./main.js"]`
  );
}

function addDockerPluginIfNotExists() {
  updateJson('nx.json', (nxJson) => {
    nxJson.plugins ??= [];
    if (
      !nxJson.plugins.some((p) =>
        typeof p === 'string' ? p === '@nx/docker' : p.plugin === '@nx/docker'
      )
    ) {
      nxJson.plugins.push({
        plugin: '@nx/docker',
        options: {
          buildTarget: 'docker:build',
          runTarget: 'docker:run',
        },
      });
    }
    return nxJson;
  });
}

function addDockerReleaseConfiguration(name: string) {
  updateJson(`packages/${name}/project.json`, (projectJson) => {
    projectJson.release = {
      docker: {
        repositoryName: `test/${name}`,
      },
    };
    return projectJson;
  });

  updateJson('nx.json', (nxJson) => {
    nxJson.release = {
      projects: [name],
      projectsRelationship: 'independent',
      releaseTagPattern: 'release/{projectName}/{version}',
      docker: {
        registryUrl: 'localhost:5000',
        skipVersionActions: true,
      },
    };
    return nxJson;
  });
}
