import type { ProjectGraph } from '@nx/devkit';
import { getDependentPackagesForProject } from './dependencies';

export function isReactProject(
  projectName: string,
  projectGraph: ProjectGraph
): boolean {
  const project = projectGraph.nodes[projectName];
  if (!project) return false;

  // Check if the project has React dependencies
  const { npmPackages } = getDependentPackagesForProject(
    projectGraph,
    projectName
  );

  // Check for React-related packages
  const reactPackages = [
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
  ];
  const hasReactDependencies = reactPackages.some((pkg) =>
    npmPackages.includes(pkg)
  );

  return hasReactDependencies;
}
