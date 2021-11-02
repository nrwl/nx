import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { distinctUntilChanged, map, withLatestFrom } from 'rxjs/operators';
import { removeChildrenFromContainer } from '../util';

export class DisplayOptionsPanel {
  private showAffected = false;
  private groupByFolder = false;
  private selectAffectedSubject = new Subject<void>();
  private selectAllSubject = new Subject<void>();
  private deselectAllSubject = new Subject<void>();
  private groupByFolderSubject = new Subject<boolean>();
  private searchByDepthSubject = new BehaviorSubject<number>(1);
  private searchByDepthEnabledSubject = new BehaviorSubject<boolean>(false);
  private searchDepthChangesSubject = new Subject<'increment' | 'decrement'>();

  selectAffected$ = this.selectAffectedSubject.asObservable();
  selectAll$ = this.selectAllSubject.asObservable();
  deselectAll$ = this.deselectAllSubject.asObservable();
  groupByFolder$ = this.groupByFolderSubject.asObservable();
  searchDepth$ = combineLatest([
    this.searchByDepthSubject,
    this.searchByDepthEnabledSubject,
  ]).pipe(
    map(([searchDepth, enabled]) => {
      return enabled ? searchDepth : -1;
    }),
    distinctUntilChanged()
  );

  searchDepthDisplay: HTMLSpanElement;

  constructor(showAffected = false, groupByFolder = false) {
    this.showAffected = showAffected;
    this.groupByFolder = groupByFolder;

    this.searchDepthChangesSubject
      .pipe(withLatestFrom(this.searchByDepthSubject))
      .subscribe(([action, current]) => {
        if (action === 'decrement' && current > 1) {
          this.searchByDepthSubject.next(current - 1);
        } else if (action === 'increment') {
          this.searchByDepthSubject.next(current + 1);
        }
      });

    this.searchByDepthSubject.subscribe((current) => {
      if (this.searchDepthDisplay) {
        this.searchDepthDisplay.innerText = current.toString();
      }
    });
  }

  private static renderHtmlTemplate(): HTMLElement {
    const render = document.createElement('template');
    render.innerHTML = `
        <div>
          <div class="mt-8 px-4">
            <button type="button" class="w-full flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" data-cy="selectAllButton">
              <svg xmlns="http://www.w3.org/2000/svg" class="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Show all projects
            </button>
            <button type="button" class="mt-3 w-full flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-500 bg-white hover:bg-red-50 hidden" data-cy="affectedButton">
              <svg xmlns="http://www.w3.org/2000/svg" class="-ml-1 mr-2 h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Show affected projects
            </button>
            <button type="button" class="mt-3 w-full flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" data-cy="deselectAllButton">
              <svg xmlns="http://www.w3.org/2000/svg" class="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Hide all projects
            </button>
          </div>
    
          <div class="mt-8 px-4">
            <div class="flex items-start">
              <div class="flex items-center h-5">
                <input id="displayOptions" name="displayOptions" value="groupByFolder" type="checkbox" class="h-4 w-4 border-gray-300 rounded">
              </div>
              <div class="ml-3 text-sm">
                <label for="displayOptions" class="cursor-pointer font-medium text-gray-700">Group by folder</label>
                <p class="text-gray-500">Visually arrange libraries by folders with different colors.</p>
              </div>
            </div>
          </div>
          
          <div class="mt-4 px-4">
            <div class="mt-4 flex items-start">
              <div class="flex items-center h-5">
                <input id="depthFilter" name="depthFilter" value="groupByFolder" type="checkbox" class="h-4 w-4 border-gray-300 rounded">
              </div>
              <div class="ml-3 text-sm">
                <label for="depthFilter" class="cursor-pointer font-medium text-gray-700">Activate proximity</label>
                <p class="text-gray-500">Explore connected libraries step by step.</p>
              </div>
            </div>
            <div class="mt-3 px-10">
              <div class="flex rounded-md shadow-sm text-gray-500">
                <button id="depthFilterDecrement" title="Remove ancestor level" class="inline-flex items-center py-2 px-4 rounded-l-md border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                  </svg>
                </button>
                <span id="depthFilterValue" class="p-1.5 bg-white flex-1 block w-full rounded-none border-t border-b border-gray-300 text-center font-mono">1</span>
                <button id="depthFilterIncrement" title="Add ancestor level" class="inline-flex items-center py-2 px-4 rounded-r-md border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `.trim();
    return render.content.firstChild as HTMLElement;
  }

  render(container: HTMLElement) {
    removeChildrenFromContainer(container);

    const element = DisplayOptionsPanel.renderHtmlTemplate();

    const affectedButtonElement: HTMLElement = element.querySelector(
      '[data-cy="affectedButton"]'
    );

    if (this.showAffected) {
      affectedButtonElement.classList.remove('hidden');
      affectedButtonElement.addEventListener('click', () =>
        this.selectAffectedSubject.next()
      );
    }

    const selectAllButtonElement: HTMLElement = element.querySelector(
      '[data-cy="selectAllButton"]'
    );
    selectAllButtonElement.addEventListener('click', () => {
      this.selectAllSubject.next();
    });

    const deselectAllButtonElement: HTMLElement = element.querySelector(
      '[data-cy="deselectAllButton"]'
    );
    deselectAllButtonElement.addEventListener('click', () => {
      this.deselectAllSubject.next();
    });

    const groupByFolderCheckboxElement: HTMLInputElement =
      element.querySelector('#displayOptions');
    groupByFolderCheckboxElement.checked = this.groupByFolder;

    groupByFolderCheckboxElement.addEventListener(
      'change',
      (event: InputEvent) =>
        this.groupByFolderSubject.next((<HTMLInputElement>event.target).checked)
    );

    this.searchDepthDisplay = element.querySelector('#depthFilterValue');
    const incrementButtonElement: HTMLInputElement = element.querySelector(
      '#depthFilterIncrement'
    );
    const decrementButtonElement: HTMLInputElement = element.querySelector(
      '#depthFilterDecrement'
    );
    const searchDepthEnabledElement: HTMLInputElement =
      element.querySelector('#depthFilter');

    incrementButtonElement.addEventListener('click', () => {
      this.searchDepthChangesSubject.next('increment');
    });
    decrementButtonElement.addEventListener('click', () => {
      this.searchDepthChangesSubject.next('decrement');
    });

    searchDepthEnabledElement.addEventListener('change', (event: InputEvent) =>
      this.searchByDepthEnabledSubject.next(
        (<HTMLInputElement>event.target).checked
      )
    );

    container.appendChild(element);
  }
}
