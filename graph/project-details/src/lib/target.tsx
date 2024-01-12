/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  EyeIcon,
  PencilSquareIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

// nx-ignore-next-line
import { TargetConfiguration } from '@nx/devkit';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { useNavigate } from 'react-router-dom';
import PropertyRenderer from './property-renderer';

/* eslint-disable-next-line */
export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function Target(props: TargetProps) {
  const { environment } = useEnvironmentConfig();
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeContructor = useRouteConstructor();

  const runTarget = () => {
    externalApiService.postEvent({
      type: 'run-task',
      payload: { taskId: `${props.projectName}:${props.targetName}` },
    });
  };

  const viewInTaskGraph = () => {
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-task-graph',
        payload: {
          projectName: props.projectName,
          targetName: props.targetName,
        },
      });
    } else {
      navigate(
        routeContructor(
          {
            pathname: `/tasks/${encodeURIComponent(props.targetName)}`,
            search: `?projects=${encodeURIComponent(props.projectName)}`,
          },
          true
        )
      );
    }
  };

  const targetConfigurationSortedAndFiltered = Object.entries(
    props.targetConfiguration
  )
    .filter(([, value]) => {
      return (
        value &&
        (Array.isArray(value) ? value.length : true) &&
        (typeof value === 'object' ? Object.keys(value).length : true)
      );
    })
    .sort(([a], [b]) => {
      const order = ['executor', 'inputs', 'outputs'];
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      } else if (indexA !== -1) {
        return -1;
      } else if (indexB !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });
  return (
    <div className="ml-3 mb-3">
      <h3 className="text-lg font-bold flex items-center gap-2">
        {props.targetName}{' '}
        {environment === 'nx-console' && (
          <PlayIcon className="h-5 w-5" onClick={runTarget} />
        )}
        <EyeIcon className="h-5 w-5" onClick={viewInTaskGraph}></EyeIcon>
      </h3>
      <div className="ml-3">
        {targetConfigurationSortedAndFiltered.map(([key, value]) =>
          PropertyRenderer({
            propertyKey: key,
            propertyValue: value,
            keyPrefix: `targets.${props.targetName}`,
            sourceMap: props.sourceMap,
          })
        )}
      </div>
    </div>
  );
}

export default Target;
