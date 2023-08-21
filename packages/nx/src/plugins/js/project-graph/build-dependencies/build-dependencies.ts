import {
  DependencyType,
  ProjectGraphProcessorContext,
} from '../../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import {
  buildExplicitTypeScriptDependencies,
  ExplicitDependency,
} from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  if (totalNumberOfFilesToProcess(ctx) === 0) return;

  let dependencies: ExplicitDependency[] = [];

  if (
    jsPluginConfig.analyzeSourceFiles === undefined ||
    jsPluginConfig.analyzeSourceFiles === true
  ) {
    let tsExists = false;
    try {
      require.resolve('typescript');
      tsExists = true;
    } catch {}
    if (tsExists) {
      dependencies = dependencies.concat(
        buildExplicitTypeScriptDependencies(builder.graph, ctx.filesToProcess)
      );
    }
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    dependencies = dependencies.concat(
      buildExplicitPackageJsonDependencies(
        ctx.nxJsonConfiguration,
        ctx.projectsConfigurations,
        builder.graph,
        ctx.filesToProcess
      )
    );
  }

  dependencies.forEach((r) => addDependency(builder, r));
}

function totalNumberOfFilesToProcess(ctx: ProjectGraphProcessorContext) {
  let totalNumOfFilesToProcess = 0;
  Object.values(ctx.filesToProcess).forEach(
    (t) => (totalNumOfFilesToProcess += t.length)
  );
  return totalNumOfFilesToProcess;
}
function addDependency(
  builder: ProjectGraphBuilder,
  dependency: ExplicitDependency
) {
  if (dependency.type === DependencyType.static) {
    builder.addStaticDependency(
      dependency.sourceProjectName,
      dependency.targetProjectName,
      dependency.sourceProjectFile
    );
  } else {
    builder.addDynamicDependency(
      dependency.sourceProjectName,
      dependency.targetProjectName,
      dependency.sourceProjectFile
    );
  }
}
