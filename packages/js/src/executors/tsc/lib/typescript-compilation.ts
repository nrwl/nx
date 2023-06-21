import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import * as ts from 'typescript';
import type { TransformerEntry } from '../../../utils/typescript/types';
import { getCustomTrasformersFactory } from './get-custom-transformers-factory';
import {
  formatDiagnosticReport,
  formatSolutionBuilderStatusReport,
} from './typescript-diagnostic-reporters';

export interface TypescriptInMemoryTsConfig {
  content: string;
  path: string;
}

export interface TypescripCompilationLogger {
  error: (message: string, tsConfig?: string) => void;
  info: (message: string, tsConfig?: string) => void;
  warn: (message: string, tsConfig?: string) => void;
}

export interface TypescriptProjectContext {
  project: string;
  tsConfig: TypescriptInMemoryTsConfig;
  transformers: TransformerEntry[];
}

export interface TypescriptCompilationResult {
  tsConfig: string;
  success: boolean;
}

export type ReporterWithTsConfig<Fn extends (...args: any[]) => any> = (
  tsConfig: string | undefined,
  ...foo: Parameters<Fn>
) => ReturnType<Fn>;

// https://github.com/microsoft/TypeScript/blob/d45012c5e2ab122919ee4777a7887307c5f4a1e0/src/compiler/diagnosticMessages.json#L4050-L4053
// Typescript diagnostic message for 5083: Cannot read file '{0}'.
const TYPESCRIPT_CANNOT_READ_FILE = 5083;
// https://github.com/microsoft/TypeScript/blob/d45012c5e2ab122919ee4777a7887307c5f4a1e0/src/compiler/diagnosticMessages.json#L4211-4214
// Typescript diagnostic message for 6032: File change detected. Starting incremental compilation...
const TYPESCRIPT_FILE_CHANGE_DETECTED_STARTING_INCREMENTAL_COMPILATION = 6032;

export function compileTypescriptSolution(
  context: Record<string, TypescriptProjectContext>,
  watch: boolean,
  logger: TypescripCompilationLogger,
  hooks?: {
    beforeProjectCompilationCallback?: (tsConfig: string) => void;
    afterProjectCompilationCallback?: (
      tsConfig: string,
      success: boolean
    ) => void;
  },
  reporters?: {
    diagnosticReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    solutionBuilderStatusReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    watchStatusReporter?: ReporterWithTsConfig<ts.WatchStatusReporter>;
  }
): AsyncIterable<TypescriptCompilationResult> {
  if (watch) {
    // create an AsyncIterable that doesn't complete, watch mode is only
    // stopped by killing the process
    return createAsyncIterable<TypescriptCompilationResult>(
      async ({ next }) => {
        hooks ??= {};
        const callerAfterProjectCompilationCallback =
          hooks.afterProjectCompilationCallback;
        hooks.afterProjectCompilationCallback = (tsConfig, success) => {
          callerAfterProjectCompilationCallback?.(tsConfig, success);
          next({ tsConfig, success });
        };

        compileTSWithWatch(context, logger, hooks, reporters);
      }
    );
  }

  // turn it into an AsyncIterable
  const compilationGenerator = compileTS(context, logger, hooks, reporters);

  return {
    [Symbol.asyncIterator]() {
      return {
        next() {
          return Promise.resolve(compilationGenerator.next());
        },
      };
    },
  };
}

