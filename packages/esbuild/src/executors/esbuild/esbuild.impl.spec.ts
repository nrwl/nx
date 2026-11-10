import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { esbuildExecutor } from './esbuild.impl';
import type { EsBuildExecutorOptions } from './schema';

const fixture = vi.hoisted(() => ({ root: '' }));

vi.mock('@nx/devkit', async () => {
  const actual =
    await vi.importActual<typeof import('@nx/devkit')>('@nx/devkit');
  return {
    ...actual,
    get workspaceRoot() {
      return fixture.root;
    },
  };
});

describe('esbuild deployment dependencies', () => {
  let fs: TempFs;
  let previousCwd: string;

  beforeEach(() => {
    vi.mocked(isUsingTsSolutionSetup).mockReturnValue(false);
    previousCwd = process.cwd();
    fs = new TempFs('esbuild-deployment');
    fixture.root = fs.tempDir;
    process.chdir(fs.tempDir);
    fs.createFilesSync({
      'nx.json': '{}',
      'package.json': JSON.stringify({ name: 'workspace', version: '1.0.0' }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'es2020' },
      }),
      'apps/app/main.ts':
        "import value from 'fixture-external'; console.log(value());",
      'node_modules/fixture-external/package.json': JSON.stringify({
        name: 'fixture-external',
        version: '1.0.0',
        main: 'index.js',
      }),
      'node_modules/fixture-external/index.js':
        "module.exports = () => 'external-v1';",
      'package-lock.json': JSON.stringify({
        name: 'workspace',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': { name: 'workspace', version: '1.0.0' },
          'node_modules/fixture-external': { version: '1.0.0' },
        },
      }),
    });
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.cleanup();
  });

  it.each([
    [undefined, 'fixture-external', false],
    ['1.0.0', 'fixture-external', false],
    ['link:../outside', 'fixture-external', false],
    ['1.0.0', 'fixture-external/subpath', true],
  ] as const)(
    'generates the manifest with bare version %s and external %s',
    async (bareVersion, external, preserveManifest) => {
      // The resolver cache survives TempFs resets and uses workspace-relative directories.
      const projectRoot = preserveManifest ? 'apps/subpath-app' : 'apps/app';
      const ownManifest = {
        name: 'app',
        version: '1.2.3',
        devDependencies: { 'fixture-external': '1.0.0' },
      };
      if (preserveManifest) {
        fs.createFileSync(
          `${projectRoot}/package.json`,
          JSON.stringify(ownManifest)
        );
        fs.writeFile(
          `${projectRoot}/main.ts`,
          "import value from 'fixture-external/subpath'; console.log(value());"
        );
      }
      const options: EsBuildExecutorOptions = {
        main: `${projectRoot}/main.ts`,
        outputPath: 'dist/app',
        tsConfig: 'tsconfig.json',
        platform: 'node',
        format: ['cjs'],
        bundle: true,
        thirdParty: true,
        external: preserveManifest
          ? [external]
          : [external, 'missing-external'],
        generatePackageJson: true,
        skipTypeCheck: true,
      };
      const project = {
        root: projectRoot,
        targets: { build: { executor: '@nx/esbuild:esbuild', options } },
      };
      const graph: ProjectGraph = {
        nodes: { app: { name: 'app', type: 'app', data: project } },
        dependencies: { app: [] },
        externalNodes: {},
      };
      for (const version of ['1.0.0', '2.0.0']) {
        const name =
          bareVersion === version
            ? 'npm:fixture-external'
            : (`npm:fixture-external@${version}` as const);
        graph.externalNodes[name] = {
          name,
          type: 'npm',
          data: { packageName: 'fixture-external', version },
        };
      }
      if (bareVersion?.startsWith('link:')) {
        graph.externalNodes['npm:fixture-external'] = {
          name: 'npm:fixture-external',
          type: 'npm',
          data: { packageName: 'fixture-external', version: bareVersion },
        };
      }
      const context: ExecutorContext = {
        root: fs.tempDir,
        cwd: fs.tempDir,
        isVerbose: false,
        projectName: 'app',
        targetName: 'build',
        target: project.targets.build,
        projectsConfigurations: { version: 2, projects: { app: project } },
        nxJsonConfiguration: {},
        projectGraph: graph,
      };

      for await (const result of esbuildExecutor(options, context)) {
        expect(result.success).toBe(true);
      }
      const manifest = JSON.parse(await fs.readFile('dist/app/package.json'));
      expect(manifest.dependencies).toEqual(
        preserveManifest ? undefined : { 'fixture-external': '1.0.0' }
      );
      if (preserveManifest) {
        expect(manifest).toMatchObject(ownManifest);
      }
    }
  );
});
