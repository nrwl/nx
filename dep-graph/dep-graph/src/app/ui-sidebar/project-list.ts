import type { ProjectGraphNode } from '@nrwl/devkit';
import { Subject } from 'rxjs';
import {
  parseParentDirectoriesFromPilePath,
  removeChildrenFromContainer,
} from '../util';

export class ProjectList {
  private focusProjectSubject = new Subject<string>();
  private checkedProjectsChangeSubject = new Subject<string[]>();
  private selectedItems: Record<string, HTMLElement> = {};
  checkedProjectsChange$ = this.checkedProjectsChangeSubject.asObservable();
  focusProject$ = this.focusProjectSubject.asObservable();

  private _projects: ProjectGraphNode[] = [];

  set projects(projects: ProjectGraphNode[]) {
    this._projects = projects;

    const previouslyCheckedProjects = Object.values(this.selectedItems)
      .filter((checkbox) => checkbox.dataset['active'] === 'true')
      .map((checkbox) => checkbox.dataset['project']);
    this.render();
    this.selectProjects(previouslyCheckedProjects);
  }

  get projects(): ProjectGraphNode[] {
    return this._projects;
  }

  constructor(private container: HTMLElement) {
    this.render();
  }

  private static renderHtmlItemTemplate(): HTMLElement {
    const render = document.createElement('template');
    render.innerHTML = `
        <li class="text-xs text-gray-600 block cursor-default select-none relative py-1 pl-3 pr-9">
          <div class="flex items-center">
            <button type="button" class="flex rounded-md" title="Focus on this library">
              <span class="p-1 rounded-md flex items-center font-medium bg-white transition hover:bg-gray-50 shadow-sm ring-1 ring-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2h-1.528A6 6 0 004 9.528V4z" />
                  <path fill-rule="evenodd" d="M8 10a4 4 0 00-3.446 6.032l-1.261 1.26a1 1 0 101.414 1.415l1.261-1.261A4 4 0 108 10zm-2 4a2 2 0 114 0 2 2 0 01-4 0z" clip-rule="evenodd" />
                </svg>
              </span>
            </button>
            <label class="font-mono font-normal ml-3 p-2 transition hover:bg-gray-50 cursor-pointer block rounded-md truncate w-full" data-project="project-name" data-active="false">
              project-name
            </label>
          </div>
          <span role="selection-icon" title="This library is visible" class="text-green-nx-base absolute inset-y-0 right-0 flex items-center cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </span>
        </li>
      `.trim();
    return render.content.firstChild as HTMLElement;
  }

  selectProjects(projects: string[]) {
    projects.forEach((projectName) => {
      if (!!this.selectedItems[projectName]) {
        this.selectedItems[projectName].dataset['active'] = 'true';
        this.selectedItems[projectName].dispatchEvent(
          new CustomEvent('change')
        );
      }
    });
    this.emitChanges();
  }

  setCheckedProjects(selectedProjects: string[]) {
    Object.keys(this.selectedItems).forEach((projectName) => {
      this.selectedItems[projectName].dataset['active'] = selectedProjects
        .includes(projectName)
        .toString();
      this.selectedItems[projectName].dispatchEvent(new CustomEvent('change'));
    });
  }

  checkAllProjects() {
    Object.values(this.selectedItems).forEach((item) => {
      item.dataset['active'] = 'true';
      item.dispatchEvent(new CustomEvent('change'));
    });
  }

  uncheckAllProjects() {
    Object.values(this.selectedItems).forEach((item) => {
      item.dataset['active'] = 'false';
      item.dispatchEvent(new CustomEvent('change'));
    });
  }

  uncheckProject(projectName: string) {
    this.selectedItems[projectName].dataset['active'] = 'false';
    this.selectedItems[projectName].dispatchEvent(new CustomEvent('change'));
  }

  private emitChanges() {
    const changes = Object.values(this.selectedItems)
      .filter((item) => item.dataset['active'] === 'true')
      .map((item) => item.dataset['project']);
    this.checkedProjectsChangeSubject.next(changes);
  }

