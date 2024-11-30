import { createProjectGraphAsync } from '@nx/devkit';

export async function detectUiFramework(
  project: string
): Promise<'angular' | 'react' | 'none'> {
  const graph = await createProjectGraphAsync();

  for (const dep of graph.dependencies[project]) {
    if (dep.source !== project) {
      continue;
    }

    if (dep.target.startsWith('npm:@angular/')) {
      return 'angular';
    }

    if (dep.target === 'npm:react') {
      return 'react';
    }
  }

  return 'none';
}
