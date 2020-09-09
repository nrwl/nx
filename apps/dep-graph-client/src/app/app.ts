import { combineLatest, fromEvent } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { GraphComponent } from './graph';
import { GraphTooltipService } from './tooltip-service';
import { SidebarComponent } from './ui-sidebar/sidebar';

export class AppComponent {
  private sidebar: SidebarComponent;
  private tooltipService = new GraphTooltipService();
  private graph = new GraphComponent(this.tooltipService);

  private windowResize$ = fromEvent(window, 'resize').pipe(startWith({}));

  constructor() {
    this.graph.projectGraph = window.graph;
    const affectedProjects = window.affected.filter(
      (affectedProjectName) => !affectedProjectName.startsWith('npm:')
    );

    this.graph.affectedProjects = affectedProjects;
    this.sidebar = new SidebarComponent(affectedProjects);

    combineLatest([
      this.sidebar.selectedProjectsChanged$,
      this.sidebar.groupByFolderChanged$,
      this.windowResize$,
    ]).subscribe(([selectedProjectNames, groupByFolder]) => {
      const selectedProjects = [];

      selectedProjectNames.forEach((projectName) => {
        if (window.graph.nodes[projectName]) {
          selectedProjects.push(window.graph.nodes[projectName]);
        }
      });

      this.graph.render(selectedProjects, groupByFolder);
    });
  }
}
