import {
  findInstalledCommunityPlugins,
  findInstalledPowerpackPlugins,
  findInstalledPackagesWeCareAbout,
  packagesWeCareAbout,
} from './report';

jest.mock('../../utils/plugins/installed-plugins', () => ({
  findInstalledPlugins: jest.fn(),
}));

jest.mock('../../utils/package-json', () => ({
  readModulePackageJson: jest.fn(),
}));

jest.mock('../../utils/installation-directory', () => ({
  getNxRequirePaths: jest.fn(() => []),
}));

import { findInstalledPlugins } from '../../utils/plugins/installed-plugins';
import { readModulePackageJson } from '../../utils/package-json';

const mockFindInstalledPlugins = findInstalledPlugins as jest.MockedFunction<
  typeof findInstalledPlugins
>;
const mockReadModulePackageJson = readModulePackageJson as jest.MockedFunction<
  typeof readModulePackageJson
>;

describe('Workspace Package Exclusion in Report', () => {
  let originalConsoleLog: typeof console.log;
  let consoleOutput: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    // Capture console.log output
    consoleOutput = [];
    originalConsoleLog = console.log;
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
    // Optionally print captured logs for debugging
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log('=== Captured console output ===');
      consoleOutput.forEach(log => console.log(log));
      console.log('=== End of captured output ===');
    }
  });

  describe('findInstalledPackagesWeCareAbout', () => {
    beforeEach(() => {
      mockReadModulePackageJson.mockImplementation((pkg: string) => {
        const versions = {
          lerna: '6.0.0',
          '@nx/react': '15.0.0',
          '@nx/workspace': '15.0.0',
          typescript: '4.8.0',
          'my-workspace-package': '1.0.0',
        };

        if (versions[pkg]) {
          return {
            packageJson: { name: pkg, version: versions[pkg] },
            path: `/node_modules/${pkg}/package.json`,
          };
        }
        throw new Error(`Package ${pkg} not found`);
      });
    });

    it('should include workspace packages if they are also installed', () => {
      const originalPackagesWeCareAbout = packagesWeCareAbout;
      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        'lerna',
        '@nx/react',
        '@nx/workspace',
        'typescript',
        'my-workspace-package'
      );

      const workspacePackages = new Set([
        'my-workspace-package',
        '@nx/workspace',
      ]);
      const result = findInstalledPackagesWeCareAbout(workspacePackages);

      // All packages should be included since they are installed
      expect(result).toHaveLength(5);
      expect(result.map((p) => p.package)).toContain('lerna');
      expect(result.map((p) => p.package)).toContain('@nx/react');
      expect(result.map((p) => p.package)).toContain('typescript');
      expect(result.map((p) => p.package)).toContain('my-workspace-package');
      expect(result.map((p) => p.package)).toContain('@nx/workspace');

      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        ...originalPackagesWeCareAbout
      );
    });

    it('should exclude workspace packages that are not installed', () => {
      const originalPackagesWeCareAbout = packagesWeCareAbout;
      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        'lerna',
        '@nx/react',
        '@nx/workspace',
        'typescript',
        'not-installed-workspace-package'
      );

      // Mock readModulePackageJson to only return some packages
      mockReadModulePackageJson.mockImplementation((pkg: string) => {
        const versions = {
          lerna: '6.0.0',
          '@nx/react': '15.0.0',
          '@nx/workspace': '15.0.0',
          typescript: '4.8.0',
          // not-installed-workspace-package is not in the versions map
        };

        if (versions[pkg]) {
          return {
            packageJson: { name: pkg, version: versions[pkg] },
            path: `/node_modules/${pkg}/package.json`,
          };
        }
        throw new Error(`Package ${pkg} not found`);
      });

      const workspacePackages = new Set([
        'not-installed-workspace-package',
        '@nx/workspace', // This one is installed
      ]);
      const result = findInstalledPackagesWeCareAbout(workspacePackages);

      // Should include installed packages (including workspace packages that are installed)
      // Should exclude workspace packages that are not installed
      expect(result).toHaveLength(4);
      expect(result.map((p) => p.package)).toContain('lerna');
      expect(result.map((p) => p.package)).toContain('@nx/react');
      expect(result.map((p) => p.package)).toContain('typescript');
      expect(result.map((p) => p.package)).toContain('@nx/workspace');
      expect(
        result.find((p) => p.package === 'not-installed-workspace-package')
      ).toBeUndefined();

      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        ...originalPackagesWeCareAbout
      );
    });

    it('should include all packages when no workspace packages are specified', () => {
      const originalPackagesWeCareAbout = packagesWeCareAbout;
      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        'lerna',
        '@nx/react',
        'typescript',
        'my-workspace-package'
      );

      const result = findInstalledPackagesWeCareAbout();

      expect(result).toHaveLength(4);
      expect(result.map((p) => p.package)).toContain('lerna');
      expect(result.map((p) => p.package)).toContain('@nx/react');
      expect(result.map((p) => p.package)).toContain('typescript');
      expect(result.map((p) => p.package)).toContain('my-workspace-package');

      (packagesWeCareAbout as any).splice(
        0,
        packagesWeCareAbout.length,
        ...originalPackagesWeCareAbout
      );
    });
  });
});
