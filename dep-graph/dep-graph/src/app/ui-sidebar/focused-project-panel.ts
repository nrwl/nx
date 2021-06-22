import { Subject } from 'rxjs';
import { removeChildrenFromContainer } from '../util';

export class FocusedProjectPanel {
  private unfocusSubject = new Subject<void>();

  set projectName(projectName: string) {
    this.render(projectName);
  }

  unfocus$ = this.unfocusSubject.asObservable();

  constructor(private container: HTMLElement) {
    this.render();
  }

  unfocusProject() {
    this.render();
  }

  private render(projectName?: string) {
    removeChildrenFromContainer(this.container);

    const header = document.createElement('h4');
    this.container.appendChild(header);

    if (projectName && projectName !== '') {
      header.innerText = `Focused on ${projectName}`;
      this.container.hidden = false;
    } else {
      this.container.hidden = true;
    }

    const unfocusButton = document.createElement('button');
    unfocusButton.innerText = 'Unfocus';

    unfocusButton.dataset['cy'] = 'unfocusButton';

    unfocusButton.addEventListener('click', () => this.unfocusSubject.next());
    this.container.appendChild(unfocusButton);
  }
}
