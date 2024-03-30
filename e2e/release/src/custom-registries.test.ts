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

  beforeAll(async () => {
    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/js'],
    });
  }, 60000);
  afterAll(() => cleanupProject());

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
      `registry=${e2eRegistryUrl}`,
      'tag=next',
    ];
    createFile('.npmrc', npmrcEntries.join('\n'));

    const scopedWithPublishConfig = newPackage('pkg1', {
      scoped: true,
      publishConfig: {
        registry: 'http://ignored-registry.com',
      },
    });

    const publishResultScopedWithPublishConfig = runCLI(
      `release publish -p ${scopedWithPublishConfig} --dry-run`
    );
    expect(publishResultScopedWithPublishConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "next"'
    );

    const scopedWithPublishConfigAndProjectConfig = newPackage('pkg2', {
      scoped: true,
      publishConfig: {
        registry: 'http://ignored-registry.com',
      },
      projectConfig: {
        registry: 'http://ignored-registry.com',
        tag: 'alpha',
      },
    });

    const publishResultScopedWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${scopedWithPublishConfigAndProjectConfig} --dry-run`
    );
    expect(publishResultScopedWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "alpha"'
    );

    const publishResultScopedWithPublishConfigAndProjectConfigAndArg = runCLI(
      `release publish -p ${scopedWithPublishConfigAndProjectConfig} --dry-run --registry=http://ignored-registry.com`
    );
    expect(
      publishResultScopedWithPublishConfigAndProjectConfigAndArg
    ).toContain('Would publish to http://scoped-registry.com with tag "alpha"');

    const scopedNoOtherConfig = newPackage('pkg3', {
      scoped: true,
    });

    const publishResultScopedNoOtherConfig = runCLI(
      `release publish -p ${scopedNoOtherConfig} --dry-run`
    );
    expect(publishResultScopedNoOtherConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "next"'
    );

    const publishResultScopedWithRegistryArg = runCLI(
      `release publish -p ${scopedNoOtherConfig} --dry-run --registry=http://ignored-registry.com`
    );
    expect(publishResultScopedWithRegistryArg).toContain(
      'Would publish to http://scoped-registry.com with tag "next"'
    );

    const noScopeWithPublishConfigAndProjectConfig = newPackage('pkg4', {
      publishConfig: {
        registry: 'http://publish-config-registry.com',
      },
      projectConfig: {
        registry: 'http://ignored-registry.com',
        tag: 'alpha',
      },
    });

    const publishResultNoScopeWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${noScopeWithPublishConfigAndProjectConfig} --dry-run`
    );
    expect(publishResultNoScopeWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://publish-config-registry.com with tag "alpha"'
    );

    // custom registry url will be ignored because publishConfig takes precedence,
    // but tag arg will properly override that from the project config
    const publishResultNoScopeWithPublishConfigAndProjectConfigAndArg = runCLI(
      `release publish -p ${noScopeWithPublishConfigAndProjectConfig} --dry-run --registry=http://ignored-registry.com --tag=beta`
    );
    expect(
      publishResultNoScopeWithPublishConfigAndProjectConfigAndArg
    ).toContain(
      `Would publish to http://publish-config-registry.com with tag "beta"`
    );

    const noScopeNoOtherConfig = newPackage('pkg6', {});

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

    const actualScopedWithPublishConfigAndProjectConfig = newPackage('pkg7', {
      scoped: true,
      publishConfig: {
        registry: 'http://ignored-registry.com',
      },
      projectConfig: {
        registry: 'http://ignored-registry.com',
        tag: 'beta',
        version: {
          tag: 'alpha', // alpha tag will be passed via publish CLI arg to override the above 'beta'
        },
      },
    });

    const actualPublishResultScoped = runCLI(
      `release publish -p ${actualScopedWithPublishConfigAndProjectConfig} --registry=http://ignored-registry.com --tag=alpha`
    );

    const actualNoScopeWithPublishConfig = newPackage('pkg8', {
      publishConfig: {
        registry: customRegistryUrl,
      },
      projectConfig: {}, // this will still set the current version resolver to 'registry', it just won't set the registry url
    });

    const actualPublishResultNoScopeWithPublishConfig = runCLI(
      `release publish -p ${actualNoScopeWithPublishConfig} --registry=http://ignored-registry.com`
    );

    const actualNoScopeWithProjectConfig = newPackage('pkg9', {
      projectConfig: {
        registry: customRegistryUrl,
        tag: 'beta',
      },
    });

    const actualPublishResultNoScopeWithProjectConfig = runCLI(
      `release publish -p ${actualNoScopeWithProjectConfig}`
    );

    const versionResult = runCLI(
      `release version 999.9.9 -p ${actualScopedWithPublishConfigAndProjectConfig},${actualNoScopeWithPublishConfig},${actualNoScopeWithProjectConfig} --dry-run`,
      { silenceError: true } // don't error on this command because the verdaccio process needs to be killed regardless before the test exits
    );

    await killProcessAndPorts(process.pid, verdaccioPort);

    expect(actualPublishResultScoped).toContain(
      `Published to ${customRegistryUrl} with tag "alpha"`
    );

    expect(actualPublishResultNoScopeWithPublishConfig).toContain(
      `Published to ${customRegistryUrl} with tag "next"`
    );

    expect(actualPublishResultNoScopeWithProjectConfig).toContain(
      `Published to ${customRegistryUrl} with tag "beta"`
    );

    expect(
      versionResult.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "alpha" from registry ${customRegistryUrl}`,
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
  }, 600000);

  function newPackage(
    name: string,
    options: {
      scoped?: true;
      publishConfig?: {
        registry?: string;
      };
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
