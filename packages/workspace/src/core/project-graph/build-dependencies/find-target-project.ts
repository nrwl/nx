import { resolveModuleByImport } from '../../../utils/typescript';
import { normalizedProjectRoot } from '../../file-utils';
import { ProjectGraphNodeRecords } from '../project-graph-models';

export function findTargetProjectWithImport(
  importExpr: string,
  filePath: string,
  npmScope: string,
  nodes: ProjectGraphNodeRecords,
  nodeNames: string[]
) {
  const normalizedImportExpr = importExpr.split('#')[0];

  const resolvedModule = resolveModuleByImport(normalizedImportExpr, filePath);

  return nodeNames.find(projectName => {
    const p = nodes[projectName];
    if (resolvedModule && resolvedModule.includes(p.data.root)) {
      return true;
    } else {
      const normalizedRoot = normalizedProjectRoot(p);
      const projectImport = `@${npmScope}/${normalizedRoot}`;
      return normalizedImportExpr.startsWith(projectImport);
    }
  });
}
