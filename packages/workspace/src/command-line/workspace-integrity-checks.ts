import { output, CLIErrorMessageConfig } from './output';
import { workspaceFileName, ProjectNode } from './shared';

export class WorkspaceIntegrityChecks {
  constructor(private projectNodes: ProjectNode[], private files: string[]) {}

  run(): CLIErrorMessageConfig[] {
    return [...this.projectWithoutFilesCheck(), ...this.filesWithoutProjects()];
  }

  private projectWithoutFilesCheck(): CLIErrorMessageConfig[] {
    const errors = this.projectNodes
      .filter(n => n.files.length === 0)
      .map(p => `Cannot find project '${p.name}' in '${p.root}'`);

    const errorGroupBodyLines = errors.map(
      f => `${output.colors.gray('-')} ${f}`
    );

    return errors.length === 0
      ? []
      : [
          {
            title: `The ${workspaceFileName()} file is out of sync`,
            bodyLines: errorGroupBodyLines
            /**
             * TODO(JamesHenry): Add support for error documentation
             */
            // slug: 'project-has-no-files'
          }
        ];
  }

  private filesWithoutProjects(): CLIErrorMessageConfig[] {
    const allFilesFromProjects = this.allProjectFiles();
    const allFilesWithoutProjects = minus(this.files, allFilesFromProjects);
    const first5FilesWithoutProjects =
      allFilesWithoutProjects.length > 5
        ? allFilesWithoutProjects.slice(0, 5)
        : allFilesWithoutProjects;

    const errorGroupBodyLines = first5FilesWithoutProjects.map(
      f => `${output.colors.gray('-')} ${f}`
    );

    return first5FilesWithoutProjects.length === 0
      ? []
      : [
          {
            title: `The following file(s) do not belong to any projects:`,
            bodyLines: errorGroupBodyLines
            /**
             * TODO(JamesHenry): Add support for error documentation
             */
            // slug: 'file-does-not-belong-to-project'
          }
        ];
  }

  private allProjectFiles() {
    return this.projectNodes.reduce((m, c) => [...m, ...c.files], []);
  }
}

function minus(a: string[], b: string[]): string[] {
  return a.filter(aa => b.indexOf(aa) === -1);
}
