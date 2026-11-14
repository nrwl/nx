import * as pc from 'picocolors';
import type { ConformanceReporter } from './types';
import {
  BAR,
  BAR_END,
  BAR_START,
  SQUARE,
  WORKSPACE,
  formatExecutionTime,
  getColorForSeverity,
  getIconForSeverity,
  getNameToPrint,
  getStatusToPrint,
  printNoViolations,
} from './utils/terminal-reporter-utils';

export const terminalReporter: ConformanceReporter = ({ ruleResults }) => {
  ruleResults.forEach((result, index) => {
    const violations = result.details.violations ?? [];
    const violationCount = violations.length;
    const color = getColorForSeverity(result.severity);
    const icon = getIconForSeverity(result.severity);

    if (violationCount === 0) {
      printNoViolations(result);
      // Add spacing between rule results (except for the last one)
      if (index < ruleResults.length - 1) {
        console.log('');
      }
      return;
    }

    console.log(
      ` ${color(BAR_START)}  ${pc.bold(
        color(getNameToPrint(result))
      )} ${pc.dim('-')} ${result.ruleData.category} ${pc.dim(
        '|'
      )} ${result.severity} severity ${pc.dim('|')} status: ${getStatusToPrint(
        result
      )}${
        result.runnerData.executionTimeMs
          ? pc.dim(
              ` (${formatExecutionTime(result.runnerData.executionTimeMs)})`
            )
          : ''
      }`
    );
    console.log(` ${color(BAR)}`);

    // Separate violations into different categories for smart display
    const workspaceViolations = violations.filter((v) => v.workspaceViolation);
    const violationsWithProject = violations.filter(
      (v) => v.sourceProject && !v.workspaceViolation
    );
    const violationsWithoutProject = violations.filter(
      (v) => !v.sourceProject && !v.workspaceViolation
    );

    // Handle workspace violations first (most global scope)
    if (workspaceViolations.length > 0) {
      workspaceViolations.forEach((violation, index) => {
        const isLastWorkspaceViolation =
          index === workspaceViolations.length - 1;
        const isLastOverall =
          isLastWorkspaceViolation &&
          violationsWithProject.length === 0 &&
          violationsWithoutProject.length === 0;

        console.log(pc.bold(` ${color(WORKSPACE)}  Workspace`));

        if (isLastOverall) {
          console.log(
            ` ${color(BAR_END)}    ${color(icon)} ${violation.message}`
          );
        } else {
          console.log(` ${color(BAR)}    ${color(icon)} ${violation.message}`);
          if (!isLastWorkspaceViolation) {
            console.log(` ${color(BAR)}`);
          }
        }
      });

      // Add separation between workspace violations and project/file violations
      if (
        violationsWithProject.length > 0 ||
        violationsWithoutProject.length > 0
      ) {
        console.log(` ${color(BAR)}`);
      }
    }

    // Handle violations grouped by project
    if (violationsWithProject.length > 0) {
      const violationsByProject = violationsWithProject.reduce(
        (acc, violation) => {
          if (!violation.sourceProject) {
            return acc;
          }
          const project = violation.sourceProject;
          if (!acc[project]) {
            acc[project] = {};
          }
          const key = violation.message;
          if (!acc[project][key]) {
            acc[project][key] = {
              files: [],
              hasFile: false,
            };
          }
          if (violation.file) {
            acc[project][key].files.push(violation.file);
            acc[project][key].hasFile = true;
          } else {
            // Project-only violation, no files to show
            acc[project][key].hasFile = false;
          }
          return acc;
        },
        {} as Record<
          string,
          Record<string, { files: string[]; hasFile: boolean }>
        >
      );

      const projectViolations = Object.entries(violationsByProject);
      projectViolations.forEach(([project, violationGroups], projectIndex) => {
        const isLastProject =
          projectIndex === projectViolations.length - 1 &&
          violationsWithoutProject.length === 0;
        console.log(pc.bold(` ${color(SQUARE)}  ${project}`));

        const violationEntries = Object.entries(violationGroups);
        violationEntries.forEach(([message, data], violationIndex) => {
          const isLastViolation =
            violationIndex === violationEntries.length - 1;

          console.log(` ${color(BAR)}    ${color(icon)} ${message}`);

          // Only show files if there are any
          if (data.hasFile && data.files.length > 0) {
            data.files.forEach((file, fileIndex) => {
              const isLastFile = fileIndex === data.files.length - 1;
              const prefix =
                isLastProject && isLastViolation && isLastFile ? BAR_END : BAR;
              console.log(` ${color(prefix)}    ${pc.dim(`- ${file}`)}`);
            });
          } else {
            // Project-only violation, no files to display
            if (isLastProject && isLastViolation) {
              // This was the last item overall, need to close properly
              console.log(` ${color(BAR_END)}`);
            }
          }

          if (!isLastViolation) {
            console.log(` ${color(BAR)}`);
          }
        });

        if (!isLastProject) {
          console.log(` ${color(BAR)}`);
        }
      });

      // Add separation between project violations and ungrouped violations
      if (violationsWithoutProject.length > 0) {
        console.log(` ${color(BAR)}`);
      }
    }

    // Handle violations without sourceProject (ungrouped, file-only or standalone)
    if (violationsWithoutProject.length > 0) {
      violationsWithoutProject.forEach((violation, index) => {
        const isLastViolation = index === violationsWithoutProject.length - 1;

        if (violation.file) {
          // File-based violation without project
          console.log(pc.bold(` ${color('-')}  ${violation.file}`));
        } else {
          // Standalone message violation (no file, no project)
          console.log(pc.bold(` ${color('-')}  ${violation.message}`));
        }

        if (!isLastViolation) {
          console.log(` ${color(BAR)}    ${color(icon)} ${violation.message}`);
          console.log(` ${color(BAR)}`);
        } else {
          if (violation.file) {
            // Show message for file-based violations
            console.log(
              ` ${color(BAR_END)}    ${color(icon)} ${violation.message}`
            );
          } else {
            // For standalone violations, we already showed the message above
            console.log(` ${color(BAR_END)}`);
          }
        }
      });
    }

    // Add spacing between rule results (except for the last one)
    if (index < ruleResults.length - 1) {
      console.log('');
    }
  });
};
