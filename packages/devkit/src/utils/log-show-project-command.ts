import { requireNx } from '../../nx';

export function logShowProjectCommand(projectName: string): void {
  const { output } = requireNx();
  output.log({
    title: `👀 View Details of ${projectName}`,
    bodyLines: [
      `Run "nx show project ${projectName} --web" to view details about this project.`,
    ],
  });
}
