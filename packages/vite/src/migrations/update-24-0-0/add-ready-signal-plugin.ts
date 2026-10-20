import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import type {
  ObjectLiteralExpression,
  ObjectLiteralElementLike,
  SourceFile,
} from 'typescript';
import { findConfigObject } from '../../utils/vite-config-edit-utils';

const PLUGIN_SPECIFIER = '@nx/vite/plugins/nx-ready-signal.plugin';
const CONFIG_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'];

type EditResult =
  | { kind: 'updated'; content: string }
  | { kind: 'library' }
  | { kind: 'skipped'; reason: string };

export default async function addReadySignalPlugin(tree: Tree) {
  const skipped: string[] = [];
  let changed = false;

  for (const [projectName, project] of getProjects(tree)) {
    if (project.projectType === 'library') continue;

    for (const extension of CONFIG_EXTENSIONS) {
      const configPath = joinPathFragments(
        project.root,
        `vite.config.${extension}`
      );
      if (!tree.exists(configPath)) continue;
      const content = tree.read(configPath, 'utf-8');
      if (
        content.includes('nx-ready-signal') ||
        content.includes('nxReadySignal')
      ) {
        continue;
      }

      let result: EditResult;
      try {
        result = addPlugin(content, configPath);
      } catch (error) {
        result = {
          kind: 'skipped',
          reason: `it could not be parsed: ${(error as Error).message}`,
        };
      }
      if (result.kind === 'updated') {
        tree.write(configPath, result.content);
        changed = true;
      } else if (result.kind === 'skipped') {
        skipped.push(
          `${configPath} (project ${projectName}): ${result.reason}`
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

  const nextStep = `Add \`nxReadySignal()\` from '${PLUGIN_SPECIFIER}' to the plugins of these Vite configs by hand, so that Nx waits for their dev server to listen: ${skipped.join('; ')}.`;
  logger.warn(nextStep);
  return {
    nextSteps: [nextStep],
    agentContext: [
      `Vite configs left unchanged because the codemod could not extend their plugins safely. Add \`import { nxReadySignal } from '${PLUGIN_SPECIFIER}'\` and \`nxReadySignal()\` to the plugins each one loads:`,
      ...skipped,
    ],
  };
}

function addPlugin(content: string, configPath: string): EditResult {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const ts: typeof import('typescript') = require('typescript');
  const file: SourceFile = tsquery.ast(
    content,
    configPath,
    /\.[cm]?js$/.test(configPath) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  );

  // The parser recovers from syntax errors, so the edit would land in a
  // guessed tree.
  if ((file as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length) {
    return { kind: 'skipped', reason: 'it has syntax errors' };
  }

  const config = findConfigObject(ts, tsquery, file);
  if (!config) {
    return {
      kind: 'skipped',
      reason:
        'its exported config is not a plain object literal (for example a `mergeConfig` call, an imported base config, or a factory with several returns)',
    };
  }

  // Mirrors @nx/vite/plugin, which infers no dev target for a library build
  // unless the config also sets server options.
  const build = findProperty(ts, config, 'build');
  if (
    build &&
    ts.isPropertyAssignment(build) &&
    ts.isObjectLiteralExpression(build.initializer) &&
    findProperty(ts, build.initializer, 'lib') &&
    !findProperty(ts, config, 'server')
  ) {
    return { kind: 'library' };
  }

  const changes: StringChange[] = [];
  const plugins = findProperty(ts, config, 'plugins');
  if (!plugins) {
    if (config.properties.some(ts.isSpreadAssignment)) {
      return {
        kind: 'skipped',
        reason: 'it spreads another config and declares no `plugins`',
      };
    }
    changes.push({
      type: ChangeType.Insert,
      index: config.getStart() + 1,
      text: '\n  plugins: [nxReadySignal()],',
    });
  } else if (
    !ts.isPropertyAssignment(plugins) ||
    !ts.isArrayLiteralExpression(plugins.initializer)
  ) {
    return {
      kind: 'skipped',
      reason: 'its `plugins` is not a plain array literal',
    };
  } else if (plugins.initializer.elements.some(ts.isSpreadElement)) {
    return {
      kind: 'skipped',
      reason: 'its `plugins` array spreads plugins from elsewhere',
    };
  } else {
    const { elements } = plugins.initializer;
    const last = elements[elements.length - 1];
    changes.push(
      last
        ? {
            type: ChangeType.Insert,
            index: last.getEnd(),
            text: ', nxReadySignal()',
          }
        : {
            type: ChangeType.Insert,
            index: plugins.initializer.getStart() + 1,
            text: 'nxReadySignal()',
          }
    );
  }

  changes.push(importChange(ts, file));
  return { kind: 'updated', content: applyChangesToString(content, changes) };
}

function findProperty(
  ts: typeof import('typescript'),
  object: ObjectLiteralExpression,
  name: string
): ObjectLiteralElementLike | undefined {
  return object.properties.find(
    (property) =>
      property.name &&
      (ts.isIdentifier(property.name) ||
        ts.isStringLiteral(property.name) ||
        ts.isNoSubstitutionTemplateLiteral(property.name)) &&
      property.name.text === name
  );
}

function importChange(
  ts: typeof import('typescript'),
  file: SourceFile
): StringChange {
  const imports = file.statements.filter(ts.isImportDeclaration);
  const requires = file.statements.filter(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        ({ initializer }) =>
          initializer &&
          ts.isCallExpression(initializer) &&
          initializer.expression.getText() === 'require'
      )
  );
  const esm = imports.length > 0 || file.statements.some(ts.isExportAssignment);
  const text = esm
    ? `import { nxReadySignal } from '${PLUGIN_SPECIFIER}';`
    : `const { nxReadySignal } = require('${PLUGIN_SPECIFIER}');`;
  const anchors = esm ? imports : requires;
  const anchor = anchors[anchors.length - 1];
  return anchor
    ? { type: ChangeType.Insert, index: anchor.getEnd(), text: `\n${text}` }
    : {
        type: ChangeType.Insert,
        // Not offset 0: a leading `/// <reference>` directive must stay on top.
        index: file.statements[0]?.getStart() ?? 0,
        text: `${text}\n\n`,
      };
}
