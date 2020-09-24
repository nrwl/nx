import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNode,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { FileRead } from '../../file-utils';
import { isRelativePath } from '../../../utils/fileutils';

export function buildExplicitNpmDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: FileRead
) {
  const importLocator = new TypeScriptImportLocator(fileRead);

  const npmProjects = Object.values(nodes).filter(
    (node) => node.type === 'npm'
  ) as ProjectGraphNode<{ packageName: string; version: string }>[];
  const cache = new Map<string, string>();

  Object.keys(ctx.fileMap).forEach((source) => {
    Object.values(ctx.fileMap[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          if (isRelativePath(importExpr)) {
            return;
          }

          let pkgName: string;
          if (cache.has(importExpr)) {
            pkgName = cache.get(importExpr);
          } else {
            pkgName = npmProjects.find((pkg) =>
              importExpr.startsWith(pkg.data.packageName)
            )?.name;
            cache.set(importExpr, pkgName);
          }
          if (pkgName) {
            const target = nodes[pkgName];
            if (source && target) {
              addDependency(type, source, target.name);
            }
          }
        }
      );
    });
  });
}
