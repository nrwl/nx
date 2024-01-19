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
  docsLinkText?: string;
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
    docsLinkText: 'Learn more about running tasks',
    heading: 'Target',
    description:
      'A Target is the definition of a task for a project. These can be run in many different ways.',
  },
  executors: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Executors',
    description:
      'Executors define what happens when a task is run.\nCheck the documentation of the executor below to learn more about what it does.',
  },
  cacheable: {
    docsUrl: 'https://nx.dev/concepts/how-caching-works',
    docsLinkText: 'Learn more about Caching',
    heading: 'Caching',
    description:
      'This task will be cached by Nx. When the Inputs have not changed the Outputs will be restored from the cache.',
  },
  inputs: {
    docsUrl: 'https://nx.dev/recipes/running-tasks/customizing-inputs',
    heading: 'Inputs',
    description: `Inputs are used by the task to produce Outputs. Inputs are used to determine when the Outputs of a task can be restored from the cache.`,
  },
  outputs: {
    docsUrl: 'https://nx.dev/reference/project-configuration#outputs',
    heading: 'Outputs',
    description:
      'Outputs are the results of a task. Outputs are restored from the cache when the Inputs are the same as a previous run.',
  },
  dependsOn: {
    docsUrl: 'https://nx.dev/concepts/task-pipeline-configuration',
    docsLinkText: 'Learn more about creating dependencies between tasks',
    heading: 'Depends On',
    description:
      'This is a list of other tasks which must be completed before running this task.',
  },
  options: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Options',
    description: 'Options modify the behaviour of the task.',
  },
  configurations: {
    docsUrl: 'https://nx.dev/concepts/executors-and-configurations',
    heading: 'Configurations',
    description:
      'Configurations are sets of Options to allow a Target to be used in different scenarios.',
  },
};

export function PropertyInfoTooltip({ type }: PropertyInfoTooltipProps) {
  const propertyInfo = PROPERTY_INFO_TOOLTIP_TYPE_OPTIONS[type];

  return (
    <div className="text-sm text-slate-700 dark:text-slate-400 max-w-lg">
      <h4 className="flex justify-between items-center border-b text-base">
        <span className="font-mono">{propertyInfo.heading}</span>
      </h4>
      <div className="flex flex-col font-mono border-b py-2">
        <p className="flex grow items-center gap-2 whitespace-pre-wrap">
          {propertyInfo.description}
        </p>
      </div>
      <div className="flex py-2">
        <p className="pr-4 flex items-center">
          <ExternalLink
            text={
              propertyInfo.docsLinkText ??
              `Learn more about ${propertyInfo.heading}`
            }
            href={propertyInfo.docsUrl}
          />
        </p>
      </div>
    </div>
  );
}
