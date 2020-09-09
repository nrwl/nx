import { ProjectGraphNode } from '@nrwl/workspace';
import { Subject } from 'rxjs';

export class ProjectList {
  private focusProjectSubject = new Subject<string>();
  private checkedProjectsChangeSubject = new Subject<string[]>();
  private checkboxes: Record<string, HTMLInputElement> = {};
  checkedProjectsChange$ = this.checkedProjectsChangeSubject.asObservable();
  focusProject$ = this.focusProjectSubject.asObservable();

  constructor(
    private container: HTMLElement,
    private projects: ProjectGraphNode[]
  ) {
    this.render();
  }

  setCheckedProjects(selectedProjects: string[]) {
    Object.keys(this.checkboxes).forEach((projectName) => {
      this.checkboxes[projectName].checked = selectedProjects.includes(
        projectName
      );
    });
  }

  checkAllProjects() {
    Object.values(this.checkboxes).forEach(
      (checkbox) => (checkbox.checked = true)
    );
  }

  uncheckAllProjects() {
    Object.values(this.checkboxes).forEach((checkbox) => {
      checkbox.checked = false;
    });
  }

  uncheckProject(projectName: string) {
    this.checkboxes[projectName].checked = false;
  }

  private emitChanges() {
    const changes = Object.values(this.checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    this.checkedProjectsChangeSubject.next(changes);
  }

  private render() {
    const appProjects = this.getProjectsByType('app');
    const libProjects = this.getProjectsByType('lib');
    const e2eProjects = this.getProjectsByType('e2e');

    const libDirectoryGroups = this.groupProjectsByDirectory(libProjects);

    const appsHeader = document.createElement('h4');
    appsHeader.textContent = 'app projects';
    this.container.append(appsHeader);
    this.createProjectList('apps', appProjects);

    const e2eHeader = document.createElement('h4');
    e2eHeader.textContent = 'e2e projects';
    this.container.append(e2eHeader);
    this.createProjectList('e2e', e2eProjects);

    const libHeader = document.createElement('h4');
    libHeader.textContent = 'lib projects';
    this.container.append(libHeader);

    const sortedDirectories = Object.keys(libDirectoryGroups).sort();

    sortedDirectories.forEach((directoryName) => {
      this.createProjectList(directoryName, libDirectoryGroups[directoryName]);
    });
  }

  private getProjectsByType(type) {
    return this.projects
      .filter((project) => project.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private groupProjectsByDirectory(projects) {
    let groups = {};

    projects.forEach((project) => {
      const split = project.data.root.split('/');
      const directory = split.slice(1, -1).join('/');

      if (!groups.hasOwnProperty(directory)) {
        groups[directory] = [];
      }
      groups[directory].push(project);
    });

    return groups;
  }

  private createProjectList(headerText, projects) {
    const header = document.createElement('h5');
    header.textContent = headerText;

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    let sortedProjects = [...projects];
    sortedProjects.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    projects.forEach((project) => {
      let formLine = document.createElement('div');
      formLine.className = 'form-line';

      let focusButton = document.createElement('button');
      focusButton.className = 'icon';

      let buttonIconContainer = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      let buttonIcon = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use'
      );

      buttonIcon.setAttributeNS(
        'http://www.w3.org/1999/xlink',
        'xlink:href',
        '#crosshair'
      );

      buttonIconContainer.appendChild(buttonIcon);

      focusButton.append(buttonIconContainer);

      focusButton.onclick = () => {
        this.focusProjectSubject.next(project.name);
      };

      let label = document.createElement('label');
      label.className = 'form-checkbox';

      let checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'projectName';
      checkbox.value = project.name;
      checkbox.checked = false;

      checkbox.addEventListener('change', () => this.emitChanges());

      this.checkboxes[project.name] = checkbox;

      const labelText = document.createTextNode(project.name);

      formLine.append(focusButton);
      formLine.append(label);

      label.append(checkbox);
      label.append(labelText);

      formGroup.append(formLine);
    });

    this.container.append(header);
    this.container.append(formGroup);
  }
}
