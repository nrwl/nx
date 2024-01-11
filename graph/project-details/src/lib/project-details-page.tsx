/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';
import { useRouteLoaderData } from 'react-router-dom';
import ProjectDetails from './project-details';

export function ProjectDetailsPage() {
  const { project, sourceMap } = useRouteLoaderData(
    'selectedProjectDetails'
  ) as {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
  };

  return ProjectDetails({ project, sourceMap });
}
