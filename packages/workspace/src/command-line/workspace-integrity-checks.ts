import { ProjectNode } from './affected-apps';

export interface ErrorGroup {
  header: string;
  errors: string[];
}

export class WorkspaceIntegrityChecks {
  constructor(private projectNodes: ProjectNode[], private files: string[]) {}

  run(): ErrorGroup[] {
    return [...this.projectWithoutFilesCheck(), ...this.filesWithoutProjects()];
  }

  private projectWithoutFilesCheck(): ErrorGroup[] {
    const errors = this.projectNodes
      .filter(n => n.files.length === 0)
      .map(p => `Cannot find project '${p.name}' in '${p.root}'`);

    return errors.length === 0
      ? []
      : [{ header: 'The angular.json file is out of sync', errors }];
  }

  private filesWithoutProjects(): ErrorGroup[] {
    const allFilesFromProjects = this.allProjectFiles();
    const allFilesWithoutProjects = minus(this.files, allFilesFromProjects);
    const first5FilesWithoutProjects =
      allFilesWithoutProjects.length > 5
        ? allFilesWithoutProjects.slice(0, 5)
        : allFilesWithoutProjects;

    const errors = first5FilesWithoutProjects.map(
      p => `The '${p}' file doesn't belong to any project.`
    );

    return errors.length === 0
      ? []
      : [
          {
            header: `All files in 'apps' and 'libs' must be part of a project`,
            errors
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
