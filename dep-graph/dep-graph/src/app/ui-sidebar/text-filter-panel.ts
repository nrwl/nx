import { fromEvent, Subscription } from 'rxjs';
import { debounceTime, filter, map } from 'rxjs/operators';
import { useDepGraphService } from '../machines/dep-graph.service';
import { DepGraphSend } from '../machines/interfaces';
import { removeChildrenFromContainer } from '../util';

export interface TextFilterChangeEvent {
  text: string;
  includeInPath: boolean;
}

export class TextFilterPanel {
  private textInput: HTMLInputElement;
  private includeInPathCheckbox: HTMLInputElement;
  private send: DepGraphSend;

  constructor(private container: HTMLElement) {
    const [_, send] = useDepGraphService();
    this.send = send;
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
                <input disabled id="includeInPath" name="textFilterCheckbox" type="checkbox" value="includeInPath" class="h-4 w-4 border-gray-300 rounded">
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

  private render() {
    removeChildrenFromContainer(this.container);

    const element = TextFilterPanel.renderHtmlTemplate();
    const resetInputElement: HTMLElement =
      element.querySelector('#textFilterReset');
    resetInputElement.classList.add('hidden');

    this.textInput = element.querySelector('input[type="text"]');
    this.textInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        this.send({ type: 'filterByText', search: this.textInput.value });
      }

      if (!!this.textInput.value.length) {
        resetInputElement.classList.remove('hidden');
        this.includeInPathCheckbox.disabled = false;
      } else {
        resetInputElement.classList.add('hidden');
        this.includeInPathCheckbox.disabled = true;
      }
    });

    fromEvent(this.textInput, 'keyup')
      .pipe(
        filter((event: KeyboardEvent) => event.key !== 'Enter'),
        debounceTime(500),
        map(() =>
          this.send({ type: 'filterByText', search: this.textInput.value })
        )
      )
      .subscribe();

    this.includeInPathCheckbox = element.querySelector('#includeInPath');
    this.includeInPathCheckbox.addEventListener('change', () =>
      this.send({
        type: 'setIncludeProjectsByPath',
        includeProjectsByPath: this.includeInPathCheckbox.checked,
      })
    );

    resetInputElement.addEventListener('click', () => {
      this.textInput.value = '';
      this.includeInPathCheckbox.checked = false;
      this.includeInPathCheckbox.disabled = true;
      resetInputElement.classList.add('hidden');
      this.send([{ type: 'clearTextFilter' }]);
    });

    this.container.appendChild(element);
  }
}
