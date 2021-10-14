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

  private static renderHtmlTemplate(): HTMLElement {
    const render = document.createElement('template');
    render.innerHTML = `
        <div class="mt-10 px-4">
          <div class="p-2 shadow-sm bg-green-nx-base text-gray-50 border border-gray-200 rounded-md flex items-center group relative cursor-pointer overflow-hidden" data-cy="unfocusButton">
            <p class="truncate transition duration-200 ease-in-out group-hover:opacity-60">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline -mt-1 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span id="focused-project-name">e2e-some-other-very-long-project-name</span>
            </p>
            <div class="absolute right-2 flex transition-all translate-x-32 transition duration-200 ease-in-out group-hover:translate-x-0 pl-2 rounded-md text-gray-700 items-center text-sm font-medium bg-white shadow-sm ring-1 ring-gray-500">
              Reset
              <span class="p-1 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
           </div>
         </div>
        </div>
      `.trim();
    return render.content.firstChild as HTMLElement;
  }

  unfocusProject() {
    this.render();
  }

  private render(projectName?: string) {
    removeChildrenFromContainer(this.container);

    const element = FocusedProjectPanel.renderHtmlTemplate();
    const projectNameElement: HTMLElement = element.querySelector(
      '#focused-project-name'
    );
    const unfocusButtonElement = element.querySelector(
      '[data-cy="unfocusButton"]'
    );

    if (projectName && projectName !== '') {
      projectNameElement.innerText = `Focused on ${projectName}`;
      this.container.hidden = false;
    } else {
      this.container.hidden = true;
    }

    unfocusButtonElement.addEventListener('click', () =>
      this.unfocusSubject.next()
    );

    this.container.appendChild(element);
  }
}
