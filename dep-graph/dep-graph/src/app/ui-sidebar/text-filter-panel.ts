import { fromEvent, Subject, Subscription } from 'rxjs';
import { removeChildrenFromContainer } from '../util';
import { debounceTime, filter, map } from 'rxjs/operators';

export interface TextFilterChangeEvent {
  text: string;
  includeInPath: boolean;
}

export class TextFilterPanel {
  private textInput: HTMLInputElement;
  private includeInPathCheckbox: HTMLInputElement;
  private changesSubject = new Subject<TextFilterChangeEvent>();
  private subscriptions: Subscription[] = [];

  changes$ = this.changesSubject.asObservable();

  constructor(private container: HTMLElement) {
    this.subscriptions.map((s) => s.unsubscribe());
    this.render();
  }

  private static renderHtmlTemplate(): HTMLElement {
    const render = document.createElement('template');
    render.innerHTML = `
        <div>
          <div class="mt-10 px-4">
            <form class="flex rounded-md shadow-sm relative" onSubmit="return false">
              <span class="inline-flex items-center p-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </span>
              <input type="text" class="p-1.5 bg-white text-gray-600 flex-1 block w-full rounded-none rounded-r-md border border-gray-300" placeholder="lib name, other lib name" data-cy="textFilterInput" name="filter">
              <button id="textFilterReset" type="reset" class="p-1 top-1 right-1 absolute bg-white inline-block rounded-md text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
            </form>
          </div>
          <div class="mt-4 px-4">
            <div class="flex items-start">
              <div class="flex items-center h-5">
                <input id="includeInPath" name="textFilterCheckbox" type="checkbox" value="includeInPath" class="h-4 w-4 border-gray-300 rounded" disabled>
              </div>
              <div class="ml-3 text-sm">
                <label for="includeInPath" class="font-medium text-gray-700 cursor-pointer">Include related libraries</label>
                <p class="text-gray-500">Show libraries that are related to your search.</p>
              </div>
            </div>
          </div>
        </div>
      `.trim();
    return render.content.firstChild as HTMLElement;
  }

  private emitChanges() {
    this.changesSubject.next({
      text: this.textInput.value.toLowerCase(),
      includeInPath: this.includeInPathCheckbox.checked,
    });
  }

  private render() {
    removeChildrenFromContainer(this.container);

    const element = TextFilterPanel.renderHtmlTemplate();
    const resetInputElement: HTMLElement =
      element.querySelector('#textFilterReset');
    resetInputElement.classList.add('hidden');

    this.textInput = element.querySelector('input[type="text"]');
    this.textInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') this.emitChanges();
      if (!!this.textInput.value.length) {
        resetInputElement.classList.remove('hidden');
        this.includeInPathCheckbox.disabled = false;
      } else {
        resetInputElement.classList.add('hidden');
        this.includeInPathCheckbox.disabled = true;
      }
    });

    this.subscriptions.push(
      fromEvent(this.textInput, 'keyup')
        .pipe(
          filter((event: KeyboardEvent) => event.key !== 'Enter'),
          debounceTime(500),
          map(() => this.emitChanges())
        )
        .subscribe()
    );

    this.includeInPathCheckbox = element.querySelector('#includeInPath');
    this.includeInPathCheckbox.addEventListener('change', () =>
      this.emitChanges()
    );

    resetInputElement.addEventListener('click', () => {
      this.textInput.value = '';
      this.includeInPathCheckbox.checked = false;
      this.includeInPathCheckbox.disabled = true;
      resetInputElement.classList.add('hidden');
      this.emitChanges();
    });

    this.container.appendChild(element);
  }
}
