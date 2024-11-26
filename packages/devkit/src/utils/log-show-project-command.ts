import { output } from 'nx/src/devkit-exports';

export function logShowProjectCommand(projectName: string): void {
  output.log({
    title: `👀 View Details of ${projectName}`,
    bodyLines: [
      `Run "nx show project ${projectName}" to view details about this project.`,
    ],
  });
}
