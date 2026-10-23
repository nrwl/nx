import { formatFiles, readNxJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './preserve-custom-dotnet-builds';

describe('preserve custom .NET build inference', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('apps/app/App.csproj', '<Project />');
  });
  const write = (plugins: unknown[], extra = {}) =>
    tree.write('nx.json', JSON.stringify({ plugins, ...extra }));

  it.each([
    { command: 'node build.js' },
    { executor: '@custom/build:run' },
    { outputs: ['{projectRoot}/custom'] },
    { configurations: { production: { optimization: true } } },
    { defaultConfiguration: 'staging' },
    { defaultConfiguration: '' },
    { options: { args: '--framework net8.0' } },
    { options: { args: ['-p:Configuration=Production'] } },
    { options: { args: '@build.rsp' } },
    { options: { cwd: 'somewhere' } },
    { parallelism: true },
    { cache: true },
  ])('preserves a previously permitted custom build: %j', async (build) => {
    write([{ plugin: '@nx/dotnet', options: { build, publish: false } }]);
    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@nx/dotnet',
        options: { build, publish: false, tfmVariants: false },
      },
    ]);
  });

  it('leaves standard registrations and supported additions byte-for-byte unchanged', async () => {
    write([
      '@nx/dotnet',
      {
        plugin: '@nx/dotnet',
        options: {
          build: {
            targetName: 'compile',
            options: { args: '--verbosity quiet', env: { CUSTOM: 'yes' } },
            inputs: ['extra'],
            dependsOn: ['codegen'],
          },
        },
      },
      { plugin: '@nx/vite', options: { build: { command: 'custom' } } },
    ]);
    const original = tree.read('nx.json', 'utf8');
    await update(tree);
    expect(tree.read('nx.json', 'utf8')).toBe(original);
  });

  it.each([true, false])(
    'preserves explicit tfmVariants=%s choices',
    async (tfmVariants) => {
      write([
        {
          plugin: '@nx/dotnet',
          options: { tfmVariants, build: { outputs: ['custom'] } },
        },
      ]);
      const original = tree.read('nx.json', 'utf8');
      await update(tree);
      expect(tree.read('nx.json', 'utf8')).toBe(original);
    }
  );

  it('does not rewrite disabled builds or registrations with no matching project files', async () => {
    write([
      {
        plugin: '@nx/dotnet',
        include: ['other/**/*.csproj'],
        options: { build: { outputs: [] } },
      },
      { plugin: '@nx/dotnet', options: { build: false } },
    ]);
    const original = tree.read('nx.json', 'utf8');
    await update(tree);
    expect(tree.read('nx.json', 'utf8')).toBe(original);
  });

  it('preserves order and registration-local include/exclude scope', async () => {
    tree.write('other/Other.csproj', '<Project />');
    write([
      '@nx/js',
      {
        plugin: '@nx/dotnet',
        include: ['apps/**/*.csproj'],
        options: { build: { outputs: [] } },
      },
      {
        plugin: '@nx/dotnet',
        exclude: ['apps/**'],
        options: { build: { targetName: 'compile' } },
      },
    ]);
    await update(tree);
    expect(readNxJson(tree)?.plugins).toEqual([
      '@nx/js',
      {
        plugin: '@nx/dotnet',
        include: ['apps/**/*.csproj'],
        options: { build: { outputs: [] }, tfmVariants: false },
      },
      {
        plugin: '@nx/dotnet',
        exclude: ['apps/**'],
        options: { build: { targetName: 'compile' } },
      },
    ]);
  });

  it.each(['project.json', 'package.json'])(
    'preserves scoped build overrides from %s',
    async (file) => {
      const targets = { compile: { command: 'custom-build' } };
      tree.write(
        `apps/app/${file}`,
        JSON.stringify(
          file === 'project.json'
            ? { name: 'app', targets }
            : { name: 'app', nx: { targets } }
        )
      );
      write([
        { plugin: '@nx/dotnet', options: { build: { targetName: 'compile' } } },
      ]);
      await formatFiles(tree);
      const original = tree.read(`apps/app/${file}`, 'utf8');
      await update(tree);
      expect(readNxJson(tree)?.plugins?.[0]).toMatchObject({
        options: { tfmVariants: false },
      });
      expect(tree.read(`apps/app/${file}`, 'utf8')).toBe(original);
    }
  );

  it.each([
    { build: { outputs: ['custom'] } },
    { 'build*': { configurations: { staging: {} } } },
    { 'nx:run-commands': { command: 'custom' } },
    {
      build: [{ filter: { executor: 'nx:run-commands' }, outputs: ['custom'] }],
    },
  ])('preserves applicable targetDefaults: %j', async (targetDefaults) => {
    write(['@nx/dotnet'], { targetDefaults });
    await update(tree);
    expect(readNxJson(tree)?.plugins).toEqual([
      { plugin: '@nx/dotnet', options: { tfmVariants: false } },
    ]);
    expect(readNxJson(tree)?.targetDefaults).toEqual(targetDefaults);
  });

  it('honors executor-key precedence over a shadowed name default', async () => {
    write(['@nx/dotnet'], {
      targetDefaults: {
        'nx:run-commands': {},
        build: { outputs: ['ignored'] },
      },
    });
    const original = tree.read('nx.json', 'utf8');
    await update(tree);
    expect(tree.read('nx.json', 'utf8')).toBe(original);
  });

  it('resolves named-project filters without opting out unrelated registrations', async () => {
    tree.write('apps/app/project.json', '{"name":"app"}');
    tree.write('other/Other.csproj', '<Project />');
    tree.write('other/project.json', '{"name":"other"}');
    write(
      [
        { plugin: '@nx/dotnet', include: ['apps/**'] },
        { plugin: '@nx/dotnet', include: ['other/**'] },
      ],
      {
        targetDefaults: {
          build: [{ filter: { projects: ['app'] }, outputs: ['custom'] }],
        },
      }
    );
    await update(tree);
    expect(readNxJson(tree)?.plugins?.[0]).toMatchObject({
      options: { tfmVariants: false },
    });
    expect(readNxJson(tree)?.plugins?.[1]).toEqual({
      plugin: '@nx/dotnet',
      include: ['other/**'],
    });
  });

  it('reports an evaluated-name filter it cannot resolve, without guessing or opting out every registration', async () => {
    write(['@nx/dotnet'], {
      targetDefaults: {
        build: [
          {
            filter: { projects: ['custom-msbuild-name'] },
            outputs: ['custom'],
          },
        ],
      },
    });
    const result = await update(tree);
    expect(result).toMatchObject({
      nextSteps: [expect.stringContaining('apps/app/App.csproj')],
      agentContext: [expect.stringContaining('plugins[0]')],
    });
    expect(result.skipAgentic).not.toBe(true);
    expect(readNxJson(tree)?.plugins).toEqual(['@nx/dotnet']);
  });

  it('does not request selector review after an independent override already preserves the registration', async () => {
    write([{ plugin: '@nx/dotnet', options: { build: { outputs: [] } } }], {
      targetDefaults: {
        build: [
          { filter: { projects: ['evaluated-name'] }, outputs: ['custom'] },
        ],
      },
    });
    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)?.plugins?.[0]).toMatchObject({
      options: { tfmVariants: false },
    });
  });

  it('reports malformed nx.json instead of aborting upgrade', async () => {
    tree.write('nx.json', '{"plugins":[');
    const result = await update(tree);
    expect(result).toMatchObject({
      nextSteps: [expect.stringContaining('nx.json')],
      agentContext: [expect.stringContaining('nx.json')],
    });
  });

  it('reports malformed plugin options without rewriting them', async () => {
    write([{ plugin: '@nx/dotnet', options: 'invalid' }]);
    const before = tree.read('nx.json', 'utf8');
    const result = await update(tree);
    expect(result).toMatchObject({
      nextSteps: [expect.stringContaining('plugins[0].options')],
      agentContext: [expect.stringContaining('plugins[0].options')],
    });
    expect(tree.read('nx.json', 'utf8')).toBe(before);
  });

  it('reports malformed scoped project config and still migrates an independent recognized override', async () => {
    tree.write('apps/app/project.json', '{"targets":');
    write([{ plugin: '@nx/dotnet', options: { build: { outputs: [] } } }]);
    const result = await update(tree);
    expect(result).toMatchObject({
      nextSteps: [expect.stringContaining('apps/app/project.json')],
      agentContext: [expect.stringContaining('apps/app/project.json')],
    });
    expect(readNxJson(tree)?.plugins?.[0]).toMatchObject({
      options: { tfmVariants: false },
    });
  });

  it('is idempotent', async () => {
    write([{ plugin: '@nx/dotnet', options: { build: { outputs: [] } } }]);
    await update(tree);
    const once = tree.read('nx.json', 'utf8');
    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('nx.json', 'utf8')).toBe(once);
  });

  it('keeps ordinary explicit dotnet commands untouched without a plugin registration', async () => {
    write(['@nx/js']);
    tree.write(
      'apps/app/project.json',
      '{"targets":{"build":{"command":"dotnet build"}}}'
    );
    const before = tree.read('apps/app/project.json', 'utf8');
    await update(tree);
    expect(tree.read('apps/app/project.json', 'utf8')).toBe(before);
  });
});