function* compileTS(
  context: Record<string, TypescriptProjectContext>,
  logger: TypescripCompilationLogger,
  hooks?: {
    beforeProjectCompilationCallback?: (tsConfig: string) => void;
    afterProjectCompilationCallback?: (
      tsConfig: string,
      success: boolean
    ) => void;
  },
  reporters?: {
    diagnosticReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    solutionBuilderStatusReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    watchStatusReporter?: ReporterWithTsConfig<ts.WatchStatusReporter>;
  }
): Generator<TypescriptCompilationResult, void, TypescriptCompilationResult> {
  let project: ts.InvalidatedProject<ts.EmitAndSemanticDiagnosticsBuilderProgram>;

  const formatDiagnosticsHost: ts.FormatDiagnosticsHost = {
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getNewLine: () => ts.sys.newLine,
    getCanonicalFileName: (filename: string) =>
      ts.sys.useCaseSensitiveFileNames ? filename : filename.toLowerCase(),
  };
  const solutionBuilderHost = ts.createSolutionBuilderHost(
    getSystem(context),
    /*createProgram*/ undefined,
    (diagnostic) => {
      const formattedDiagnostic = formatDiagnosticReport(
        diagnostic,
        formatDiagnosticsHost
      );

      // handles edge case where a wrong a project reference path can't be read
      if (diagnostic.code === TYPESCRIPT_CANNOT_READ_FILE) {
        throw new Error(formattedDiagnostic);
      }

      logger.info(formattedDiagnostic, project.project);

      reporters?.diagnosticReporter?.(project.project, diagnostic);
    },
    (diagnostic) => {
      const formattedDiagnostic = formatSolutionBuilderStatusReport(diagnostic);
      logger.info(formattedDiagnostic, project.project);

      reporters?.solutionBuilderStatusReporter?.(project.project, diagnostic);
    }
  );
  const rootNames = Object.keys(context);
  const solutionBuilder = ts.createSolutionBuilder(
    solutionBuilderHost,
    rootNames,
    {}
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    project = solutionBuilder.getNextInvalidatedProject();
    if (!project) {
      break;
    }

    const projectContext = context[project.project];
    const projectName = projectContext?.project;

    /**
     * This only applies when the deprecated `prepend` option is set to `true`.
     * Skip support.
     */
    if (project.kind === ts.InvalidatedProjectKind.UpdateBundle) {
      logger.warn(
        `The project ${projectName} ` +
          `is using the deprecated "prepend" Typescript compiler option. ` +
          `This option is not supported by the batch executor and it's ignored.\n`,
        project.project
      );
      continue;
    }

    hooks?.beforeProjectCompilationCallback?.(project.project);

    if (project.kind === ts.InvalidatedProjectKind.UpdateOutputFileStamps) {
      logger.info(
        `Updating output timestamps of project "${projectName}"...\n`,
        project.project
      );

      // update output timestamps and mark project as complete
      const status = project.done();
      const success = status === ts.ExitStatus.Success;

      if (success) {
        logger.info(
          `Done updating output timestamps of project "${projectName}"...\n`,
          project.project
        );
      }

      hooks?.afterProjectCompilationCallback?.(project.project, success);
      yield { success, tsConfig: project.project };

      continue;
    }

    logger.info(
      `Compiling TypeScript files for project "${projectName}"...\n`,
      project.project
    );
    // build and mark project as complete
    const status = project.done(
      undefined,
      undefined,
      getCustomTrasformersFactory(projectContext.transformers)(
        project.getProgram()
      )
    );
    const success = status === ts.ExitStatus.Success;

    if (success) {
      logger.info(
        `Done compiling TypeScript files for project "${projectName}".\n`,
        project.project
      );
    }

    hooks?.afterProjectCompilationCallback?.(project.project, success);

    yield {
      success: status === ts.ExitStatus.Success,
      tsConfig: project.project,
    };
  }
}

