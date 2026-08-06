import { createTouchedDependenciesFunction } from './create-touched-dependencies';
import type { TouchedDependencyFile } from '@nx/devkit';

const context = { nxJsonConfiguration: {}, workspaceRoot: '/ws' };

function props(packages: Record<string, string>): string {
  const entries = Object.entries(packages)
    .map(
      ([id, version]) =>
        `    <PackageVersion Include="${id}" Version="${version}" />`
    )
    .join('\n');
  return `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
${entries}
  </ItemGroup>
</Project>`;
}

function file(
  baseContent: string | null,
  headContent: string | null,
  path = 'Directory.Packages.props'
): TouchedDependencyFile {
  return { file: path, baseContent, headContent };
}

function run(files: TouchedDependencyFile[]) {
  return createTouchedDependenciesFunction(files, undefined, context);
}

describe('createTouchedDependencies', () => {
  it('reports only the package whose version changed', () => {
    const before = props({ 'Newtonsoft.Json': '13.0.1', Serilog: '3.1.1' });
    const after = props({ 'Newtonsoft.Json': '13.0.1', Serilog: '4.0.0' });

    expect(run([file(before, after)])).toEqual(['nuget:Serilog@4.0.0']);
  });

  it('reports nothing when the file changed but no version did', () => {
    const before = props({ Serilog: '3.1.1' });
    const after = `${props({ Serilog: '3.1.1' })}\n<!-- a comment -->`;

    expect(run([file(before, after)])).toEqual([]);
  });

  it('reports added and removed packages', () => {
    const before = props({ Serilog: '3.1.1', Removed: '1.0.0' });
    const after = props({ Serilog: '3.1.1', Added: '2.0.0' });

    expect(new Set(run([file(before, after)]))).toEqual(
      new Set(['Removed', 'nuget:Added@2.0.0'])
    );
  });

  it('handles the Update form and single-quoted attributes', () => {
    const before = `<Project><ItemGroup><PackageVersion Update='Serilog' Version='3.1.1' /></ItemGroup></Project>`;
    const after = `<Project><ItemGroup><PackageVersion Update='Serilog' Version='4.0.0' /></ItemGroup></Project>`;

    expect(run([file(before, after)])).toEqual(['nuget:Serilog@4.0.0']);
  });

  it('handles reversed attribute order', () => {
    const before = `<Project><ItemGroup><PackageVersion Version="3.1.1" Include="Serilog" /></ItemGroup></Project>`;
    const after = `<Project><ItemGroup><PackageVersion Version="4.0.0" Include="Serilog" /></ItemGroup></Project>`;

    expect(run([file(before, after)])).toEqual(['nuget:Serilog@4.0.0']);
  });

  it('aggregates across several manifests', () => {
    const root = file(
      props({ 'Newtonsoft.Json': '13.0.1' }),
      props({ 'Newtonsoft.Json': '13.0.3' })
    );
    const nested = file(
      props({ Serilog: '3.1.1' }),
      props({ Serilog: '4.0.0' }),
      'group/Directory.Packages.props'
    );

    expect(new Set(run([root, nested]))).toEqual(
      new Set(['nuget:Newtonsoft.Json@13.0.3', 'nuget:Serilog@4.0.0'])
    );
  });

  describe('falls back to marking everything affected', () => {
    it('when the base revision could not be read', () => {
      expect(run([file(null, props({ Serilog: '4.0.0' }))])).toBe('*');
    });

    it('when the manifest was deleted', () => {
      expect(run([file(props({ Serilog: '3.1.1' }), null)])).toBe('*');
    });

    it('when neither side parses into package versions', () => {
      expect(run([file('<Project>', 'not xml at all')])).toBe('*');
    });

    it('even when another manifest in the same change parsed cleanly', () => {
      const parseable = file(
        props({ Serilog: '3.1.1' }),
        props({ Serilog: '4.0.0' })
      );
      const unreadable = file(
        null,
        props({ Other: '1.0.0' }),
        'x/Directory.Packages.props'
      );

      expect(run([parseable, unreadable])).toBe('*');
    });
  });

  it('treats a PackageVersion gaining an explicit version as a change', () => {
    const before = `<Project><ItemGroup><PackageVersion Include="Serilog" /></ItemGroup></Project>`;
    const after = props({ Serilog: '4.0.0' });

    expect(run([file(before, after)])).toEqual(['nuget:Serilog@4.0.0']);
  });
  it('treats a casing-only rename as no change, matching NuGet id semantics', () => {
    const before = props({ Serilog: '3.1.1' });
    const after = props({ serilog: '3.1.1' });

    expect(run([file(before, after)])).toEqual([]);
  });

  it('reports a version bump under the head casing when the id casing also changed', () => {
    const before = props({ serilog: '3.1.1' });
    const after = props({ Serilog: '4.0.0' });

    expect(run([file(before, after)])).toEqual(['nuget:Serilog@4.0.0']);
  });

  it('falls back to the bare id when the new version is empty', () => {
    const before = props({ Serilog: '4.0.0' });
    const after = `<Project><ItemGroup><PackageVersion Include="Serilog" Version="" /></ItemGroup></Project>`;

    expect(run([file(before, after)])).toEqual(['Serilog']);
  });

  describe('versions supplied by MSBuild expressions', () => {
    it('treats an expression-versioned package as touched on every edit', () => {
      const before = `<Project>
  <PropertyGroup>
    <SerilogVersion>3.1.1</SerilogVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="$(SerilogVersion)" />
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>
</Project>`;
      const after = before.replace(
        '3.1.1</SerilogVersion>',
        '4.0.0</SerilogVersion>'
      );

      expect(run([file(before, after)])).toEqual(['Serilog']);
    });

    it('keeps exact attribution for literal versions alongside an expression', () => {
      const before = `<Project><ItemGroup>
        <PackageVersion Include="Serilog" Version="$(SerilogVersion)" />
        <PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />
      </ItemGroup></Project>`;
      const after = before.replace('13.0.1', '13.0.3');

      expect(new Set(run([file(before, after)]))).toEqual(
        new Set(['Serilog', 'nuget:Newtonsoft.Json@13.0.3'])
      );
    });

    it('does not emit a node name containing an unevaluated expression', () => {
      const before = `<Project><ItemGroup><PackageVersion Include="Serilog" Version="$(OldVersion)" /></ItemGroup></Project>`;
      const after = `<Project><ItemGroup><PackageVersion Include="Serilog" Version="$(NewVersion)" /></ItemGroup></Project>`;

      expect(run([file(before, after)])).toEqual(['Serilog']);
    });
  });
});
