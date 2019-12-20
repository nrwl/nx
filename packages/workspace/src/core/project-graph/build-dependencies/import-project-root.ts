import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNode,
  ProjectGraphNodeRecords
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { normalizedProjectRoot } from '../../file-utils';

export function buildImportsToProjectRoots(
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
          const targetProjectName = Object.keys(nodes).find(projectName => {
            const p = nodes[projectName];
            const normalizedRoot = normalizedProjectRoot(p);
            const normalizedImportExpr = importExpr.split('#')[0];
            const projectImport = `@${ctx.nxJson.npmScope}/${normalizedRoot}`;
            return normalizedImportExpr.startsWith(projectImport);
          });

          if (targetProjectName) {
            addDependency(type, source, targetProjectName);
          }
        }
      );
    });
  });
}
