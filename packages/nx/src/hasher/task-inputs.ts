import {
  FileData,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task } from '../config/task-graph';
import { InputDefinition } from '../config/workspace-json-project-json';
import { minimatch } from 'minimatch';

export type ExpandedSelfInput =
  | { fileset: string }
  | { runtime: string }
  | { env: string }
  | { externalDependencies: string[] };
export type ExpandedDepsOutput = {
  dependentTasksOutputFiles: string;
  transitive?: boolean;
};
export type ExpandedInput = ExpandedSelfInput | ExpandedDepsOutput;
const DEFAULT_INPUTS: ReadonlyArray<InputDefinition> = [
  {
    input: 'default',
  },
  {
    dependencies: true,
    input: 'default',
  },
];

export function getNamedInputs(
  nxJson: NxJsonConfiguration,
  project: ProjectGraphProjectNode
) {
  return {
    default: [{ fileset: '{projectRoot}/**/*' }],
    ...nxJson.namedInputs,
    ...project.data.namedInputs,
  };
}

export function getTargetInputs(
  nxJson: NxJsonConfiguration,
  projectNode: ProjectGraphProjectNode,
  target: string
) {
  const namedInputs = getNamedInputs(nxJson, projectNode);

  const targetData = projectNode.data.targets[target];
  const inputs = splitInputsIntoSelfAndDependencies(
    targetData.inputs || DEFAULT_INPUTS,
    namedInputs
  );

  const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);

  const dependencyInputs = [
    ...extractPatternsFromFileSets(
      inputs.depsInputs
        .map((s) => expandNamedInput(s.input, namedInputs))
        .flat()
    ),
    ...inputs.depsFilesets.map((d) => d.fileset),
  ];

  return { selfInputs, dependencyInputs };
}

export function extractPatternsFromFileSets(
  inputs: readonly ExpandedInput[]
): string[] {
  return inputs
    .filter((c): c is { fileset: string } => !!c['fileset'])
    .map((c) => c['fileset']);
}

export function getInputs(
  task: Task,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
) {
  const projectNode = projectGraph.nodes[task.target.project];
  const namedInputs = getNamedInputs(nxJson, projectNode);
  const targetData = projectNode.data.targets[task.target.target];
  // See `getTargetInputs` — graph construction already merged any
  // matching target-default's `inputs` onto `targetData.inputs`, so a
  // separate `targetDefaults` lookup here would either repeat that
  // work or drift from it.
  const { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets } =
    splitInputsIntoSelfAndDependencies(
      targetData.inputs || (DEFAULT_INPUTS as any),
      namedInputs
    );
  return { selfInputs, depsInputs, depsOutputs, projectInputs, depsFilesets };
}

export function splitInputsIntoSelfAndDependencies(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): {
  depsInputs: { input: string; dependencies: true }[];
  projectInputs: { input: string; projects: string[] }[];
  selfInputs: ExpandedSelfInput[];
  depsOutputs: ExpandedDepsOutput[];
  depsFilesets: { fileset: string; dependencies: true }[];
} {
  const depsInputs: { input: string; dependencies: true }[] = [];
  const projectInputs: { input: string; projects: string[] }[] = [];
  const depsFilesets: { fileset: string; dependencies: true }[] = [];
  const selfInputs = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^')) {
        const rest = d.substring(1);
        if (
          rest.startsWith('{projectRoot}') ||
          rest.startsWith('{workspaceRoot}')
        ) {
          depsFilesets.push({ fileset: rest, dependencies: true });
        } else {
          depsInputs.push({ input: rest, dependencies: true });
        }
      } else {
        selfInputs.push(d);
      }
    } else {
      if ('fileset' in d && 'dependencies' in d && d.dependencies) {
        depsFilesets.push({
          fileset: (d as { fileset: string; dependencies: true }).fileset,
          dependencies: true,
        });
      } else if (
        'input' in d &&
        !('fileset' in d) &&
        (('dependencies' in d && d.dependencies) ||
          // Todo(@AgentEnder): Remove check in v17
          ('projects' in d &&
            typeof d.projects === 'string' &&
            d.projects === 'dependencies'))
      ) {
        depsInputs.push({
          input: d.input,
          dependencies: true,
        });
      } else if (
        'input' in d &&
        !('fileset' in d) &&
        'projects' in d &&
        d.projects &&
        // Todo(@AgentEnder): Remove check in v17
        !(d.projects === 'self')
      ) {
        projectInputs.push({
          input: d.input,
          projects: Array.isArray(d.projects) ? d.projects : [d.projects],
        });
      } else {
        selfInputs.push(d);
      }
    }
  }
  const expandedInputs = expandSingleProjectInputs(selfInputs, namedInputs);
  return {
    depsInputs,
    projectInputs,
    selfInputs: expandedInputs.filter(isSelfInput),
    depsOutputs: expandedInputs.filter(isDepsOutput),
    depsFilesets,
  };
}

export function isSelfInput(input: ExpandedInput): input is ExpandedSelfInput {
  return !('dependentTasksOutputFiles' in input);
}

export function isDepsOutput(
  input: ExpandedInput
): input is ExpandedDepsOutput {
  return 'dependentTasksOutputFiles' in input;
}

export function expandSingleProjectInputs(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): ExpandedInput[] {
  const expanded = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^'))
        throw new Error(`namedInputs definitions cannot start with ^`);

      if (namedInputs[d]) {
        expanded.push(...expandNamedInput(d, namedInputs));
      } else {
        expanded.push({ fileset: d });
      }
    } else {
      if ((d as any).projects || (d as any).dependencies) {
        throw new Error(
          `namedInputs definitions can only refer to other namedInputs definitions within the same project.`
        );
      }
      if (
        (d as any).fileset ||
        (d as any).env ||
        (d as any).runtime ||
        (d as any).externalDependencies ||
        (d as any).dependentTasksOutputFiles ||
        (d as any).workingDirectory ||
        (d as any).json
      ) {
        expanded.push(d);
      } else {
        expanded.push(...expandNamedInput((d as any).input, namedInputs));
      }
    }
  }
  return expanded;
}

export function expandNamedInput(
  input: string,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): ExpandedInput[] {
  namedInputs ||= {};
  if (!namedInputs[input]) throw new Error(`Input '${input}' is not defined`);
  return expandSingleProjectInputs(namedInputs[input], namedInputs);
}

export function filterUsingGlobPatterns(
  root: string,
  files: FileData[],
  patterns: string[]
): FileData[] {
  const filesetWithExpandedProjectRoot = patterns
    .map((f) => f.replace('{projectRoot}', root))
    .map((r) => {
      // handling root level projects that create './' pattern that doesn't work with minimatch
      if (r.startsWith('./')) return r.substring(2);
      if (r.startsWith('!./')) return '!' + r.substring(3);
      return r;
    });

  const positive = [];
  const negative = [];
  for (const p of filesetWithExpandedProjectRoot) {
    if (p.startsWith('!')) {
      negative.push(p);
    } else {
      positive.push(p);
    }
  }

  if (positive.length === 0 && negative.length === 0) {
    return files;
  }

  return files.filter((f) => {
    let matchedPositive = false;
    if (
      positive.length === 0 ||
      (positive.length === 1 && positive[0] === `${root}/**/*`)
    ) {
      matchedPositive = true;
    } else {
      matchedPositive = positive.some((pattern) => minimatch(f.file, pattern));
    }

    if (!matchedPositive) return false;

    return negative.every((pattern) => minimatch(f.file, pattern));
  });
}