  private render() {
    removeChildrenFromContainer(this.container);

    const appProjects = this.getProjectsByType('app');
    const libProjects = this.getProjectsByType('lib');
    const e2eProjects = this.getProjectsByType('e2e');

    const appDirectoryGroups = this.groupProjectsByDirectory(appProjects);
    const libDirectoryGroups = this.groupProjectsByDirectory(libProjects);
    const e2eDirectoryGroups = this.groupProjectsByDirectory(e2eProjects);

    const sortedAppDirectories = Object.keys(appDirectoryGroups).sort();
    const sortedLibDirectories = Object.keys(libDirectoryGroups).sort();
    const sortedE2EDirectories = Object.keys(e2eDirectoryGroups).sort();

    const appsHeader = document.createElement('h2');
    appsHeader.className =
      'mt-8 text-lg font-bold border-b border-gray-50 border-solid';
    appsHeader.textContent = 'App projects';
    this.container.append(appsHeader);

    sortedAppDirectories.forEach((directoryName) => {
      this.createProjectList(directoryName, appDirectoryGroups[directoryName]);
    });

    const e2eHeader = document.createElement('h2');
    e2eHeader.className =
      'mt-8 text-lg font-bold border-b border-gray-50 border-solid';
    e2eHeader.textContent = 'E2E projects';
    this.container.append(e2eHeader);

    sortedE2EDirectories.forEach((directoryName) => {
      this.createProjectList(directoryName, e2eDirectoryGroups[directoryName]);
    });

    const libHeader = document.createElement('h2');
    libHeader.className =
      'mt-8 text-lg font-bold border-b border-gray-50 border-solid';
    libHeader.textContent = 'Lib projects';
    this.container.append(libHeader);

    sortedLibDirectories.forEach((directoryName) => {
      this.createProjectList(directoryName, libDirectoryGroups[directoryName]);
    });
  }

  private getProjectsByType(type) {
    return this.projects
      .filter((project) => project.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private groupProjectsByDirectory(projects: ProjectGraphNode[]) {
    let groups = {};

    projects.forEach((project) => {
      const workspaceRoot =
        project.type === 'app' || project.type === 'e2e'
          ? window.workspaceLayout.appsDir
          : window.workspaceLayout.libsDir;
      const directories = parseParentDirectoriesFromPilePath(
        project.data.root,
        workspaceRoot
      );
      const directory = directories.join('/');

      if (!groups.hasOwnProperty(directory)) {
        groups[directory] = [];
      }
      groups[directory].push(project);
    });

    return groups;
  }

  private createProjectList(headerText, projects) {
    const header = document.createElement('h3');
    header.className =
      'mt-4 py-2 uppercase tracking-wide font-semibold text-sm lg:text-xs text-gray-900 cursor-text';
    header.textContent = headerText;

    const formGroup = document.createElement('ul');
    formGroup.className = 'mt-2 -ml-3';

    let sortedProjects = [...projects];
    sortedProjects.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    projects.forEach((project) => {
      const element = ProjectList.renderHtmlItemTemplate();
      const selectedIconElement: HTMLElement = element.querySelector(
        'span[role="selection-icon"]'
      );
      const focusButtonElement: HTMLElement = element.querySelector('button');
      focusButtonElement.addEventListener('click', () =>
        this.focusProjectSubject.next(project.name)
      );

      const projectNameElement: HTMLElement = element.querySelector('label');
      projectNameElement.innerText = project.name;
      projectNameElement.dataset['project'] = project.name;
      projectNameElement.dataset['active'] = 'false';
      selectedIconElement.classList.add('hidden');

      projectNameElement.addEventListener('click', (event) => {
        const el = event.target as HTMLElement;
        el.dataset['active'] =
          el.dataset['active'] === 'false' ? 'true' : 'false';
        el.dispatchEvent(new CustomEvent('change'));

        this.emitChanges();
      });
      projectNameElement.addEventListener('change', (event) => {
        const el = event.target as HTMLElement;
        if (el.dataset['active'] === 'false') {
          selectedIconElement.classList.add('hidden');
        } else selectedIconElement.classList.remove('hidden');
      });

      selectedIconElement.addEventListener('click', () => {
        projectNameElement.dispatchEvent(new Event('click'));
      });

      this.selectedItems[project.name] = projectNameElement;

      formGroup.append(element);
    });

    this.container.append(header);
    this.container.append(formGroup);
  }
}
