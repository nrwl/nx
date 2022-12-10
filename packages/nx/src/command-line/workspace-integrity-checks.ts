import { CLIWarnMessageConfig, output } from '../utils/output';
import type { CLIErrorMessageConfig } from '../utils/output';
import { workspaceFileName } from '../project-graph/file-utils';
import { ProjectGraph } from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { PackageJson } from '../utils/package-json';
import { joinPathFragments } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import { gt, gte, valid } from 'semver';

export class WorkspaceIntegrityChecks {
  nxPackageJson = readJsonFile<typeof import('../../package.json')>(
    joinPathFragments(__dirname, '../../package.json')
  );

  constructor(private projectGraph: ProjectGraph, private files: string[]) {}

  run(): { error: CLIErrorMessageConfig[]; warn: CLIWarnMessageConfig[] } {
    const errors = [
      ...this.projectWithoutFilesCheck(),
      ...this.filesWithoutProjects(),
    ];
    const warnings = [];

    // @todo(AgentEnder) - Remove this check after v15
    if (gte(this.nxPackageJson.version, '15.0.0')) {
      errors.push(...this.misalignedPackages());
    } else {
      warnings.push(...this.misalignedPackages());
    }

    return {
      error: errors,
      warn: warnings,
    };
  }

  private projectWithoutFilesCheck(): CLIErrorMessageConfig[] {
    const errors = Object.values(this.projectGraph.nodes)
      .filter((n) => n.data.files.length === 0)
      .map((p) => `Cannot find project '${p.name}' in '${p.data.root}'`);

    const errorGroupBodyLines = errors.map((f) => `${output.dim('-')} ${f}`);

    return errors.length === 0
      ? []
      : [
          {
            title: `The ${workspaceFileName()} file is out of sync`,
            bodyLines: errorGroupBodyLines,
            /**
             * TODO(JamesHenry): Add support for error documentation
             */
            // slug: 'project-has-no-files'
          },
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
      (f) => `${output.dim('-')} ${f}`
    );

    return first5FilesWithoutProjects.length === 0
      ? []
      : [
          {
            title: `The following file(s) do not belong to any projects:`,
            bodyLines: errorGroupBodyLines,
            /**
             * TODO(JamesHenry): Add support for error documentation
             */
            // slug: 'file-does-not-belong-to-project'
          },
        ];
  }

  misalignedPackages(): CLIErrorMessageConfig[] {
    const bodyLines: CLIErrorMessageConfig['bodyLines'] = [];

    let migrateTarget = this.nxPackageJson.version;

    for (const pkg of this.nxPackageJson['nx-migrations'].packageGroup) {
      const packageName = typeof pkg === 'string' ? pkg : pkg.package;
      if (typeof pkg === 'string' || pkg.version === '*') {
        // should be aligned
        const installedVersion =
          this.projectGraph.externalNodes['npm:' + packageName]?.data?.version;

        if (
          installedVersion &&
          installedVersion !== this.nxPackageJson.version
        ) {
          if (valid(installedVersion) && gt(installedVersion, migrateTarget)) {
            migrateTarget = installedVersion;
          }
          bodyLines.push(`- ${packageName}@${installedVersion}`);
        }
      }
    }

    return bodyLines.length
      ? [
          {
            title: 'Some packages have misaligned versions!',
            bodyLines: [
              'These packages should match your installed version of Nx.',
              ...bodyLines,
              '',
              `You should be able to fix this by running \`nx migrate ${migrateTarget}\``,
            ],
            // slug: 'nx-misaligned-versions',
          },
        ]
      : [];
  }

  private allProjectFiles() {
    return Object.values(this.projectGraph.nodes).reduce(
      (m, c) => [...m, ...c.data.files.map((f) => f.file)],
      []
    );
  }
}

function minus(a: string[], b: string[]): string[] {
  return a.filter((aa) => b.indexOf(aa) === -1);
}
