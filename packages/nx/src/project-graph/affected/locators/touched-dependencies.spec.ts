import { getTouchedDependencies } from './touched-dependencies';
import { WholeFileChange } from '../../file-utils';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';

const getPluginsMock = jest.fn();
jest.mock('../../plugins/get-plugins', () => ({
  getPlugins: (...args: unknown[]) => getPluginsMock(...args),
}));

function externalNode(
  name: string,
  packageName: string,
  version: string
): ProjectGraphExternalNode {
  return { type: 'nuget', name, data: { packageName, version } };
}

const graph = {
  nodes: {
    PkgA: { name: 'PkgA', type: 'lib' as const, data: { root: 'PkgA' } },
    PkgB: { name: 'PkgB', type: 'lib' as const, data: { root: 'PkgB' } },
    PkgC: { name: 'PkgC', type: 'lib' as const, data: { root: 'PkgC' } },
  },
  externalNodes: {
    'nuget:Serilog@4.0.0': externalNode(
      'nuget:Serilog@4.0.0',
      'Serilog',
      '4.0.0'
    ),
    'nuget:Newtonsoft.Json@13.0.3': externalNode(
      'nuget:Newtonsoft.Json@13.0.3',
      'Newtonsoft.Json',
      '13.0.3'
    ),
  },
  dependencies: {},
} as unknown as ProjectGraph;

function fileChange(
  file: string,
  baseContent = 'before',
  headContent = 'after'
) {
  return {
    file,
    getChanges: () => [new WholeFileChange()],
    getContentAtBase: () => baseContent,
    getContentAtHead: () => headContent,
  };
}

function plugin(pattern: string, fn: jest.Mock, name = '@nx/dotnet'): unknown {
  return { name, createTouchedDependencies: [pattern, fn] };
}

function run(changes: ReturnType<typeof fileChange>[]) {
  return getTouchedDependencies(
    changes,
    graph.nodes,
    {} as any,
    undefined,
    graph
  );
}

describe('getTouchedDependencies', () => {
  beforeEach(() => {
    getPluginsMock.mockReset();
  });

  it('returns nothing when no plugin implements the hook', async () => {
    const hook = jest.fn();
    getPluginsMock.mockResolvedValue([
      { name: '@nx/js' },
      { name: '@nx/vite' },
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([]);
    expect(hook).not.toHaveBeenCalled();
  });

  it('does not invoke the hook when no file matches the pattern', async () => {
    // Matters for performance: invoking the hook can wake a plugin worker process.
    const hook = jest.fn();
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('src/Program.cs')])).toEqual([]);
    expect(hook).not.toHaveBeenCalled();
  });

  it('maps returned package names onto external node names', async () => {
    const hook = jest.fn().mockResolvedValue(['Serilog']);
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'nuget:Serilog@4.0.0',
    ]);
  });

  it('accepts an exact external node name', async () => {
    const hook = jest.fn().mockResolvedValue(['nuget:Serilog@4.0.0']);
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'nuget:Serilog@4.0.0',
    ]);
  });

  it('passes only matching files, with both revisions', async () => {
    const hook = jest.fn().mockResolvedValue([]);
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    await run([
      fileChange('Directory.Packages.props', 'old', 'new'),
      fileChange('src/Program.cs'),
    ]);

    expect(hook).toHaveBeenCalledWith(
      [
        {
          file: 'Directory.Packages.props',
          baseContent: 'old',
          headContent: 'new',
        },
      ],
      expect.objectContaining({ workspaceRoot: expect.any(String) })
    );
  });

  it('marks every project affected when the plugin returns "*"', async () => {
    const hook = jest.fn().mockResolvedValue('*');
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'PkgA',
      'PkgB',
      'PkgC',
    ]);
  });

  it('marks every project affected when a dependency is not in the graph', async () => {
    // We cannot tell who consumes an unknown package, so over-select rather than skip work.
    const hook = jest.fn().mockResolvedValue(['Package.We.Do.Not.Know']);
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'PkgA',
      'PkgB',
      'PkgC',
    ]);
  });

  it('still marks everything affected when projectGraphNodes is omitted', async () => {
    // The locator contract makes projectGraphNodes optional; the conservative fallbacks
    // must not collapse into an empty selection.
    const hook = jest.fn().mockResolvedValue('*');
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(
      await getTouchedDependencies(
        [fileChange('Directory.Packages.props')],
        undefined,
        {} as any,
        undefined,
        graph
      )
    ).toEqual(['PkgA', 'PkgB', 'PkgC']);
  });

  it('does not match identifiers against the object prototype chain', async () => {
    // 'constructor' is a valid package id; without an own-property check the exact-name
    // lookup would hit Object.prototype and emit a bogus node name.
    const hook = jest.fn().mockResolvedValue(['constructor']);
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'PkgA',
      'PkgB',
      'PkgC',
    ]);
  });

  it('marks every project affected when the plugin throws', async () => {
    const hook = jest.fn().mockRejectedValue(new Error('malformed manifest'));
    getPluginsMock.mockResolvedValue([
      plugin('**/Directory.Packages.props', hook),
    ]);

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([
      'PkgA',
      'PkgB',
      'PkgC',
    ]);
  });

  it('returns nothing when plugins cannot be loaded', async () => {
    // Graph construction already reports plugin failures; this locator staying quiet lets the
    // other locators still contribute their seeds.
    getPluginsMock.mockRejectedValue(new Error('could not resolve plugin'));

    expect(await run([fileChange('Directory.Packages.props')])).toEqual([]);
  });

  it('unions results across plugins and deduplicates', async () => {
    getPluginsMock.mockResolvedValue([
      plugin(
        '**/Directory.Packages.props',
        jest.fn().mockResolvedValue(['Serilog'])
      ),
      plugin(
        '**/Directory.Packages.props',
        jest.fn().mockResolvedValue(['Serilog', 'Newtonsoft.Json']),
        '@acme/other'
      ),
    ]);

    expect(
      new Set(await run([fileChange('Directory.Packages.props')]))
    ).toEqual(new Set(['nuget:Serilog@4.0.0', 'nuget:Newtonsoft.Json@13.0.3']));
  });
});
