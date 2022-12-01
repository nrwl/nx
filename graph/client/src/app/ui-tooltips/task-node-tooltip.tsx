import Tag from '../ui-components/tag';
import { Link, useParams } from 'react-router-dom';
import { TooltipLinkButton } from './tooltip-button';
import { getEnvironmentConfig } from '../hooks/use-environment-config';

export interface TaskNodeTooltipProps {
  id: string;
  executor: string;
}

export function TaskNodeTooltip({ id, executor }: TaskNodeTooltipProps) {
  const params = useParams();
  const selectedWorkspaceId = params['selectedWorkspaceId'];

  const to = selectedWorkspaceId
    ? `/${selectedWorkspaceId}/tasks/${id}`
    : `/tasks/${id}`;
  return (
    <div>
      <h4>
        <Tag className="mr-3">{executor}</Tag>
        {id}
      </h4>
    </div>
  );
}

export default TaskNodeTooltip;
