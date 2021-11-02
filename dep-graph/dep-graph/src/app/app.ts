// nx-ignore-next-line
import type { DepGraphClientResponse } from '@nrwl/workspace/src/command-line/dep-graph';
import { ProjectGraph } from '@nrwl/devkit';
import { combineLatest, fromEvent, Subject } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { DebuggerPanel } from './debugger-panel';
import { GraphComponent } from './graph';
import { AppConfig, DEFAULT_CONFIG } from './models';
import { GraphTooltipService } from './tooltip-service';
import { SidebarComponent } from './ui-sidebar/sidebar';

export class AppComponent {
  private sidebar: SidebarComponent;
  private tooltipService = new GraphTooltipService();
  private graph = new GraphComponent(this.tooltipService);
  private debuggerPanel: DebuggerPanel;

  private windowResize$ = fromEvent(window, 'resize').pipe(startWith({}));
  private render$ = new Subject<{ newProjects: string[] }>();

  constructor(private config: AppConfig = DEFAULT_CONFIG) {
    this.render$.subscribe((nextRenderConfig) => this.render(nextRenderConfig));

    this.loadProjectGraph(config.defaultProjectGraph);

    if (window.watch === true) {
      setInterval(
        () => this.loadProjectGraph(config.defaultProjectGraph),
        5000
      );
    }
  }

  private async loadProjectGraph(projectGraphId: string) {
    const projectInfo = this.config.projectGraphs.find(
      (graph) => graph.id === projectGraphId
    );

    const project: DepGraphClientResponse =
      await this.config.projectGraphService.getProjectGraph(projectInfo.url);

    const workspaceLayout = project?.layout;

    const nodes = Object.values(project.projects).reduce((acc, cur: any) => {
      acc[cur.name] = cur;
      return acc;
    }, {});

    const newProjects = !!window.graph
      ? project.changes.added.filter(
          (addedProject) => !window.graph.nodes[addedProject]
        )
      : project.changes.added;

    window.projects = project.projects;
    window.graph = <ProjectGraph>{
      dependencies: project.dependencies,
      nodes: nodes,
    };
    window.focusedProject = null;
    window.projectGraphList = this.config.projectGraphs;
    window.selectedProjectGraph = projectGraphId;
    window.workspaceLayout = workspaceLayout;

    if (this.sidebar) {
      this.render$.next({ newProjects });
    } else {
      this.render$.next();
    }
  }

  private render(renderConfig: { newProjects: string[] } | undefined) {
    const debuggerPanelContainer = document.getElementById('debugger-panel');

    if (this.config.showDebugger) {
      debuggerPanelContainer.hidden = false;
      debuggerPanelContainer.style.display = 'flex';

      this.debuggerPanel = new DebuggerPanel(
        debuggerPanelContainer,
        window.projectGraphList
      );

      this.debuggerPanel.selectProject$.subscribe((id) => {
        this.loadProjectGraph(id);
        this.sidebar.resetSidebarVisibility();
      });
    }

    this.graph.projectGraph = window.graph;
    const affectedProjects = window.affected;

    this.graph.affectedProjects = affectedProjects;

    if (!this.sidebar) {
      this.sidebar = new SidebarComponent(affectedProjects);
    } else {
      this.sidebar.projects = window.projects;

      if (renderConfig?.newProjects.length > 0) {
        this.sidebar.selectProjects(renderConfig.newProjects);
      }
    }

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

        if (selectedProjects.length === 0) {
          document.getElementById('no-projects-chosen').style.display = 'flex';
        } else {
          document.getElementById('no-projects-chosen').style.display = 'none';
          this.graph.render(selectedProjects, groupByFolder);
        }
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
