import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';

export function buildExplicitNpmDependencies(
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
          const key = Object.keys(nodes).find(k =>
            isNpmPackageImport(k, importExpr)
          );
          const target = nodes[key];
          if (source && target && target.type === 'npm') {
            addDependency(type, source, target.name);
          }
        }
      );
    });
  });
}

function isNpmPackageImport(p, e) {
  const toMatch = e
    .split(/[\/]/)
    .slice(0, p.startsWith('@') ? 2 : 1)
    .join('/');
  return toMatch === p;
}
