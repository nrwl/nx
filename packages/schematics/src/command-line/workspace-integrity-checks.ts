import { ProjectNode } from './affected-apps';

export interface ErrorGroup {
  header: string;
  errors: string[];
}

export class WorkspaceIntegrityChecks {
  constructor(
    private projectNodes: ProjectNode[],
    private files: string[],
    private packageJson: any
  ) {}

  run(): ErrorGroup[] {
    return [
      ...this.packageJsonConsistencyCheck(),
      ...this.projectWithoutFilesCheck(),
      ...this.filesWithoutProjects()
    ];
  }

  private packageJsonConsistencyCheck(): ErrorGroup[] {
    const nx = this.packageJson.dependencies['@nrwl/nx'];
    const schematics = this.packageJson.devDependencies['@nrwl/schematics'];
    if (schematics && nx && nx !== schematics) {
      return [
        {
          header: 'The package.json is inconsistent',
          errors: [
            'The versions of the @nrwl/nx and @nrwl/schematics packages must be the same.'
          ]
        }
      ];
    } else {
      return [];
    }
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
