import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNode,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';

export function buildExplicitNpmDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: (s: string) => string
) {
  const importLocator = new TypeScriptImportLocator(fileRead);

  const npmProjects = Object.values(nodes).filter(
    (node) => node.type === 'npm'
  ) as ProjectGraphNode<{ packageName: string; version: string }>[];

  Object.keys(ctx.fileMap).forEach((source) => {
    Object.values(ctx.fileMap[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const pkg = npmProjects.find((pkg) =>
            isNpmPackageImport(pkg.data.packageName, importExpr)
          );
          if (pkg) {
            const target = nodes[pkg.name];
            if (source && target) {
              addDependency(type, source, target.name);
            }
          }
        }
      );
    });
  });
}

function isNpmPackageImport(p: string, e: string) {
  const toMatch = e
    .split(/[\/]/)
    .slice(0, p.startsWith('@') ? 2 : 1)
    .join('/');
  return toMatch === p;
}
