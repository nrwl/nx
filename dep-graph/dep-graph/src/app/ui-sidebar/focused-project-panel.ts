import { Subject } from 'rxjs';

export class FocusedProjectPanel {
  private unfocusSubject = new Subject<void>();
  private header: HTMLHeadingElement;
  private unfocusButton: HTMLButtonElement;

  set projectName(projectName: string) {
    this.render(projectName);
  }

  unfocus$ = this.unfocusSubject.asObservable();

  constructor(private container: HTMLElement) {
    this.render();
  }

  private render(projectName?: string) {
    if (!this.header) {
      this.header = document.createElement('h4');
      this.container.appendChild(this.header);
    }

    if (projectName && projectName !== '') {
      this.header.innerText = `Focused on ${projectName}`;
      this.container.hidden = false;
    } else {
      this.container.hidden = true;
    }

    if (!this.unfocusButton) {
      this.unfocusButton = document.createElement('button');
      this.unfocusButton.innerText = 'Unfocus';

      this.unfocusButton.dataset['cy'] = 'unfocusButton';

      this.unfocusButton.addEventListener('click', () =>
        this.unfocusSubject.next()
      );
      this.container.appendChild(this.unfocusButton);
    }
  }
}
