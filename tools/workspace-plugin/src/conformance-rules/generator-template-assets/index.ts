import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { AssetsJson } from '../../plugins/copy-assets-plugin.js';
import {
  collectCopiedFiles,
  readBuildLayout,
  type BuildLayout,
} from '../utils/copied-assets.js';

export default createConformanceRule({
  name: 'generator-template-assets',
  category: 'consistency',
  description:
    'Ensures the EJS templates a generator reads with generateFiles are copied into the built package, so the published generator finds them next to its own compiled file',
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

    for (const project of Object.values(projectGraph.nodes)) {
      const projectRoot = project.data.root;
      const assetsPath = join(workspaceRoot, projectRoot, 'assets.json');
      if (!existsSync(assetsPath)) continue;

      const buildLayout = readBuildLayout(projectRoot, workspaceRoot);
      if (!buildLayout) continue;

      violations.push(
        ...validateGeneratorTemplateAssets({
          assetsJson: readJsonFile<AssetsJson>(assetsPath),
          buildLayout,
          projectRoot,
          sourceProject: project.name,
          assetsPath,
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

export function validateGeneratorTemplateAssets(opts: {
  assetsJson: AssetsJson;
  buildLayout: BuildLayout;
  projectRoot: string;
  sourceProject: string;
  assetsPath: string;
  rootDir: string;
}): ConformanceViolation[] {
  const { assetsJson, buildLayout, projectRoot, rootDir } = opts;
  const packageDir = join(rootDir, projectRoot);
  const sourceDir = resolve(packageDir, buildLayout.sourceDir);
  const outputDir = resolve(packageDir, buildLayout.outDir);

  const templates = collectTemplateFiles(sourceDir, outputDir);
  if (!templates.length) return [];

  const copied = collectCopiedFiles(assetsJson, projectRoot, rootDir);

  const violations: ConformanceViolation[] = [];
  for (const template of templates) {
    // generateFiles resolves its directory from the generator's own __dirname,
    // so a template has to land at the path tsc's rootDir/outDir mapping gives
    // it. Copied anywhere else it is published but unreachable.
    const expected = join(outputDir, relative(sourceDir, template));
    if (copied.has(expected)) continue;

    violations.push({
      message: `The generator template "${relative(
        packageDir,
        template
      )}" is not copied to "${relative(
        rootDir,
        expected
      )}", so generateFiles cannot read it from the published package. Add an assets.json glob that copies the template directory.`,
      sourceProject: opts.sourceProject,
      file: opts.assetsPath,
    });
  }

  return violations;
}

/**
 * Every file below a template directory. `files` and its suffixed variants
 * (`files-angular`, `files-integrated-repo`) are the workspace convention for a
 * generateFiles directory, and everything under one is a template whatever its
 * extension.
 *
 * A package that compiles from its own root has `outputDir` and `node_modules`
 * inside `sourceDir`. Templates a build already copied would otherwise be read
 * back as sources and checked for a second copy one directory deeper.
 */
function collectTemplateFiles(sourceDir: string, outputDir: string): string[] {
  if (!existsSync(sourceDir)) return [];

  const templates: string[] = [];
  const walk = (dir: string, insideTemplate: boolean) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (path === outputDir || entry.name === 'node_modules') continue;
        walk(path, insideTemplate || isTemplateDirectory(entry.name));
      } else if (insideTemplate && entry.isFile()) {
        templates.push(path);
      }
    }
  };
  walk(sourceDir, false);

  return templates;
}

function isTemplateDirectory(name: string): boolean {
  return name === 'files' || name.startsWith('files-');
}
