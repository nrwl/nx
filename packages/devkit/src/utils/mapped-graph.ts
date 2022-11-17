import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';

export type MappedProjectGraph<T = any> = ProjectGraph<T> & {
  allFiles: Record<string, string>;
};

export function removeExt(file: string): string {
  return file.replace(/(?<!(^|\/))\.[^/.]+$/, '');
}

/**
 * Maps the project graph to a format that makes it easier to find the project
 * based on the file path.
 * @param projectGraph
 * @returns
 */
export function mapProjectGraphFiles<T>(
  projectGraph: ProjectGraph<T>
): MappedProjectGraph | null {
  if (!projectGraph) {
    return null;
  }
  const allFiles: Record<string, string> = {};
  Object.entries(
    projectGraph.nodes as Record<string, ProjectGraphProjectNode>
  ).forEach(([name, node]) => {
    node.data.files.forEach(({ file }) => {
      const fileName = removeExt(file);
      allFiles[fileName] = name;
    });
  });

  return {
    ...projectGraph,
    allFiles,
  };
}
