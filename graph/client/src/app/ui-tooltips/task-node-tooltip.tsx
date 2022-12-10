import Tag from '../ui-components/tag';
import { useParams } from 'react-router-dom';

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
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4>
        <Tag className="mr-3">{executor}</Tag>
        <span className="font-mono">{id}</span>
      </h4>
    </div>
  );
}

export default TaskNodeTooltip;
