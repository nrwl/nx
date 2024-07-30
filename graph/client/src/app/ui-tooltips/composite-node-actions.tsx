import {
  CompositeNodeTooltipProps,
  TooltipButton,
  TooltipLinkButton,
} from '@nx/graph/ui-tooltips';
import { useRouteConstructor } from '@nx/graph/shared';
import { getProjectGraphService } from '../machines/get-services';

export function CompositeNodeActions({
  id,
  expanded,
}: CompositeNodeTooltipProps) {
  const projectGraphService = getProjectGraphService();
  const routeConstructor = useRouteConstructor();
  const encodedId = encodeURIComponent(id);

  function onExpand() {
    projectGraphService.send({ type: 'expandCompositeNode', id });
  }

  function onCollapse() {
    projectGraphService.send({ type: 'collapseCompositeNode', id });
  }

  function onExclude() {
    projectGraphService.send({
      type: 'deselectProject',
      projectName: id,
    });
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <TooltipLinkButton
        to={routeConstructor(
          {
            pathname: `/projects`,
            search: `?composite=true&compositeContext=${encodedId}`,
          },
          false
        )}
      >
        Focus
      </TooltipLinkButton>
      {expanded ? (
        <TooltipButton onClick={onCollapse}>Collapse</TooltipButton>
      ) : (
        <TooltipButton onClick={onExpand}>Expand</TooltipButton>
      )}
      <TooltipButton onClick={onExclude}>Exclude</TooltipButton>
    </div>
  );
}
