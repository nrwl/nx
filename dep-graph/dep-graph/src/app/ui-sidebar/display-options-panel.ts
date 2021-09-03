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

  render(container: HTMLElement) {
    removeChildrenFromContainer(container);

    const header = document.createElement('h4');
    header.innerText = 'Display Options';

    const selectButtonsContainer = document.createElement('div');
    selectButtonsContainer.classList.add('flex');

    if (this.showAffected) {
      const selectAffectedButton = document.createElement('button');
      selectAffectedButton.innerText = 'Select Affected';
      selectAffectedButton.addEventListener('click', () =>
        this.selectAffectedSubject.next()
      );
      selectButtonsContainer.appendChild(selectAffectedButton);
    }

    const selectAllButton = document.createElement('button');
    selectAllButton.innerText = 'Select All';
    selectAllButton.dataset['cy'] = 'selectAllButton';
    selectAllButton.addEventListener('click', () =>
      this.selectAllSubject.next()
    );

    selectButtonsContainer.appendChild(selectAllButton);

    const deselectAllButton = document.createElement('button');
    deselectAllButton.innerText = 'Deselect All';
    deselectAllButton.dataset['cy'] = 'deselectAllButton';
    deselectAllButton.addEventListener('click', () =>
      this.deselectAllSubject.next()
    );

    selectButtonsContainer.appendChild(deselectAllButton);

    const groupByFolderLabel = document.createElement('label');

    const groupByFolderCheckbox = document.createElement('input');
    groupByFolderCheckbox.type = 'checkbox';
    groupByFolderCheckbox.name = 'displayOptions';
    groupByFolderCheckbox.value = 'groupByFolder';
    groupByFolderCheckbox.checked = this.groupByFolder;

    groupByFolderCheckbox.addEventListener('change', (event: InputEvent) =>
      this.groupByFolderSubject.next((<HTMLInputElement>event.target).checked)
    );

    groupByFolderLabel.appendChild(groupByFolderCheckbox);
    groupByFolderLabel.appendChild(document.createTextNode('group by folder'));

    const searchDepthLabel = document.createElement('label');
    searchDepthLabel.appendChild(document.createTextNode('Search Depth'));

    this.searchDepthDisplay = document.createElement('span');
    this.searchDepthDisplay.innerText = '1';
    this.searchDepthDisplay.classList.add('search-depth');

    const incrementButton = document.createElement('button');
    incrementButton.appendChild(document.createTextNode('+'));

    const decrementButton = document.createElement('button');
    decrementButton.appendChild(document.createTextNode('-'));

    incrementButton.addEventListener('click', () => {
      this.searchDepthChangesSubject.next('increment');
    });

    decrementButton.addEventListener('click', () => {
      this.searchDepthChangesSubject.next('decrement');
    });

    const searchDepthEnabledLabel = document.createElement('label');

    const searchDepthEnabledCheckbox = document.createElement('input');
    searchDepthEnabledCheckbox.type = 'checkbox';
    searchDepthEnabledCheckbox.name = 'displayOptions';
    searchDepthEnabledCheckbox.value = 'groupByFolder';
    searchDepthEnabledCheckbox.checked = this.groupByFolder;
    searchDepthEnabledCheckbox.addEventListener('change', (event: InputEvent) =>
      this.searchByDepthEnabledSubject.next(
        (<HTMLInputElement>event.target).checked
      )
    );

    searchDepthEnabledLabel.appendChild(searchDepthEnabledCheckbox);
    searchDepthEnabledLabel.appendChild(document.createTextNode('enabled'));

    container.appendChild(header);
    container.appendChild(selectButtonsContainer);
    container.appendChild(groupByFolderLabel);
    container.appendChild(searchDepthLabel);
    container.appendChild(decrementButton);
    container.appendChild(this.searchDepthDisplay);
    container.appendChild(incrementButton);
    container.appendChild(searchDepthEnabledLabel);
  }
}
