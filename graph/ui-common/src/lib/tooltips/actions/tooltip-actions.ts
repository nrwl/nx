export type TooltipNodeType = 'projectNode' | 'compositeNode' | 'taskNode';

export interface CommonNodeTooltipAction {
  /**
   * Type of node that was clicked
   */
  tooltipNodeType: TooltipNodeType;
  rawId: string;
  /**
   * Encoded ID
   */
  id: string;
}

export interface FocusNodeTooltipAction extends CommonNodeTooltipAction {
  type: 'focus-node';
}

export interface ExpandNodeTooltipAction extends CommonNodeTooltipAction {
  type: 'expand-node';
}

export interface CollapseNodeTooltipAction extends CommonNodeTooltipAction {
  type: 'collapse-node';
}

export interface ExcludeNodeTooltipAction extends CommonNodeTooltipAction {
  type: 'exclude-node';
}

export interface StartTraceTooltipAction extends CommonNodeTooltipAction {
  type: 'start-trace';
}

export interface EndTraceTooltipAction extends CommonNodeTooltipAction {
  type: 'end-trace';
}

export interface SelectAndExpandNodeTooltipAction
  extends CommonNodeTooltipAction {
  type: 'select-and-expand-node';
}

export interface ChangeSelectionTooltipAction extends CommonNodeTooltipAction {
  type: 'change-selection';
}

export type CompositeNodeTooltipAction =
  | FocusNodeTooltipAction
  | ExpandNodeTooltipAction
  | CollapseNodeTooltipAction
  | ExcludeNodeTooltipAction
  | SelectAndExpandNodeTooltipAction
  | ChangeSelectionTooltipAction;

export type ProjectNodeTooltipAction =
  | FocusNodeTooltipAction
  | ExcludeNodeTooltipAction
  | StartTraceTooltipAction
  | EndTraceTooltipAction;

export type NodeTooltipAction =
  | CompositeNodeTooltipAction
  | ProjectNodeTooltipAction;

export type NodeTooltipActionType = NodeTooltipAction['type'];
