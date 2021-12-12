import { DisplayOptionsPanel } from './display-options-panel';
import { FocusedProjectPanel } from './focused-project-panel';
import { ProjectList } from './project-list';
import { TextFilterPanel } from './text-filter-panel';

declare var ResizeObserver;

export class SidebarComponent {
  private displayOptionsPanel: DisplayOptionsPanel;
  private focusedProjectPanel: FocusedProjectPanel;
  private textFilterPanel: TextFilterPanel;
  private projectList: ProjectList;

  constructor() {
    const displayOptionsPanelContainer = document.getElementById(
      'display-options-panel'
    );

    this.displayOptionsPanel = new DisplayOptionsPanel(
      displayOptionsPanelContainer
    );

    const focusedProjectPanelContainer =
      document.getElementById('focused-project');

    this.focusedProjectPanel = new FocusedProjectPanel(
      focusedProjectPanelContainer
    );

    const textFilterPanelContainer =
      document.getElementById('text-filter-panel');
    this.textFilterPanel = new TextFilterPanel(textFilterPanelContainer);

    const projectListContainer = document.getElementById('project-lists');
    this.projectList = new ProjectList(projectListContainer);
  }
}
