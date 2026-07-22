import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  toExecutorAssets,
  type AssetsJson,
} from '../../plugins/copy-assets-plugin.js';

const REFERENCE_KEYS = ['prompt', 'documentation'] as const;

export default createConformanceRule({
  name: 'migration-markdown-assets',
  category: 'consistency',
  description:
    'Ensures the files a migrations.json references resolve in the built package: the `prompt` and `documentation` markdown is copied into it, and every implementation path maps back to a source file',
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

    for (const project of Object.values(projectGraph.nodes)) {
      const projectRoot = project.data.root;
      const migrationsPath = join(
        workspaceRoot,
        projectRoot,
        'migrations.json'
      );
      const assetsPath = join(workspaceRoot, projectRoot, 'assets.json');
      if (!existsSync(migrationsPath) || !existsSync(assetsPath)) continue;

      violations.push(
        ...validateMigrationMarkdownAssets({
          migrations: readJsonFile(migrationsPath),
          assetsJson: readJsonFile<AssetsJson>(assetsPath),
          projectRoot,
          sourceProject: project.name,
          migrationsPath,
          rootDir: workspaceRoot,
        })
      );
    }

    return {
      severity: 'high',
      details: {
        violations,
      },
    };
  },
});

export function validateMigrationMarkdownAssets(opts: {
  migrations: Record<string, any>;
  assetsJson: AssetsJson;
  projectRoot: string;
  sourceProject: string;
  migrationsPath: string;
  rootDir: string;
}): ConformanceViolation[] {
  const { migrations, assetsJson, projectRoot, rootDir } = opts;
  const outputDir = resolve(rootDir, assetsJson.outDir);
  // Same precedence as nx's own migration resolution: a `generators` entry wins
  // over a `schematics` one of the same name.
  const entries = {
    ...(migrations.schematics ?? {}),
    ...(migrations.generators ?? {}),
  };

  const violations: ConformanceViolation[] = [];
  const referenced: { key: string; value: string; expected: string }[] = [];
  const buildLayout = readBuildLayout(projectRoot, rootDir);
  for (const migration of Object.values<any>(entries)) {
    // Same precedence as nx's own resolution: `implementation` wins over `factory`.
    const implementation = migration.implementation || migration.factory;
    if (implementation && buildLayout) {
      const violation = validateImplementationPath(
        implementation,
        buildLayout,
        opts
      );
      if (violation) violations.push(violation);
    }

    for (const key of REFERENCE_KEYS) {
      const value = migration[key];
      if (!value) continue;
      const expected = resolve(rootDir, projectRoot, value);
      if (!isInside(outputDir, expected)) {
        violations.push({
          message: `The \`${key}\` file "${value}" referenced by migrations.json resolves outside the built output "${assetsJson.outDir}". Migration references resolve relative to the installed package root and must point inside the built output.`,
          sourceProject: opts.sourceProject,
          file: opts.migrationsPath,
        });
        continue;
      }
      referenced.push({ key, value, expected });
    }
  }

  if (referenced.length) {
    const copied = collectCopiedFiles(assetsJson, projectRoot, rootDir);
    for (const { key, value, expected } of referenced) {
      if (copied.has(expected)) continue;
      violations.push({
        message: `The \`${key}\` file "${value}" referenced by migrations.json is not copied into "${assetsJson.outDir}", so the published package does not contain it. Either the source file is missing or no assets.json glob copies it to that path.`,
        sourceProject: opts.sourceProject,
        file: opts.migrationsPath,
      });
    }
  }

  return violations;
}

type BuildLayout = { sourceDir: string; outDir: string };

/**
 * Reads the `rootDir`/`outDir` the package builds with. Returns null when
 * neither tsconfig declares both, so a package whose layout cannot be
 * determined is left unchecked rather than checked against a guess.
 */
function readBuildLayout(
  projectRoot: string,
  rootDir: string
): BuildLayout | null {
  for (const tsconfig of ['tsconfig.lib.json', 'tsconfig.json']) {
    const tsconfigPath = join(rootDir, projectRoot, tsconfig);
    if (!existsSync(tsconfigPath)) continue;
    const compilerOptions = readJsonFile(tsconfigPath).compilerOptions ?? {};
    if (compilerOptions.rootDir && compilerOptions.outDir) {
      return {
        sourceDir: compilerOptions.rootDir,
        outDir: compilerOptions.outDir,
      };
    }
  }

  return null;
}

/**
 * Implementations are tsc outputs rather than copied assets, so the assets
 * pipeline cannot vouch for them. Map the published path back through the
 * build's `rootDir`/`outDir` and check the source file it comes from instead.
 */
function validateImplementationPath(
  implementation: string,
  buildLayout: BuildLayout,
  opts: {
    projectRoot: string;
    sourceProject: string;
    migrationsPath: string;
    rootDir: string;
  }
): ConformanceViolation | null {
  const packageDir = join(opts.rootDir, opts.projectRoot);
  const outputDir = resolve(packageDir, buildLayout.outDir);
  // A `#member` suffix names an export within the file; only the path matters here.
  const publishedPath = implementation.split('#')[0];
  const published = resolve(packageDir, publishedPath);

  if (!isInside(outputDir, published)) {
    return {
      message: `The implementation "${implementation}" referenced by migrations.json resolves outside the build output "${buildLayout.outDir}". Implementation paths are published paths and must point at a file the build emits.`,
      sourceProject: opts.sourceProject,
      file: opts.migrationsPath,
    };
  }

  const sourceFile = `${join(
    packageDir,
    buildLayout.sourceDir,
    relative(outputDir, published)
  )}.ts`;
  if (!existsSync(sourceFile)) {
    return {
      message: `The implementation "${implementation}" referenced by migrations.json maps back to "${relative(
        opts.rootDir,
        sourceFile
      )}", which does not exist, so the build emits nothing at that path.`,
      sourceProject: opts.sourceProject,
      file: opts.migrationsPath,
    };
  }

  return null;
}

/**
 * Drives the real copy-assets pipeline over the working tree with a collecting
 * callback in place of the copying one, so the resulting paths are the ones a
 * build would produce, without writing any of them.
 */
function collectCopiedFiles(
  assetsJson: AssetsJson,
  projectRoot: string,
  rootDir: string
): Set<string> {
  const copied = new Set<string>();
  new CopyAssetsHandler({
    rootDir,
    projectDir: join(rootDir, projectRoot),
    outputDir: resolve(rootDir, assetsJson.outDir),
    assets: toExecutorAssets(assetsJson, projectRoot),
    callback: (events) => {
      for (const event of events) copied.add(event.dest);
    },
  }).processAllAssetsOnceSync();

  return copied;
}

function isInside(dir: string, file: string): boolean {
  const rel = relative(dir, file);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}
