import {
  formatFiles,
  getProjects,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

type ExecutorOptionsType = Readonly<
  [
    optionName: string,
    oldDefault: boolean | undefined,
    newDefault: boolean | undefined
  ][]
>;

const optionsToUpdate: ExecutorOptionsType = [
  ['aot', false, true],
  ['vendorChunk', true, false],
  ['extractLicenses', false, true],
  ['buildOptimizer', false, true],
  ['sourceMap', true, false],
  ['optimization', false, true],
  ['namedChunks', true, false],
];

export default async function updateAngularConfig(host: Tree) {
  const projects = getProjects(host);

  for (const [name, project] of projects) {
    for (const target of Object.values(project.targets || {})) {
      if (target.executor === '@nrwl/angular:webpack-browser') {
        updateOptions(target, optionsToUpdate);

        for (const options of allTargetOptions(target)) {
          delete options.experimentalRollupPass;
          delete options.lazyModules;
          delete options.forkTypeChecker;
        }
      }
    }

    updateProjectConfiguration(host, name, project);
  }

  await formatFiles(host);
}

function* allTargetOptions(target: TargetConfiguration): IterableIterator<any> {
  if (target.options) {
    yield target.options;
  }

  if (!target.configurations) {
    return;
  }

  for (const [, options] of Object.entries(target.configurations)) {
    if (options !== undefined) {
      yield options;
    }
  }
}

function updateOptions(
  target: TargetConfiguration,
  options: typeof optionsToUpdate
): void {
  if (!target.options) {
    target.options = {};
  }

  const configurationOptions =
    target.configurations && Object.values(target.configurations);

  for (const [optionName, oldDefault, newDefault] of options) {
    let value = target.options[optionName];
    if (value === newDefault) {
      // Value is same as new default
      delete target.options[optionName];
    } else if (value === undefined) {
      // Value is not defined, hence the default in the executor was used.
      target.options[optionName] = oldDefault;
      value = oldDefault;
    }

    // Remove overrides in configurations which are no longer needed.
    configurationOptions
      ?.filter((o) => o && o[optionName] === value)
      .forEach((o) => o && delete o[optionName]);
  }
}
