import * as chalk from 'chalk';
import { ProjectMigrator } from './project.migrator';
import { ValidationError } from './types';
import { workspaceMigrationErrorHeading } from './validation-logging';

export function validateProjects(migrators: ProjectMigrator[]): void {
  const erroredProjects: Record<string, ValidationError[]> = {};
  for (const migrator of migrators) {
    const result = migrator.validate();
    if (result) {
      erroredProjects[migrator.projectName] = result;
    }
  }

  if (!Object.keys(erroredProjects).length) {
    return;
  }

  throw new Error(
    `${workspaceMigrationErrorHeading}

${Object.entries(erroredProjects)
  .map(([project, errors]) => getProjectValidationErrorsText(project, errors))
  .join('\n\n')}`
  );
}

function getProjectValidationErrorsText(
  project: string,
  errors: ValidationError[]
): string {
  return `${getProjectHeading(project)}

  ${errors.map((error) => getValidationErrorText(error)).join('\n\n  ')}`;
}

function getValidationErrorText({
  message,
  messageGroup,
  hint,
}: ValidationError): string {
  let lines = message
    ? [`- ${message}`, ...(hint ? [chalk.dim(chalk.italic(`  ${hint}`))] : [])]
    : [
        `- ${messageGroup.title}:`,
        '  - Errors:',
        ...messageGroup.messages.map((message) => `    - ${message}`),
        ...(hint ? [chalk.dim(chalk.italic(`  - ${hint}`))] : []),
      ];

  return lines.join('\n  ');
}

function getProjectHeading(project: string): string {
  const line = '-'.repeat(project.length + 4);

  return chalk.bold(`${line}
  ${project}
${line}`);
}
