import type { CompositeProjectEdgeElementData } from '@nx/graph';
import { Tag } from '@nx/graph-ui-common';
import { useMemo } from 'react';
import { ContextMenuList } from './context-menu-list';
import { extractDependencyTarget } from '../util';

export function CompositeProjectEdgeContextMenu({
  data,
}: {
  data: CompositeProjectEdgeElementData;
}) {
  const edgeLabel = useMemo(() => {
    return data.sourceData.name + ' → ' + data.targetData.name;
  }, [data.sourceData.name, data.targetData.name]);

  const fileDependencySections = useMemo(() => {
    const sections = [];

    // Handle composite source node
    if (data.sourceData.type === 'composite-project') {
      if (!data.sourceData.fileMap) return sections;

      for (const projectName of Object.keys(data.sourceData.fileMap)) {
        const filesData = data.sourceData.fileMap[projectName];
        const dependencies: string[] = [];

        for (const fileData of filesData) {
          if (!fileData.deps) continue;

          const hasTargetDep = fileData.deps.find((dep) => {
            const depTarget = extractDependencyTarget(dep);

            // Check if dependency points to target directly
            if (
              data.targetData.id === depTarget ||
              data.targetData.name === depTarget
            ) {
              return true;
            }

            // If target is composite, check if it includes this dependency
            if (
              data.targetData.type === 'composite-project' &&
              data.targetData.projects
            ) {
              return data.targetData.projects.some(
                (project) =>
                  project.id === depTarget || project.name === depTarget
              );
            }

            return false;
          });

          if (!hasTargetDep) continue;

          // For composite source, file paths are already relative
          dependencies.push(fileData.file);
        }

        if (dependencies.length === 0) continue;

        sections.push({ label: projectName, items: dependencies });
      }

      return sections;
    }

    // Handle regular project source node
    if (data.sourceData.type === 'project') {
      if (!data.sourceData.files) return sections;

      const dependencies: string[] = [];

      for (const fileData of data.sourceData.files) {
        if (!fileData.deps) continue;

        const hasTargetDep = fileData.deps.find((dep) => {
          const depTarget = extractDependencyTarget(dep);

          // Check if dependency points to target directly
          if (
            data.targetData.id === depTarget ||
            data.targetData.name === depTarget
          ) {
            return true;
          }

          // If target is composite, check if it includes this dependency
          if (
            data.targetData.type === 'composite-project' &&
            data.targetData.projects
          ) {
            return data.targetData.projects.some(
              (project) =>
                project.id === depTarget || project.name === depTarget
            );
          }

          return false;
        });

        if (!hasTargetDep) continue;

        // Remove the project root from the file path to get relative path
        const fileName = fileData.file.startsWith(data.sourceData.root + '/')
          ? fileData.file.slice(data.sourceData.root.length + 1)
          : fileData.file;

        dependencies.push(fileName);
      }

      if (dependencies.length === 0) return sections;

      sections.push({ label: data.sourceData.name, items: dependencies });
    }

    return sections;
  }, [data.sourceData, data.targetData]);

  return (
    <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2">
      <div className="flex items-center gap-2">
        <Tag>{data.depType ?? 'unknown'}</Tag>
        <span className="font-mono">{edgeLabel}</span>
      </div>
      <ContextMenuList sections={fileDependencySections} />
    </div>
  );
}
