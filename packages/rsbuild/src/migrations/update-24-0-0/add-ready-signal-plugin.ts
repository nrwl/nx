import {
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  type MigrationReturnObject,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type * as ts from 'typescript';
import { addBuildPlugin, findConfigObject } from '../../utils/add-build-plugin';

const CONFIG_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'];
const IMPORT_PATH = '@nx/rsbuild/ready-signal';
const PLUGIN_NAME = 'pluginNxReadySignal';

let tsModule: typeof ts;

export default async function update(
  tree: Tree
): Promise<MigrationReturnObject> {
  const skipped: string[] = [];
  let changed = false;

  for (const [projectName, project] of getProjects(tree)) {
    for (const extension of CONFIG_EXTENSIONS) {
      const configPath = joinPathFragments(
        project.root,
        `rsbuild.config.${extension}`
      );
      if (!tree.exists(configPath)) continue;
      const content = tree.read(configPath, 'utf-8');
      if (content.includes('ready-signal') || content.includes(PLUGIN_NAME)) {
        continue;
      }
      const reason = findUnsupportedShape(content);
      if (reason) {
        skipped.push(`${configPath} (project ${projectName}): ${reason}`);
        continue;
      }
      try {
        addBuildPlugin(tree, configPath, IMPORT_PATH, PLUGIN_NAME);
        changed = true;
      } catch (error) {
        skipped.push(
          `${configPath} (project ${projectName}): ${(error as Error).message}`
        );
      }
    }
  }

  if (changed) {
    await formatFiles(tree);
  }
  if (!skipped.length) {
    return { skipAgentic: true };
  }
  const message = `Add ${PLUGIN_NAME}() from '${IMPORT_PATH}' to the plugins of these Rsbuild configs so Nx can tell when their dev and preview servers are ready:\n${skipped
    .map((entry) => `- ${entry}`)
    .join('\n')}`;
  logger.warn(message);
  return {
    nextSteps: [message],
    agentContext: [
      `Rsbuild configs left unchanged because the generator could not extend their plugins safely. Add \`import { ${PLUGIN_NAME} } from '${IMPORT_PATH}'\` and \`${PLUGIN_NAME}()\` to the plugins each one loads:`,
      ...skipped,
    ],
  };
}

// addBuildPlugin splices an ESM import and defineConfig's own literal plugins
// array by text; every other shape goes to the prompt.
function findUnsupportedShape(content: string): string | undefined {
  tsModule ??= ensureTypescript();
  const sourceFile = tsModule.createSourceFile(
    'rsbuild.config.ts',
    content,
    tsModule.ScriptTarget.Latest,
    true,
    tsModule.ScriptKind.TS
  );
  if (
    (sourceFile as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length
  ) {
    return 'it has syntax errors';
  }
  if (content.includes('mergeRsbuildConfig')) {
    return 'it merges a shared base config, which may already load the plugin';
  }
  const calls = findDefineConfigCalls(sourceFile);
  if (calls.length !== 1) {
    return calls.length
      ? 'it calls defineConfig more than once'
      : 'it does not call defineConfig';
  }
  const config = findConfigObject(calls[0].arguments[0]);
  if (!config) {
    return 'defineConfig is not called with an object literal, or a function with a single return of one';
  }
  if (!sourceFile.statements.some(tsModule.isImportDeclaration)) {
    return 'it is a CommonJS module';
  }
  for (const property of config.properties) {
    if (tsModule.isSpreadAssignment(property)) {
      return 'it spreads another config into defineConfig';
    }
    if (getPropertyName(property) !== 'plugins') continue;
    if (
      !tsModule.isPropertyAssignment(property) ||
      !tsModule.isIdentifier(property.name)
    ) {
      return 'its plugins option is not a plain property assignment';
    }
    const plugins = property.initializer;
    if (!tsModule.isArrayLiteralExpression(plugins)) {
      return 'its plugins option is not an array literal';
    }
    if (plugins.elements.some(tsModule.isSpreadElement)) {
      return 'its plugins array spreads another list, which may already load the plugin';
    }
    const last = plugins.elements[plugins.elements.length - 1];
    if (last && /\/\/|\/\*/.test(content.slice(last.end, plugins.end - 1))) {
      return 'its plugins array ends with a comment';
    }
  }
  return undefined;
}

function findDefineConfigCalls(sourceFile: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (
      tsModule.isCallExpression(node) &&
      tsModule.isIdentifier(node.expression) &&
      node.expression.text === 'defineConfig'
    ) {
      calls.push(node);
    }
    tsModule.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function getPropertyName(
  property: ts.ObjectLiteralElementLike
): string | undefined {
  const name = property.name;
  if (
    name &&
    (tsModule.isIdentifier(name) ||
      tsModule.isStringLiteral(name) ||
      tsModule.isNoSubstitutionTemplateLiteral(name))
  ) {
    return name.text;
  }
  return undefined;
}
