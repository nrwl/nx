import { requireNx } from '../../nx';

export function logShowProjectCommand(projectName: string): void {
  if (process.env.NX_PCV3 !== 'true') {
    return;
  }
  const { output } = requireNx();
  output.log({
    title: `👀 View ${projectName} Project Details`,
    bodyLines: [
      `Run "nx show project ${projectName} --web" to view details about this project.`,
    ],
  });
}
