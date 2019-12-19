import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import * as ts from 'typescript';
import { appRootPath } from '../../../utils/app-root';
import { readTsConfig } from '../../../utils/typescript';

let compilerHost: {
  host: ts.CompilerHost;
  options: ts.CompilerOptions;
  moduleResolutionCache: ts.ModuleResolutionCache;
};
export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: (s: string) => string
) {
  const importLocator = new TypeScriptImportLocator(fileRead);

  Object.keys(ctx.fileMap).forEach(source => {
    Object.values(ctx.fileMap[source]).forEach(f => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = findTargetProject(importExpr, nodes, f.file);
          if (source && target) {
            addDependency(type, source, target);
          }
        }
      );
    });
  });

  function findTargetProject(importExpr, nodes, filePath) {
    compilerHost = compilerHost || getCompilerHost();
    const { options, host, moduleResolutionCache } = compilerHost;

    importExpr = importExpr.split('#')[0];

    const { resolvedModule } = ts.resolveModuleName(
      importExpr,
      filePath,
      options,
      host,
      moduleResolutionCache
    );

    // module was not found in the workspace - return
    if (!resolvedModule) {
      return;
    }

    return Object.keys(nodes).find(projectName =>
      resolvedModule.resolvedFileName
        .replace(appRootPath, '')
        .includes(nodes[projectName].data.root)
    );
  }
}

function getCompilerHost() {
  const { options } = readTsConfig(`${appRootPath}/tsconfig.json`);
  const host = ts.createCompilerHost(options, true);
  const moduleResolutionCache = ts.createModuleResolutionCache(
    appRootPath,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}
