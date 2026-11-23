import {
  addProjectConfiguration,
  updateJson,
  updateNxJson,
  readNxJson,
  type NxJsonConfiguration,
  type TargetDefaultValue,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createRequire } from 'node:module';
import migration from './add-verdaccio-jwt-security';

const { load }: { load: (content: string) => unknown } =
  createRequire(__filename)('@zkochan/js-yaml');

const CONFIG = `storage: ../tmp/local-registry/storage
packages:
  '**':
    access: $all
    publish: $all
`;

function readExistingNxJson(tree: Tree): NxJsonConfiguration {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    throw new Error('nx.json not found');
  }
  return nxJson;
}

describe('add-verdaccio-jwt-security migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addVerdaccioProject(
    config: string = '.verdaccio/config.yml',
    target: Record<string, unknown> = {
      executor: '@nx/js:verdaccio',
      options: { config },
    }
  ) {
    addProjectConfiguration(tree, 'registry', {
      root: 'registry',
      targets: { 'local-registry': target },
    });
  }

  function readConfig(path = '.verdaccio/config.yml'): unknown {
    const content = tree.read(path, 'utf-8');
    if (content === null) {
      throw new Error(`${path} not found`);
    }
    return load(content);
  }

  function readSecurity(path?: string): unknown {
    const config = readConfig(path);
    return typeof config === 'object' && config !== null && 'security' in config
      ? config.security
      : undefined;
  }

  it('should append the jwt security section and keep the existing content', async () => {
    tree.write('.verdaccio/config.yml', CONFIG);
    addVerdaccioProject();

    const result = await migration(tree);

    const content = tree.read('.verdaccio/config.yml', 'utf-8');
    expect(content?.startsWith(CONFIG)).toBe(true);
    expect(readConfig()).toEqual({
      ...(load(CONFIG) as object),
      security: { api: { jwt: { sign: { expiresIn: '7d' } } } },
    });
    expect(result).toEqual({ skipAgentic: true });
  });

  it.each([
    [
      'a target configuration',
      () =>
        addVerdaccioProject(undefined, {
          executor: '@nx/js:verdaccio',
          configurations: { ci: { config: 'registry/config.yml' } },
        }),
    ],
    [
      'a {projectRoot} token',
      () => addVerdaccioProject('{projectRoot}/config.yml'),
    ],
    [
      'a package.json-based root project',
      () =>
        updateJson(tree, 'package.json', (json) => {
          json.nx = {
            targets: {
              'local-registry': {
                executor: '@nx/js:verdaccio',
                options: { config: 'registry/config.yml' },
              },
            },
          };
          return json;
        }),
    ],
    [
      'an executor target default',
      () => {
        const nxJson = readExistingNxJson(tree);
        nxJson.targetDefaults = {
          '@nx/js:verdaccio': { options: { config: 'registry/config.yml' } },
        };
        updateNxJson(tree, nxJson);
        addVerdaccioProject(undefined, { executor: '@nx/js:verdaccio' });
      },
    ],
    [
      'a target name default that sets the executor',
      () => {
        const nxJson = readExistingNxJson(tree);
        nxJson.targetDefaults = {
          'local-registry': [
            {
              filter: { projects: ['registry'] },
              executor: '@nx/js:verdaccio',
              options: { config: 'registry/config.yml' },
            },
          ],
        };
        updateNxJson(tree, nxJson);
        addVerdaccioProject(undefined, {});
      },
    ],
  ])('should update a config referenced by %s', async (_, arrange) => {
    tree.write('registry/config.yml', CONFIG);
    arrange();

    await migration(tree);

    expect(readSecurity('registry/config.yml')).toEqual({
      api: { jwt: { sign: { expiresIn: '7d' } } },
    });
  });

  it.each<[string, TargetDefaultValue, Record<string, unknown>, string[]]>([
    [
      'a command target sharing a name with a Verdaccio target default',
      { executor: '@nx/js:verdaccio', options: { config: 'unrelated.yml' } },
      { command: 'verdaccio' },
      [],
    ],
    [
      'a defaults entry the target executor is incompatible with',
      [
        { executor: '@nx/js:verdaccio', options: { config: 'actual.yml' } },
        {
          command: 'echo other registry',
          options: { config: 'unrelated.yml' },
        },
      ],
      { executor: '@nx/js:verdaccio' },
      ['actual.yml'],
    ],
    [
      'a later defaults entry that replaces an incompatible one',
      [
        {
          command: 'echo other registry',
          options: { config: 'unrelated.yml' },
        },
        { executor: '@nx/js:verdaccio', options: { port: 4873 } },
      ],
      {},
      [],
    ],
  ])(
    'should only update the config Nx resolves for %s',
    async (_, targetDefault, target, updated) => {
      tree.write('actual.yml', CONFIG);
      tree.write('unrelated.yml', CONFIG);
      const nxJson = readExistingNxJson(tree);
      nxJson.targetDefaults = { 'local-registry': targetDefault };
      updateNxJson(tree, nxJson);
      addVerdaccioProject(undefined, target);

      await migration(tree);

      for (const path of ['actual.yml', 'unrelated.yml']) {
        expect(readSecurity(path) !== undefined).toBe(updated.includes(path));
      }
    }
  );

  it('should update a config shared by several targets once', async () => {
    tree.write('.verdaccio/config.yml', CONFIG);
    addVerdaccioProject(undefined, {
      executor: '@nx/js:verdaccio',
      options: { config: '.verdaccio/config.yml' },
      configurations: { ci: { config: './.verdaccio/config.yml' } },
    });

    await migration(tree);

    expect(
      tree.read('.verdaccio/config.yml', 'utf-8')?.match(/^security:/gm)
    ).toHaveLength(1);
  });

  it('should not change configs of other executors or missing configs', async () => {
    tree.write('other/config.yml', CONFIG);
    addProjectConfiguration(tree, 'other', {
      root: 'other',
      targets: {
        serve: {
          executor: '@acme/registry:serve',
          options: { config: 'other/config.yml' },
        },
      },
    });
    addVerdaccioProject('missing/config.yml');

    const result = await migration(tree);

    expect(tree.read('other/config.yml', 'utf-8')).toBe(CONFIG);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    tree.write('.verdaccio/config.yml', CONFIG);
    addVerdaccioProject();
    await migration(tree);
    const afterFirstRun = tree.read('.verdaccio/config.yml', 'utf-8');

    const result = await migration(tree);

    expect(tree.read('.verdaccio/config.yml', 'utf-8')).toBe(afterFirstRun);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should update a config whose package rules all allow anonymous users', async () => {
    const content = `auth:
  htpasswd:
    file: ./htpasswd
packages:
  '@scope/*':
    access: [$anonymous, alice]
    publish: '@all'
  'internal-*':
    access: $all
    proxy: npmjs
  '**':
    access: '@anonymous $authenticated'
    publish: $all
    unpublish: ''
`;
    tree.write('.verdaccio/config.yml', content);
    addVerdaccioProject();

    const result = await migration(tree);

    expect(readSecurity()).toEqual({
      api: { jwt: { sign: { expiresIn: '7d' } } },
    });
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not change or report a config that already accepts the placeholder token', async () => {
    const content = `${CONFIG}security:\n  api:\n    legacy: false\n`;
    tree.write('.verdaccio/config.yml', content);
    addVerdaccioProject();

    const result = await migration(tree);

    expect(tree.read('.verdaccio/config.yml', 'utf-8')).toBe(content);
    expect(result).toEqual({ skipAgentic: true });
  });

  it.each([
    [
      'a package rule for logged-in users only',
      CONFIG.replace('publish: $all', 'publish: $authenticated'),
      'relies on logged-in users',
    ],
    [
      'owner checks',
      `${CONFIG}publish:\n  check_owners: true\n`,
      'relies on logged-in users',
    ],
    [
      'an auth plugin other than htpasswd',
      `${CONFIG}auth:\n  ldap:\n    url: ldap://localhost\n`,
      'relies on logged-in users',
    ],
    [
      'an existing security section without jwt',
      `${CONFIG}security:\n  web:\n    sign:\n      expiresIn: 1h\n`,
      'already has a `security` section',
    ],
    ['invalid yaml', 'storage: [unclosed\n', 'Could not parse'],
    [
      'a flow mapping',
      '{ storage: ../tmp/local-registry/storage }\n',
      'Could not update',
    ],
  ])(
    'should report and not change a config with %s',
    async (_, content, message) => {
      tree.write('.verdaccio/config.yml', content);
      addVerdaccioProject();

      const result = await migration(tree);

      expect(tree.read('.verdaccio/config.yml', 'utf-8')).toBe(content);
      expect(result.nextSteps).toEqual([
        expect.stringContaining('.verdaccio/config.yml'),
      ]);
      expect(result.nextSteps?.[0]).toContain(message);
      expect(result.agentContext).toEqual(result.nextSteps);
    }
  );
});
