import { ProjectGraphNode } from '@nrwl/devkit';
import { BehaviorSubject, combineLatest, fromEvent, Subject } from 'rxjs';
import { DisplayOptionsPanel } from './display-options-panel';
import { FocusedProjectPanel } from './focused-project-panel';
import { ProjectList } from './project-list';
import { TextFilterChangeEvent, TextFilterPanel } from './text-filter-panel';

declare var ResizeObserver;

export class SidebarComponent {
  private selectedProjectsChangedSubject = new BehaviorSubject<string[]>([]);
  private groupByFolderChangedSubject = new BehaviorSubject<boolean>(
    window.groupByFolder
  );

  private focusProjectSubject = new Subject<string>();
  private filterByTextSubject = new Subject<TextFilterChangeEvent>();

  selectedProjectsChanged$ = this.selectedProjectsChangedSubject.asObservable();
  groupByFolderChanged$ = this.groupByFolderChangedSubject.asObservable();

  private displayOptionsPanel: DisplayOptionsPanel;
  private focusedProjectPanel: FocusedProjectPanel;
  private textFilterPanel: TextFilterPanel;
  private projectList: ProjectList;

  private groupByFolder = window.groupByFolder;
  private selectedProjects: string[] = [];

  set projects(projects: ProjectGraphNode[]) {
    this.projectList.projects = projects;
    this.focusedProjectPanel.unfocusProject();
  }

  constructor(private affectedProjects: string[]) {
    const showAffected = this.affectedProjects.length > 0;

    const displayOptionsPanelContainer = document.getElementById(
      'display-options-panel'
    );

    this.displayOptionsPanel = new DisplayOptionsPanel(
      showAffected,
      this.groupByFolder
    );
    this.displayOptionsPanel.render(displayOptionsPanelContainer);

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

    this.projectList.projects = window.projects;

    if (showAffected) {
      this.selectAffectedProjects();
    }

    window.focusProject = (projectId) => {
      this.focusProjectSubject.next(projectId);
    };

    window.excludeProject = (projectId) => {
      this.excludeProject(projectId);
    };

    this.listenForDOMEvents();

    if (window.focusedProject !== null) {
      this.focusProject(window.focusedProject);
    }

    if (window.exclude.length > 0) {
      window.exclude.forEach((project) => this.excludeProject(project));
    }
  }

  selectProjects(projects: string[]) {
    this.projectList.selectProjects(projects);
  }

  resetSidebarVisibility() {
    const sidebarElement = document.getElementById('sidebar');

    if (sidebarElement.classList.contains('hidden')) {
      sidebarElement.classList.remove('hidden');
      sidebarElement.style.marginLeft = `0px`;
    }
  }

  listenForDOMEvents() {
    this.displayOptionsPanel.selectAll$.subscribe(() => {
      this.selectAllProjects();
    });

    this.displayOptionsPanel.deselectAll$.subscribe(() => {
      this.deselectAllProjects();
    });

    this.displayOptionsPanel.selectAffected$.subscribe(() => {
      this.selectAffectedProjects();
    });

    this.displayOptionsPanel.groupByFolder$.subscribe((groupByFolder) => {
      this.groupByFolderChangedSubject.next(groupByFolder);
    });

    this.focusedProjectPanel.unfocus$.subscribe(() => {
      this.unfocusProject();
    });

    this.textFilterPanel.changes$.subscribe((event) => {
      this.filterByTextSubject.next(event);
    });

    combineLatest([
      this.filterByTextSubject,
      this.displayOptionsPanel.searchDepth$,
    ]).subscribe(([event, searchDepth]) => {
      if (event.text && !!event.text.length) {
        this.filterProjectsByText(event.text, event.includeInPath, searchDepth);
      } else this.deselectAllProjects();
    });

    this.projectList.checkedProjectsChange$.subscribe((checkedProjects) => {
      this.emitSelectedProjects(checkedProjects);
    });

    this.projectList.focusProject$.subscribe((projectName) => {
      this.focusProjectSubject.next(projectName);
    });

    combineLatest([
      this.focusProjectSubject,
      this.displayOptionsPanel.searchDepth$,
    ]).subscribe(([projectName, searchDepth]) => {
      if (projectName) {
        this.focusProject(projectName, searchDepth);
      }
    });
  }

