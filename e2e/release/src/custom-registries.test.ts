import { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  createFile,
  killProcessAndPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import type { PackageJson } from 'nx/src/utils/package-json';

describe('nx release - custom npm registries', () => {
  const verdaccioPort = 7191;
  const customRegistryUrl = `http://localhost:${verdaccioPort}`;
  const scope = 'scope';
  let previousPackageManager: string;

  beforeAll(async () => {
    previousPackageManager = process.env.SELECTED_PM;
    // We are testing some more advanced scoped registry features that only npm has within this file
    process.env.SELECTED_PM = 'npm';
    newProject({
      packages: ['@nx/js'],
    });
  }, 60000);
  afterAll(() => {
    cleanupProject();
    process.env.SELECTED_PM = previousPackageManager;
  });

  it('should respect registry configuration for each package', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projectsRelationship: 'independent',
      };
      return nxJson;
    });

    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    const npmrcEntries = [
      `@${scope}:registry=http://scoped-registry.com`,
      'tag=next',
      // We can't test overriding the default registry in this file since our e2e tests override it anyway.
      // Instead, we'll just assert that the e2e registry is used anytime we expect the default registry
    ];
    createFile('.npmrc', npmrcEntries.join('\n'));

    const scopedWithPublishConfig = newPackage('pkg-scoped-publish-config', {
      scoped: true,
      publishConfig: {
        [`@${scope}:registry`]: 'http://publish-config-registry.com',
      },
    });

    const publishResultScopedWithPublishConfig = runCLI(
      `release publish -p ${scopedWithPublishConfig} --dry-run`
    );
    expect(publishResultScopedWithPublishConfig).toContain(
      'Would publish to http://publish-config-registry.com with tag "next"'
    );

    const scopedWithPublishConfigAndProjectConfig = newPackage(
      'pkg-scoped-publish-config-project-config',
      {
        scoped: true,
        publishConfig: {
          [`@${scope}:registry`]: 'http://publish-config-registry.com',
        },
        projectConfig: {
          registry: 'http://ignored-registry.com',
          tag: 'alpha',
        },
      }
    );

    const publishResultScopedWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${scopedWithPublishConfigAndProjectConfig} --dry-run`
    );
    expect(publishResultScopedWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://publish-config-registry.com with tag "alpha"'
    );

    const publishResultScopedWithPublishConfigAndProjectConfigAndArg = runCLI(
      `release publish -p ${scopedWithPublishConfigAndProjectConfig} --dry-run --registry=http://ignored-registry.com`
    );
    expect(
      publishResultScopedWithPublishConfigAndProjectConfigAndArg
    ).toContain(
      'Would publish to http://publish-config-registry.com with tag "alpha"'
    );

    const scopedNoOtherConfig = newPackage('pkg-scoped-no-other-config', {
      scoped: true,
    });

    const publishResultScopedNoOtherConfig = runCLI(
      `release publish -p ${scopedNoOtherConfig} --dry-run`
    );
    expect(publishResultScopedNoOtherConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "next"'
    );

    const publishResultScopedWithRegistryArg = runCLI(
      `release publish -p ${scopedNoOtherConfig} --dry-run --registry=http://scope-override-registry.com`
    );
    expect(publishResultScopedWithRegistryArg).toContain(
      'Would publish to http://scope-override-registry.com with tag "next"'
    );

    const noScopeWithPublishConfigAndProjectConfig = newPackage(
      'pkg-no-scope-publish-config-project-config',
      {
        publishConfig: {
          registry: 'http://publish-config-registry.com',
        },
        projectConfig: {
          registry: 'http://ignored-registry.com',
          tag: 'alpha',
        },
      }
    );

    const publishResultNoScopeWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${noScopeWithPublishConfigAndProjectConfig} --dry-run`
    );
    expect(publishResultNoScopeWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://publish-config-registry.com with tag "alpha"'
    );

    const publishResultNoScopeWithPublishConfigAndProjectConfigAndArg = runCLI(
      `release publish -p ${noScopeWithPublishConfigAndProjectConfig} --dry-run --registry=http://ignored-registry.com --tag=beta`
    );
    expect(
      publishResultNoScopeWithPublishConfigAndProjectConfigAndArg
    ).toContain(
      `Would publish to http://publish-config-registry.com with tag "beta"`
    );

    const noScopeNoOtherConfig = newPackage('pkg-no-scope-no-config', {});

    const publishResultNoScope = runCLI(
      `release publish -p ${noScopeNoOtherConfig} --dry-run`
    );
    expect(publishResultNoScope).toContain(
      `Would publish to ${e2eRegistryUrl} with tag "next"`
    );

    const publishResultNoScopeWithRegistryArg = runCLI(
      `release publish -p ${noScopeNoOtherConfig} --dry-run --registry=${customRegistryUrl} --tag=alpha`
    );
    expect(publishResultNoScopeWithRegistryArg).toContain(
      `Would publish to ${customRegistryUrl} with tag "alpha"`
    );

    const scopeWithProjectConfig = newPackage('pkg-scope-project-config', {
      scoped: true,
      projectConfig: {
        registry: 'http://scope-override-registry.com',
        tag: 'alpha',
      },
    });

    const publishResultScopedWithProjectConfig = runCLI(
      `release publish -p ${scopeWithProjectConfig} --dry-run`
    );
    expect(publishResultScopedWithProjectConfig).toContain(
      'Would publish to http://scope-override-registry.com with tag "alpha"'
    );
    const publishResultScopedWithProjectConfigAndArg = runCLI(
      `release publish -p ${scopeWithProjectConfig} --dry-run --registry=http://scope-override-arg-registry.com --tag=prev`
    );
    expect(publishResultScopedWithProjectConfigAndArg).toContain(
      'Would publish to http://scope-override-arg-registry.com with tag "prev"'
    );

    const noScopeWithProjectConfig = newPackage('pkg-no-scope-project-config', {
      projectConfig: {
        registry: 'http://default-override-registry.com',
        tag: 'alpha',
      },
    });

    const publishResultNoScopeWithProjectConfig = runCLI(
      `release publish -p ${noScopeWithProjectConfig} --dry-run`
    );
    expect(publishResultNoScopeWithProjectConfig).toContain(
      'Would publish to http://default-override-registry.com with tag "alpha"'
    );
    const publishResultNoScopeWithProjectConfigAndArg = runCLI(
      `release publish -p ${noScopeWithProjectConfig} --dry-run --registry=http://default-override-arg-registry.com --tag=prev`
    );
    expect(publishResultNoScopeWithProjectConfigAndArg).toContain(
      'Would publish to http://default-override-arg-registry.com with tag "prev"'
    );

    runCLI(`generate setup-verdaccio`);

    const process = await runCommandUntil(
      `local-registry @proj/source --port=${verdaccioPort}`,
      (output) => output.includes(`warn --- http address`)
    );

    const npmrcEntries2 = [
      `@${scope}:registry=${customRegistryUrl}`,
      `registry=http://ignored-registry.com`,
      'tag=next',
    ];
    updateFile('.npmrc', npmrcEntries2.join('\n'));

    const actualScopedWithPublishConfigAndProjectConfig = newPackage(
      'pkg-actual-scoped-publish-config-project-config',
      {
        scoped: true,
        publishConfig: {
          [`@${scope}:registry`]: e2eRegistryUrl,
        },
        projectConfig: {
          registry: 'http://ignored-registry.com',
          tag: 'beta',
          version: {
            tag: 'alpha', // alpha tag will be passed via publish CLI arg to override the above 'beta'
          },
        },
      }
    );

    const actualPublishResultScoped = runCLI(
      `release publish -p ${actualScopedWithPublishConfigAndProjectConfig} --registry=http://ignored-registry.com --tag=alpha`
    );

    const actualScopedWithWrongPublishConfig = newPackage(
      'pkg-actual-scoped-wrong-publish-config',
      {
        scoped: true,
        publishConfig: {
          // to properly override the registry for a scoped package, the key needs to include the scope
          registry: 'http://ignored-registry.com',
        },
        projectConfig: {}, // this will still set the current version resolver to 'registry', it just won't set the registry url
      }
    );

    const actualPublishResultScopedWithWrongPublishConfig = runCLI(
      `release publish -p ${actualScopedWithWrongPublishConfig}`
    );

    const actualNoScopeWithProjectConfig = newPackage(
      'pkg-actual-no-scope-project-config',
      {
        projectConfig: {
          registry: customRegistryUrl,
          tag: 'beta',
        },
      }
    );

    const actualPublishResultNoScopeWithProjectConfig = runCLI(
      `release publish -p ${actualNoScopeWithProjectConfig}`
    );

    const actualScopedWithProjectConfig = newPackage(
      'pkg-actual-scoped-project-config',
      {
        scoped: true,
        projectConfig: {
          registry: e2eRegistryUrl,
          tag: 'prev',
        },
      }
    );

    const actualPublishResultScopedWithProjectConfig = runCLI(
      `release publish -p ${actualScopedWithProjectConfig}`
    );

    const versionResult = runCLI(
      `release version 999.9.9 -p "${actualScopedWithPublishConfigAndProjectConfig},${actualScopedWithWrongPublishConfig},${actualNoScopeWithProjectConfig},${actualScopedWithProjectConfig}" --dry-run`,
      { silenceError: true } // don't error on this command because the verdaccio process needs to be killed regardless before the test exits
    );

    await killProcessAndPorts(process.pid, verdaccioPort);

    expect(actualPublishResultScoped).toContain(
      `Published to ${e2eRegistryUrl} with tag "alpha"`
    );

    expect(actualPublishResultScopedWithWrongPublishConfig).toContain(
      `Published to ${customRegistryUrl} with tag "next"`
    );

    expect(actualPublishResultNoScopeWithProjectConfig).toContain(
      `Published to ${customRegistryUrl} with tag "beta"`
    );

    expect(actualPublishResultScopedWithProjectConfig).toContain(
      `Published to ${e2eRegistryUrl} with tag "prev"`
    );

    expect(
      versionResult.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "alpha" from registry ${e2eRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(1);

    expect(
      versionResult.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "next" from registry ${customRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(1);

    expect(
      versionResult.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "beta" from registry ${customRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(1);

    expect(
      versionResult.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "prev" from registry ${e2eRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(1);
  }, 600000);

  function newPackage(
    name: string,
    options: {
      scoped?: true;
      publishConfig?: Record<string, string>;
      projectConfig?: {
        registry?: string;
        tag?: string;
        version?: {
          registry?: string;
          tag?: string;
        };
        publish?: {
          registry?: string;
          tag?: string;
        };
      };
    }
  ): string {
    const projectName = uniq(name);
    runCLI(`generate @nx/workspace:npm-package ${projectName}`);

    let packageName = projectName;
    if (options.scoped) {
      packageName = `@${scope}/${projectName}`;
    }

    updateJson<PackageJson>(`${projectName}/package.json`, (json) => {
      json.name = packageName;
      if (options.publishConfig) {
        json.publishConfig = options.publishConfig;
      }
      return json;
    });

    updateJson<ProjectConfiguration>(`${projectName}/project.json`, (json) => {
      if (options.projectConfig) {
        json.release = {
          version: {
            generatorOptions: {
              currentVersionResolver: 'registry',
              currentVersionResolverMetadata: {},
            },
          },
        };
        json.targets = {
          ...json.targets,
          'nx-release-publish': {
            options: {},
          },
        };
      }
      if (options.projectConfig?.registry) {
        json.targets['nx-release-publish'].options.registry =
          options.projectConfig.registry;
        (
          json.release.version.generatorOptions
            .currentVersionResolverMetadata as Record<string, string>
        ).registry = options.projectConfig.registry;
      }
      if (options.projectConfig?.tag) {
        json.targets['nx-release-publish'].options.tag =
          options.projectConfig.tag;
        (
          json.release.version.generatorOptions
            .currentVersionResolverMetadata as Record<string, string>
        ).tag = options.projectConfig.tag;
      }
      if (options.projectConfig?.publish?.registry) {
        json.targets['nx-release-publish'].options.registry =
          options.projectConfig.publish.registry;
      }
      if (options.projectConfig?.publish?.tag) {
        json.targets['nx-release-publish'].options.tag =
          options.projectConfig.publish.tag;
      }
      if (options.projectConfig?.version?.registry) {
        (
          json.release.version.generatorOptions
            .currentVersionResolverMetadata as Record<string, string>
        ).registry = options.projectConfig.version.registry;
      }
      if (options.projectConfig?.version?.tag) {
        (
          json.release.version.generatorOptions
            .currentVersionResolverMetadata as Record<string, string>
        ).tag = options.projectConfig.version.tag;
      }
      return json;
    });

    return projectName;
  }
});