function compileTSWithWatch(
  context: Record<string, TypescriptProjectContext>,
  logger: TypescripCompilationLogger,
  hooks?: {
    beforeProjectCompilationCallback?: (tsConfig: string) => void;
    afterProjectCompilationCallback?: (
      tsConfig: string,
      success: boolean
    ) => void;
  },
  reporters?: {
    diagnosticReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    solutionBuilderStatusReporter?: ReporterWithTsConfig<ts.DiagnosticReporter>;
    watchStatusReporter?: ReporterWithTsConfig<ts.WatchStatusReporter>;
  }
): void {
  let project: ts.InvalidatedProject<ts.EmitAndSemanticDiagnosticsBuilderProgram>;

  const solutionHost = ts.createSolutionBuilderWithWatchHost(
    getSystem(context),
    /*createProgram*/ undefined
  );

  if (reporters?.diagnosticReporter) {
    const originalDiagnosticReporter = solutionHost.reportDiagnostic;
    solutionHost.reportDiagnostic = (diagnostic) => {
      originalDiagnosticReporter(diagnostic);
      reporters.diagnosticReporter(project.project, diagnostic);
    };
  }

  if (reporters?.solutionBuilderStatusReporter) {
    const originalSolutionBuilderStatusReporter =
      solutionHost.reportSolutionBuilderStatus;
    solutionHost.reportDiagnostic = (diagnostic) => {
      originalSolutionBuilderStatusReporter(diagnostic);
      reporters.solutionBuilderStatusReporter(project.project, diagnostic);
    };
  }

  const originalWatchStatusReporter = solutionHost.onWatchStatusChange;
  solutionHost.onWatchStatusChange = (
    diagnostic,
    newLine,
    options,
    errorCount
  ) => {
    originalWatchStatusReporter(diagnostic, newLine, options, errorCount);

    if (
      diagnostic.code ===
      TYPESCRIPT_FILE_CHANGE_DETECTED_STARTING_INCREMENTAL_COMPILATION
    ) {
      // there's a change, build invalidated projects
      build();
    }

    reporters?.watchStatusReporter?.(
      project?.project,
      diagnostic,
      newLine,
      options,
      errorCount
    );
  };

  const rootNames = Object.keys(context);
  const solutionBuilder = ts.createSolutionBuilderWithWatch(
    solutionHost,
    rootNames,
    {}
  );

  const build = () => {
    while (true) {
      project = solutionBuilder.getNextInvalidatedProject();
      if (!project) {
        break;
      }

      const projectContext = context[project.project];
      const projectName = projectContext.project;

      /**
       * This only applies when the deprecated `prepend` option is set to `true`.
       * Skip support.
       */
      if (project.kind === ts.InvalidatedProjectKind.UpdateBundle) {
        logger.warn(
          `The project ${projectName} ` +
            `is using the deprecated "prepend" Typescript compiler option. ` +
            `This option is not supported by the batch executor and it's ignored.`
        );
        continue;
      }

      hooks?.beforeProjectCompilationCallback(project.project);

      if (project.kind === ts.InvalidatedProjectKind.UpdateOutputFileStamps) {
        if (projectName) {
          logger.info(
            `Updating output timestamps of project "${projectName}"...\n`,
            project.project
          );
        }

        // update output timestamps and mark project as complete
        const status = project.done();
        const success = status === ts.ExitStatus.Success;

        if (projectName && success) {
          logger.info(
            `Done updating output timestamps of project "${projectName}"...\n`,
            project.project
          );
        }

        hooks?.afterProjectCompilationCallback?.(project.project, success);

        continue;
      }

      logger.info(
        `Compiling TypeScript files for project "${projectName}"...\n`,
        project.project
      );
      // build and mark project as complete
      const status = project.done(
        undefined,
        undefined,
        getCustomTrasformersFactory(projectContext.transformers)(
          project.getProgram()
        )
      );
      const success = status === ts.ExitStatus.Success;

      if (success) {
        logger.info(
          `Done compiling TypeScript files for project "${projectName}".\n`,
          project.project
        );
      }

      hooks?.afterProjectCompilationCallback?.(project.project, success);
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
}

function getSystem(
  context: Record<string, TypescriptProjectContext>
): ts.System {
  return {
    ...ts.sys,
    readFile(path, encoding) {
      if (context[path]) {
        return context[path].tsConfig.content;
      }
      return ts.sys.readFile(path, encoding);
    },
  };
}