  private setFocusedProject(projectId: string = null) {
    window.focusedProject = projectId;
    if (projectId) {
      this.focusedProjectPanel.projectName = window.graph.nodes[projectId].name;
    } else {
      this.focusedProjectPanel.projectName = null;
    }
  }

  selectAffectedProjects() {
    this.setFocusedProject(null);
    this.projectList.setCheckedProjects(this.affectedProjects);
    this.emitSelectedProjects(this.affectedProjects);
  }

  selectAllProjects() {
    this.setFocusedProject(null);
    this.projectList.checkAllProjects();
    this.emitSelectedProjects(window.projects.map((project) => project.name));
  }

  deselectAllProjects() {
    this.setFocusedProject(null);
    this.projectList.uncheckAllProjects();
    this.emitSelectedProjects([]);
  }

  focusProject(id: string, searchDepth: number = -1) {
    this.filterByTextSubject.next({ text: null, includeInPath: false });
    this.setFocusedProject(id);

    const selectedProjects = window.projects
      .map((project) => project.name)
      .filter(
        (projectName) =>
          this.hasPath(id, projectName, [], 1, searchDepth) ||
          this.hasPath(projectName, id, [], 1, searchDepth)
      );

    this.projectList.setCheckedProjects(selectedProjects);

    this.emitSelectedProjects(selectedProjects);
  }

  unfocusProject() {
    this.focusProjectSubject.next(null);
    this.setFocusedProject(null);

    this.projectList.uncheckAllProjects();

    this.emitSelectedProjects([]);
  }

  excludeProject(id: string) {
    const selectedProjects = [...this.selectedProjects];
    selectedProjects.splice(this.selectedProjects.indexOf(id), 1);

    this.projectList.uncheckProject(id);
    this.emitSelectedProjects(selectedProjects);
  }

  emitSelectedProjects(selectedProjects: string[]) {
    this.selectedProjects = selectedProjects;

    this.selectedProjectsChangedSubject.next(selectedProjects);
  }

  filterProjectsByText(
    text: string,
    includeInPath: boolean,
    searchDepth: number
  ) {
    this.focusProjectSubject.next(null);
    this.setFocusedProject(null);
    this.projectList.uncheckAllProjects();

    const split = text.split(',').map((splitItem) => splitItem.trim());

    const selectedProjects = new Set<string>();

    window.projects
      .map((project) => project.name)
      .forEach((project) => {
        const projectMatch =
          split.findIndex((splitItem) => project.includes(splitItem)) > -1;

        if (projectMatch) {
          selectedProjects.add(project);

          if (includeInPath) {
            window.projects
              .map((project) => project.name)
              .forEach((projectInPath) => {
                if (
                  this.hasPath(project, projectInPath, [], 1, searchDepth) ||
                  this.hasPath(projectInPath, project, [], 1, searchDepth)
                ) {
                  selectedProjects.add(projectInPath);
                }
              });
          }
        }
      });

    const selectedProjectsArray = Array.from(selectedProjects);
    this.projectList.setCheckedProjects(selectedProjectsArray);
    this.emitSelectedProjects(selectedProjectsArray);
  }

  private hasPath(
    target,
    node,
    visited,
    currentSearchDepth: number,
    maxSearchDepth: number = -1 // -1 indicates unlimited search depth
  ) {
    if (target === node) return true;

    if (maxSearchDepth === -1 || currentSearchDepth <= maxSearchDepth) {
      for (let d of window.graph.dependencies[node] || []) {
        if (visited.indexOf(d.target) > -1) continue;
        visited.push(d.target);
        if (
          this.hasPath(
            target,
            d.target,
            visited,
            currentSearchDepth + 1,
            maxSearchDepth
          )
        )
          return true;
      }
    }

    return false;
  }
}
