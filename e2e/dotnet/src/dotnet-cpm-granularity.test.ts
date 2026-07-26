import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
} from '@nx/e2e-utils';

import { createDotNetProject } from './utils/create-dotnet-project';

/**
 * Central Package Management moves every version into one Directory.Packages.props, so without
 * per-package attribution a single bump marks every project under that manifest as affected —
 * including projects that reference no packages at all.
 *
 * These tests pin the granular behavior end to end: the project graph gains one external node
 * per package, `nx affected` selects only the consumers of the package that moved, and the
 * cache invalidates on the same boundary.
 */
describe('.NET Plugin - Central Package Management granularity', () => {
  const rootPackagesProps = (serilog: string, newtonsoft: string) => `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="${serilog}" />
    <PackageVersion Include="Newtonsoft.Json" Version="${newtonsoft}" />
  </ItemGroup>
</Project>`;

  function referencePackage(project: string, packageId: string) {
    const path = `${project}/${project}.csproj`;
    const csproj = require('fs').readFileSync(tmpProjPath(path), 'utf-8');
    updateFile(
      path,
      csproj.replace(
        '</Project>',
        `  <ItemGroup>\n    <PackageReference Include="${packageId}" />\n  </ItemGroup>\n</Project>`
      )
    );
  }

  beforeAll(() => {
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`);

    // PkgA -> Newtonsoft.Json, PkgB -> Serilog, PkgC -> nothing at all.
    createDotNetProject({ name: 'PkgA', type: 'classlib' });
    createDotNetProject({ name: 'PkgB', type: 'classlib' });
    createDotNetProject({ name: 'PkgC', type: 'classlib' });

    updateFile(
      'Directory.Packages.props',
      rootPackagesProps('3.1.1', '13.0.1')
    );
    referencePackage('PkgA', 'Newtonsoft.Json');
    referencePackage('PkgB', 'Serilog');

    for (const project of ['PkgA', 'PkgB', 'PkgC']) {
      runCommand(`dotnet restore`, { cwd: tmpProjPath(project) });
    }

    runCommand('git init');
    runCommand('git config user.email "test@test.com"');
    runCommand('git config user.name "Test User"');
    runCommand('git add .');
    runCommand('git commit -m "Initial commit"');
  });

  afterAll(() => {
    // A root Directory.Packages.props enables CPM workspace-wide; leaving it behind makes
    // `dotnet restore` fail with NU1008 for every other .NET e2e project.
    cleanupProject();
  });

  function bumpSerilog(version: string) {
    updateFile(
      'Directory.Packages.props',
      rootPackagesProps(version, '13.0.1')
    );
    for (const project of ['PkgA', 'PkgB', 'PkgC']) {
      runCommand(`dotnet restore`, { cwd: tmpProjPath(project) });
    }
  }

  function restorePackagesProps() {
    updateFile(
      'Directory.Packages.props',
      rootPackagesProps('3.1.1', '13.0.1')
    );
    for (const project of ['PkgA', 'PkgB', 'PkgC']) {
      runCommand(`dotnet restore`, { cwd: tmpProjPath(project) });
    }
  }

  describe('project graph', () => {
    it('creates one external node per referenced package', () => {
      // `nx graph --file` serializes only nodes and dependencies; external nodes live in the
      // cached graph, so read the canonical artifact the CLI itself maintains.
      runCLI('graph --file=graph.json');
      const graph = readJson('.nx/workspace-data/project-graph.json');

      const nugetNodes = Object.keys(graph.externalNodes ?? {}).filter((n) =>
        n.startsWith('nuget:')
      );

      expect(nugetNodes).toEqual(
        expect.arrayContaining([
          'nuget:Serilog@3.1.1',
          'nuget:Newtonsoft.Json@13.0.1',
        ])
      );

      expect(graph.dependencies['PkgB']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'nuget:Serilog@3.1.1' }),
        ])
      );
      // PkgC references nothing, so it must not depend on any package.
      expect(
        (graph.dependencies['PkgC'] ?? []).filter((d: any) =>
          d.target.startsWith('nuget:')
        )
      ).toEqual([]);
    });

    it('declares per-package externalDependencies instead of the manifest file', () => {
      const build = JSON.parse(runCLI('show project PkgB --json')).targets
        .build;

      expect(build.inputs).toEqual(
        expect.arrayContaining([
          { externalDependencies: ['nuget:Serilog@3.1.1'] },
        ])
      );
      // The whole-file input is what made every consumer invalidate each other.
      expect(build.inputs).not.toContain(
        '{workspaceRoot}/Directory.Packages.props'
      );
      // Everything above must be inferred — no project.json should have materialized.
      expect(require('fs').existsSync(tmpProjPath('PkgB/project.json'))).toBe(
        false
      );
    });

    it('gives a project with no packages an empty externalDependencies input', () => {
      // This also opts it out of Nx's AllExternalDependencies fallback, so unrelated npm
      // churn in a mixed workspace stops invalidating it.
      const build = JSON.parse(runCLI('show project PkgC --json')).targets
        .build;

      expect(build.inputs).toEqual(
        expect.arrayContaining([{ externalDependencies: [] }])
      );
    });
  });

  describe('nx affected', () => {
    afterEach(() => {
      restorePackagesProps();
      runCommand('git checkout -- Directory.Packages.props');
    });

    it('selects only the projects referencing the bumped package', () => {
      bumpSerilog('4.0.0');

      const affected = JSON.parse(
        runCLI('show projects --affected --base=HEAD --json')
      );

      expect(affected).toContain('PkgB');
      expect(affected).not.toContain('PkgA');
      expect(affected).not.toContain('PkgC');
    });

    it('selects nothing when the manifest changes but no version does', () => {
      updateFile(
        'Directory.Packages.props',
        `${rootPackagesProps('3.1.1', '13.0.1')}\n<!-- unrelated edit -->`
      );

      const affected = JSON.parse(
        runCLI('show projects --affected --base=HEAD --json')
      );

      expect(affected).toEqual([]);
    });
  });

  describe('caching', () => {
    // Invalidation relies on the daemon's file watcher keeping the workspace context current,
    // as with every other plugin's createNodes caching.
    it('rebuilds only the projects referencing the bumped package', () => {
      runCLI('run-many -t build -p PkgA,PkgB,PkgC');
      expect(
        runCLI('run-many -t build -p PkgA,PkgB,PkgC', { verbose: true })
      ).toContain('3/3');

      bumpSerilog('4.0.0');

      const output = runCLI('run-many -t build -p PkgA,PkgB,PkgC', {
        verbose: true,
      });

      // PkgA and PkgC stay cached; only PkgB references the package that moved.
      expect(output).toContain('2/3');

      restorePackagesProps();
    });
  });
});
