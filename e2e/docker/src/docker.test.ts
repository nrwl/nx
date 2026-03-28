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

    it(
      'should allow releasing docker images with multiple version plans',
      async () => {
        const myapp = 'api';
        createDockerApp(myapp);
        addDockerReleaseConfiguration(myapp, {
          skipVersionActions: false,
          versionPlans: true,
          versionSchemes: {
            production: '{versionActionsVersion}',
          },
        });
        addDockerPluginIfNotExists();

        runCLI(`reset`);

        const result = runCLI(`run ${myapp}:docker:build`);
        expect(result.includes('Successfully ran target')).toBeTruthy();

        createFile(
          '.nx/version-plans/bump-patch.md',
          `---
${myapp}: patch
---

Patch docker app
`
        );
        createFile(
          '.nx/version-plans/bump-minor.md',
          `---
${myapp}: minor
---

Minor docker app
`
        );

        await runCommandAsync(`git add .nx/version-plans`);
        await runCommandAsync(
          `git commit -m "chore: add docker version plans"`
        );

        const releaseResult = runCLI(
          'release --dockerVersionScheme=production --yes --verbose'
        );
        expect(releaseResult.includes('Successfully ran target')).toBeTruthy();
        expect(releaseResult).toContain(
          'Image tagged with localhost:5000/test/api:0.1.0.'
        );
      },
      TEN_MINS_MS
    );

    it(
      'should skip default tag when skipDefaultTag is true',
      () => {
        const myapp = uniq('myapp');
        createDockerApp(myapp);

        // Configure plugin with skipDefaultTag
        updateJson('nx.json', (nxJson) => {
          nxJson.plugins = nxJson.plugins || [];
          const dockerPlugin = nxJson.plugins.find(
            (p) => p.plugin === '@nx/docker'
          );
          if (dockerPlugin) {
            dockerPlugin.options = {
              buildTarget: {
                name: 'docker:build',
                skipDefaultTag: true,
                args: ['--tag', `${myapp}:custom`],
              },
              runTarget: 'docker:run',
            };
          }
          return nxJson;
        });

        // Ensure project graph up to date
        runCLI(`reset`);

        // Build with custom tag only
        const result = runCLI(`run ${myapp}:docker:build`);
        expect(result.includes('Successfully ran target')).toBeTruthy();

        // Verify the custom tag was created
        const imagesOutput = runCommand(`docker images ${myapp}:custom`);
        expect(imagesOutput).toContain(`${myapp}`);
        expect(imagesOutput).toContain('custom');

        // Cleanup
        runCommand(`docker rmi ${myapp}:custom || true`);
      },
      TEN_MINS_MS
    );
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

function addDockerReleaseConfiguration(
  name: string,
  options: {
    skipVersionActions?: boolean;
    versionPlans?: boolean;
    versionSchemes?: Record<string, string>;
  } = {}
) {
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
      versionPlans: options.versionPlans ?? false,
      releaseTagPattern: 'release/{projectName}/{version}',
      docker: {
        registryUrl: 'localhost:5000',
        skipVersionActions: options.skipVersionActions ?? true,
        versionSchemes: options.versionSchemes,
      },
    };
    return nxJson;
  });
}
