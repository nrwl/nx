import { ExternalLink } from './external-link';

type PropertyInfoTooltipType =
  | 'targets'
  | 'executors'
  | 'cacheable'
  | 'inputs'
  | 'outputs'
  | 'dependsOn'
  | 'options'
  | 'configurations';

type PropertyInfoTooltipTypeOptions = {
  docsUrl: string;
  heading: string;
  description: string;
};
export interface PropertyInfoTooltipProps {
  type: PropertyInfoTooltipType;
}

const PROPERTY_INFO_TOOLTIP_TYPE_OPTIONS: Record<
  PropertyInfoTooltipType,
  PropertyInfoTooltipTypeOptions
> = {
  targets: {
    docsUrl: 'https://nx.dev/core-features/run-tasks#define-tasks',
    heading: 'Target',
    description:
      'A Target is the definition of an action taken on a project (e.g. build). It defines how an action should be performed which Nx will then use when invoking the task.',
  },
  executors: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Executors',
    description:
      "Executors are pre-packaged node scripts that can be used to run tasks in a consistent way.\nIn order to use an executor, you need to install the plugin that contains the executor and then configure the executor in the project's project.json file.",
  },
  cacheable: {
    docsUrl: 'https://nx.dev/concepts/how-caching-works',
    heading: 'Cacheable Target',
    description:
      'Marking a target as cacheable tells Nx to store the computation hash for the task after the task has run.\nBefore subsequent runs of the target Nx will recalculate the computation hash. If the hash matches an existing computation hash, Nx retrieves the computation and replays it. This includes restoring files.',
  },
  inputs: {
    docsUrl: 'https://nx.dev/recipes/running-tasks/customizing-inputs',
    heading: 'Inputs',
    description: `Inputs configure what goes into the calculation of a hash for the task.\nThis affects when things can be pulled from cache/replay.`,
  },
  outputs: {
    docsUrl: 'https://nx.dev/reference/project-configuration#outputs',
    heading: 'Outputs',
    description:
      'Targets may define outputs to tell Nx where the target is going to create file artifacts that Nx should cache. ',
  },
  dependsOn: {
    docsUrl: 'https://nx.dev/concepts/task-pipeline-configuration',
    heading: 'Depends On',
    description:
      'The dependsOn property allows a target to define other tasks that must be completed before the target can run.\nThese could be tasks from other projects in the monorepo or tasks from the same project.',
  },
  configurations: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Configurations',
    description:
      'The configurations property provides extra sets of values that will be merged into the options map when the task is run by Nx.',
  },
  options: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Options',
    description:
      'Options are used to provide arguments allowing for the modification of the behaviour of the executor.',
  },
};

export function PropertyInfoTooltip({ type }: PropertyInfoTooltipProps) {
  const propertyInfo = PROPERTY_INFO_TOOLTIP_TYPE_OPTIONS[type];

  return (
    <div className="text-sm text-slate-700 dark:text-slate-400 max-w-lg">
      <h4 className="flex justify-between items-center border-b text-base">
        <span className="font-mono">{propertyInfo.heading}</span>
        <span className="text-sm text-gray-500 italic">Nx Graph Insights</span>
      </h4>
      <div className="flex flex-col font-mono border-b py-2">
        <p className="flex grow items-center gap-2 whitespace-pre-wrap">
          {propertyInfo.description}
        </p>
      </div>
      <div className="flex py-2">
        <p className="pr-4 flex items-center">
          <ExternalLink
            text={`View ${propertyInfo.heading} Documentation`}
            href={propertyInfo.docsUrl}
          />
        </p>
      </div>
    </div>
  );
}
