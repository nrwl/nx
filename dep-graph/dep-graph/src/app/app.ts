// nx-ignore-next-line
import type { DepGraphClientResponse } from '@nrwl/workspace/src/command-line/dep-graph';
import { fromEvent } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { DebuggerPanel } from './debugger-panel';
import { useGraphService } from './graph.service';
import { useDepGraphService } from './machines/dep-graph.service';
import { DepGraphUIEvents, DepGraphSend } from './machines/interfaces';
import { AppConfig, DEFAULT_CONFIG, ProjectGraphService } from './models';
import { SidebarComponent } from './ui-sidebar/sidebar';

export class AppComponent {
  private sidebar = new SidebarComponent();
  private graph = useGraphService();
  private debuggerPanel: DebuggerPanel;

  private windowResize$ = fromEvent(window, 'resize').pipe(startWith({}));

  private send: DepGraphSend;

  constructor(
    private config: AppConfig = DEFAULT_CONFIG,
    private projectGraphService: ProjectGraphService
  ) {
    const [state$, send] = useDepGraphService();

    state$.subscribe((state) => {
      if (state.context.selectedProjects.length !== 0) {
        document.getElementById('no-projects-chosen').style.display = 'none';
      } else {
        document.getElementById('no-projects-chosen').style.display = 'flex';
      }
    });

    this.send = send;

    this.loadProjectGraph(config.defaultProjectGraph);
    this.render();

    if (window.watch === true) {
      setInterval(
        () => this.updateProjectGraph(config.defaultProjectGraph),
        5000
      );
    }
  }

  private async loadProjectGraph(projectGraphId: string) {
    const projectInfo = this.config.projectGraphs.find(
      (graph) => graph.id === projectGraphId
    );

    const project: DepGraphClientResponse =
      await this.projectGraphService.getProjectGraph(projectInfo.url);

    const workspaceLayout = project?.layout;
    this.send({
      type: 'initGraph',
      projects: project.projects,
      dependencies: project.dependencies,
      affectedProjects: project.affected,
      workspaceLayout: workspaceLayout,
    });

    if (!!window.focusedProject) {
      this.send({
        type: 'focusProject',
        projectName: window.focusedProject,
      });
    }

    if (window.groupByFolder) {
      this.send({
        type: 'setGroupByFolder',
        groupByFolder: window.groupByFolder,
      });
    }
  }

  private async updateProjectGraph(projectGraphId: string) {
    const projectInfo = this.config.projectGraphs.find(
      (graph) => graph.id === projectGraphId
    );

    const project: DepGraphClientResponse =
      await this.projectGraphService.getProjectGraph(projectInfo.url);

    this.send({
      type: 'updateGraph',
      projects: project.projects,
      dependencies: project.dependencies,
    });
  }

  private render() {
    const debuggerPanelContainer = document.getElementById('debugger-panel');

    if (this.config.showDebugger) {
      debuggerPanelContainer.hidden = false;
      debuggerPanelContainer.style.display = 'flex';

      this.debuggerPanel = new DebuggerPanel(
        debuggerPanelContainer,
        this.config.projectGraphs,
        this.config.defaultProjectGraph
      );

      this.debuggerPanel.selectProject$.subscribe((id) => {
        this.loadProjectGraph(id);
      });

      this.graph.renderTimes$.subscribe(
        (renderTime) => (this.debuggerPanel.renderTime = renderTime)
      );
    }
  }
}
