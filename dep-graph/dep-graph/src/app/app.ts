import { combineLatest, fromEvent, Subject } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { projectGraphs } from '../graphs';
import { DebuggerPanel } from './debugger-panel';
import { GraphComponent } from './graph';
import { GraphTooltipService } from './tooltip-service';
import { SidebarComponent } from './ui-sidebar/sidebar';

export interface AppConfig {
  showDebugger: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  showDebugger: false,
};
export class AppComponent {
  private sidebar: SidebarComponent;
  private tooltipService = new GraphTooltipService();
  private graph = new GraphComponent(this.tooltipService);
  private debuggerPanel: DebuggerPanel;

  private windowResize$ = fromEvent(window, 'resize').pipe(startWith({}));
  private render$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(private config: AppConfig = DEFAULT_CONFIG) {
    this.render$.subscribe(() => this.render());
    this.render$.next();
  }

  private onProjectGraphChange(projectGraphId: string) {
    // reset previous listeners as we're re-rendering
    this.destroy$.next();

    const project = projectGraphs.find((graph) => graph.id === projectGraphId);
    const projectGraph = project?.graph;
    const workspaceLayout = project?.workspaceLayout;

    const nodes = Object.values(projectGraph.nodes).filter(
      (node) => node.type !== 'npm'
    );

    window.projects = nodes;
    window.graph = projectGraph;
    window.affected = [];
    window.exclude = [];
    window.focusedProject = null;
    window.projectGraphList = projectGraphs;
    window.selectedProjectGraph = projectGraphId;
    window.workspaceLayout = workspaceLayout;

    this.render();
  }

  private render() {
    const debuggerPanelContainer = document.getElementById('debugger-panel');

    if (this.config.showDebugger) {
      debuggerPanelContainer.hidden = false;
      debuggerPanelContainer.style.display = 'flex';

      this.debuggerPanel = new DebuggerPanel(
        debuggerPanelContainer,
        window.projectGraphList
      );

      this.debuggerPanel.selectProject$.subscribe((id) => {
        this.onProjectGraphChange(id);
      });
    }

    this.graph.projectGraph = window.graph;
    const affectedProjects = window.affected.filter(
      (affectedProjectName) => !affectedProjectName.startsWith('npm:')
    );

    this.graph.affectedProjects = affectedProjects;
    this.sidebar = new SidebarComponent(
      this.destroy$,
      affectedProjects,
      this.config.showDebugger
    );

    combineLatest([
      this.sidebar.selectedProjectsChanged$,
      this.sidebar.groupByFolderChanged$,
      this.windowResize$,
    ])
      .pipe(takeUntil(this.render$))
      .subscribe(([selectedProjectNames, groupByFolder]) => {
        const selectedProjects = [];

        selectedProjectNames.forEach((projectName) => {
          if (window.graph.nodes[projectName]) {
            selectedProjects.push(window.graph.nodes[projectName]);
          }
        });

        this.graph.render(selectedProjects, groupByFolder);
      });

    if (this.debuggerPanel) {
      this.graph.renderTimes$
        .pipe(takeUntil(this.render$))
        .subscribe(
          (renderTime) => (this.debuggerPanel.renderTime = renderTime)
        );
    }
  }
}
