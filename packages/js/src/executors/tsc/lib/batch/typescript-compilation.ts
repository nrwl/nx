import type { TaskGraph } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import type { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import * as ts from 'typescript';
import { getCustomTrasformersFactory } from '../get-custom-transformers-factory';
import type { TaskInfo } from './types';
import {
  formatDiagnosticReport,
  formatSolutionBuilderStatusReport,
  formatWatchStatusReport,
} from './typescript-diagnostic-reporters';

// https://github.com/microsoft/TypeScript/blob/d45012c5e2ab122919ee4777a7887307c5f4a1e0/src/compiler/diagnosticMessages.json#L4050-L4053
// Typescript diagnostic message for 5083: Cannot read file '{0}'.
const TYPESCRIPT_CANNOT_READ_FILE = 5083;
// https://github.com/microsoft/TypeScript/blob/d45012c5e2ab122919ee4777a7887307c5f4a1e0/src/compiler/diagnosticMessages.json#L4211-4214
// Typescript diagnostic message for 6032: File change detected. Starting incremental compilation...
const TYPESCRIPT_FILE_CHANGE_DETECTED_STARTING_INCREMENTAL_COMPILATION = 6032;

export function compileBatchTypescript(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  taskGraph: TaskGraph,
  watch: boolean,
  postProjectCompilationCallback: (taskInfo: TaskInfo) => void
): {
  iterator: AsyncIterable<BatchResults>;
  close: () => void | Promise<void>;
} {
  const timeNow = Date.now();
  const defaultResults: BatchResults = Object.keys(taskGraph.tasks).reduce(
    (acc, task) => {
      acc[task] = { success: true, startTime: timeNow, terminalOutput: '' };
      return acc;
    },
    {} as BatchResults
  );

  let tearDown: (() => void) | undefined;

  return {
    iterator: createAsyncIterable<BatchResults>(({ next, done }) => {
      if (watch) {
        compileTSWithWatch(tsConfigTaskInfoMap, postProjectCompilationCallback);

        tearDown = () => {
          done();
        };
      } else {
        const compilationResults = compileTS(
          tsConfigTaskInfoMap,
          postProjectCompilationCallback
        );
        next({
          ...defaultResults,
          ...compilationResults,
        });
        done();
      }
    }),
    close: () => tearDown?.(),
  };
}

function compileTSWithWatch(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  postProjectCompilationCallback: (taskInfo: TaskInfo) => void
) {
  const formatDiagnosticsHost: ts.FormatDiagnosticsHost = {
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getNewLine: () => ts.sys.newLine,
    getCanonicalFileName: (filename: string) =>
      ts.sys.useCaseSensitiveFileNames ? filename : filename.toLowerCase(),
  };
  const solutionHost = ts.createSolutionBuilderWithWatchHost(
    ts.sys,
    /*createProgram*/ undefined,
    (diagnostic) => {
      const formattedDiagnostic = formatDiagnosticReport(
        diagnostic,
        formatDiagnosticsHost
      );
      logger.info(formattedDiagnostic);
    },
    (diagnostic) => {
      const formattedDiagnostic = formatSolutionBuilderStatusReport(diagnostic);
      logger.info(formattedDiagnostic);
    },
    (diagnostic, newLine) => {
      const formattedDiagnostic = formatWatchStatusReport(diagnostic, newLine);
      logger.info(formattedDiagnostic);

      if (
        diagnostic.code ===
        TYPESCRIPT_FILE_CHANGE_DETECTED_STARTING_INCREMENTAL_COMPILATION
      ) {
        // there's a change, build invalidated projects
        build();
      }
    }
  );
  const rootNames = Object.keys(tsConfigTaskInfoMap);
  const solutionBuilder = ts.createSolutionBuilderWithWatch(
    solutionHost,
    rootNames,
    {}
  );

  const build = () => {
    while (true) {
      const project = solutionBuilder.getNextInvalidatedProject();
      if (!project) {
        break;
      }

      const taskInfo = tsConfigTaskInfoMap[project.project];

      if (project.kind === ts.InvalidatedProjectKind.UpdateOutputFileStamps) {
        // update output timestamps and mark project as complete
        project.done();
        continue;
      }

      /**
       * This only applies when the deprecated `prepend` option is set to `true`.
       * Skip support.
       */
      if (project.kind === ts.InvalidatedProjectKind.UpdateBundle) {
        logger.warn(
          `The project ${taskInfo.context.projectName} ` +
            `is using the deprecated "prepend" Typescript compiler option. ` +
            `This option is not supported by the batch executor and it's ignored.`
        );
        continue;
      }

      // build and mark project as complete
      project.done(
        undefined,
        undefined,
        getCustomTrasformersFactory(taskInfo.options.transformers)(
          project.getProgram()
        )
      );
      postProjectCompilationCallback(taskInfo);
    }
  };

  // initial build
  build();

  /**
   * This is a workaround to get the TS file watching to kick off. It won't
   * build twice since the `build` call above will mark invalidated projects
   * as completed and then, the implementation of the `solutionBuilder.build`
   * skips them.
   * We can't rely solely in `solutionBuilder.build()` because it doesn't
   * accept custom transformers.
   */
  solutionBuilder.build();

  return solutionHost;
}

function compileTS(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  postProjectCompilationCallback: (taskInfo: TaskInfo) => void
): BatchResults {
  const results: BatchResults = {};

  let terminalOutput: string;
  const logInfo = (text: string): void => {
    logger.info(text);
    terminalOutput += `${text}\n`;
  };
  const logWarn = (text: string): void => {
    logger.warn(text);
    terminalOutput += `${text}\n`;
  };

  const formatDiagnosticsHost: ts.FormatDiagnosticsHost = {
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getNewLine: () => ts.sys.newLine,
    getCanonicalFileName: (filename: string) =>
      ts.sys.useCaseSensitiveFileNames ? filename : filename.toLowerCase(),
  };
  const solutionBuilderHost = ts.createSolutionBuilderHost(
    ts.sys,
    /*createProgram*/ undefined,
    (diagnostic) => {
      const formattedDiagnostic = formatDiagnosticReport(
        diagnostic,
        formatDiagnosticsHost
      );

      // handles edge case where a wrong a project reference path can't be read
      if (diagnostic.code === TYPESCRIPT_CANNOT_READ_FILE) {
        Object.values(tsConfigTaskInfoMap).forEach((taskInfo) => {
          results[taskInfo.task] ??= { success: false, terminalOutput: '' };
          results[taskInfo.task].success = false;
          results[taskInfo.task].terminalOutput = `${
            results[taskInfo.task]?.terminalOutput
          }${formattedDiagnostic}`;
        });
      }

      logInfo(formattedDiagnostic);
    },
    (diagnostic) => {
      const formattedDiagnostic = formatSolutionBuilderStatusReport(diagnostic);
      logInfo(formattedDiagnostic);
    }
  );
  const rootNames = Object.keys(tsConfigTaskInfoMap);
  const solutionBuilder = ts.createSolutionBuilder(
    solutionBuilderHost,
    rootNames,
    {}
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const project = solutionBuilder.getNextInvalidatedProject();
    if (!project) {
      break;
    }

    const startTime = Date.now();
    terminalOutput = '';
    const taskInfo = tsConfigTaskInfoMap[project.project];
    const projectName = taskInfo?.context?.projectName;

    if (project.kind === ts.InvalidatedProjectKind.UpdateOutputFileStamps) {
      if (projectName) {
        logInfo(`Updating output timestamps of project "${projectName}"...`);
      }

      // update output timestamps and mark project as complete
      const status = project.done();

      if (projectName && status === ts.ExitStatus.Success) {
        logInfo(
          `Done updating output timestamps of project "${projectName}"...`
        );
      }

      if (taskInfo) {
        results[taskInfo.task] = {
          success: status === ts.ExitStatus.Success,
          terminalOutput,
          startTime,
          endTime: Date.now(),
        };
      }

      continue;
    }

    /**
     * This only applies when the deprecated `prepend` option is set to `true`.
     * Skip support.
     */
    if (project.kind === ts.InvalidatedProjectKind.UpdateBundle) {
      logWarn(
        `The project ${taskInfo.context.projectName} ` +
          `is using the deprecated "prepend" Typescript compiler option. ` +
          `This option is not supported by the batch executor and it's ignored.`
      );
      continue;
    }

    logInfo(`Compiling TypeScript files for project "${projectName}"...`);
    // build and mark project as complete
    const status = project.done(
      undefined,
      undefined,
      getCustomTrasformersFactory(taskInfo.options.transformers)(
        project.getProgram()
      )
    );
    postProjectCompilationCallback(taskInfo);

    if (status === ts.ExitStatus.Success) {
      logInfo(`Done compiling TypeScript files for project "${projectName}".`);
    }

    results[taskInfo.task] = {
      success: status === ts.ExitStatus.Success,
      terminalOutput,
      startTime,
      endTime: Date.now(),
    };
  }

  return results;
}
