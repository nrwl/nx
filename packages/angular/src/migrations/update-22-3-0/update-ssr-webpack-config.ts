import {
  formatFiles,
  joinPathFragments,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { readCompilerOptionsFromTsConfig } from '../../generators/utils/tsconfig-utils';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { allTargetOptions } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

type TsConfig = {
  compilerOptions?: {
    module?: string;
    moduleResolution?: string;
  };
};

const serverExecutors = new Set([
  '@angular-devkit/build-angular:server',
  '@nx/angular:webpack-server',
]);

let ts: typeof import('typescript') | undefined;

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/ssr',
  ]);

  // Map project root → {tsConfigPath, serverFiles[]}
  const projectFilesMap = new Map<
    string,
    { tsConfigPath: string; serverFiles: Set<string> }
  >();

  // First pass: collect files grouped by project
  for (const { data: project } of projects) {
    if (project.projectType !== 'application') {
      continue;
    }

    for (const target of Object.values(project.targets ?? {})) {
      if (!serverExecutors.has(target.executor)) {
        continue;
      }

      const tsConfigServerPath = joinPathFragments(
        project.root,
        'tsconfig.server.json'
      );
      if (!tree.exists(tsConfigServerPath)) {
        continue;
      }

      // Get or create entry for this project
      let projectEntry = projectFilesMap.get(project.root);
      if (!projectEntry) {
        projectEntry = {
          tsConfigPath: tsConfigServerPath,
          serverFiles: new Set<string>(),
        };
        projectFilesMap.set(project.root, projectEntry);
      }

      // Collect server files for this project
      for (const [, options] of allTargetOptions<{ main?: string }>(target)) {
        if (options?.main && tree.exists(options.main)) {
          projectEntry.serverFiles.add(options.main);
        }
      }
    }
  }

  if (projectFilesMap.size === 0) {
    return;
  }

  // Second pass: process each project
  ts = ensureTypescript();

  for (const { tsConfigPath, serverFiles } of projectFilesMap.values()) {
    const wasUpdated = updateTsConfigServer(tree, tsConfigPath);

    // Only update server files if tsconfig was actually modified
    if (wasUpdated) {
      for (const serverFile of serverFiles) {
        updateServerImports(tree, serverFile);
      }
    }
  }

  await formatFiles(tree);
}

function updateTsConfigServer(tree: Tree, tsConfigPath: string): boolean {
  const compilerOptions = readCompilerOptionsFromTsConfig(tree, tsConfigPath);

  if (
    compilerOptions.module === ts.ModuleKind.Preserve &&
    compilerOptions.moduleResolution === ts.ModuleResolutionKind.Bundler
  ) {
    // Already configured correctly, skip
    return false;
  }

  updateJson<TsConfig>(tree, tsConfigPath, (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.module = 'preserve';
    json.compilerOptions.moduleResolution = 'bundler';
    return json;
  });

  return true;
}

function updateServerImports(tree: Tree, serverFilePath: string): void {
  const content = tree.read(serverFilePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    serverFilePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const allImportDeclarations = sourceFile.statements.filter(
    ts.isImportDeclaration
  );
  if (allImportDeclarations.length === 0) {
    return;
  }

  let recorder: FileChangeRecorder | undefined;

  // Find namespace imports (import * as X from 'Y')
  for (const importDecl of allImportDeclarations) {
    if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
      continue;
    }

    const namedBindings = importDecl.importClause?.namedBindings;

    // Check if this is a namespace import (import * as X) and there's no
    // default import (e.g., "import express, * as types from 'express'")
    if (
      namedBindings &&
      ts.isNamespaceImport(namedBindings) &&
      !importDecl.importClause?.name
    ) {
      const importName = namedBindings.name.text;
      const moduleSpecifier = importDecl.moduleSpecifier.text;

      recorder ??= new FileChangeRecorder(tree, serverFilePath);

      // import * as express from 'express' -> import express from 'express'
      recorder.replace(
        importDecl,
        `import ${importName} from '${moduleSpecifier}';`
      );
    }
  }

  if (recorder) {
    recorder.applyChanges();
  }
}
