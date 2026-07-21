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
    'Ensures the markdown files a migrations.json references through `prompt` and `documentation` are copied into the built package',
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
  for (const migration of Object.values<any>(entries)) {
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
