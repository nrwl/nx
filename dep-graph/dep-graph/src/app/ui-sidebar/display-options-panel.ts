import { Subject } from 'rxjs';

export class DisplayOptionsPanel {
  private showAffected = false;
  private groupByFolder = false;
  private selectAffectedSubject = new Subject<void>();
  private selectAllSubject = new Subject<void>();
  private deselectAllSubject = new Subject<void>();
  private groupByFolderSubject = new Subject<boolean>();

  selectAffected$ = this.selectAffectedSubject.asObservable();
  selectAll$ = this.selectAllSubject.asObservable();
  deselectAll$ = this.deselectAllSubject.asObservable();
  groupByFolder$ = this.groupByFolderSubject.asObservable();

  constructor(showAffected = false, groupByFolder = false) {
    this.showAffected = showAffected;
    this.groupByFolder = groupByFolder;
  }

  render(container: HTMLElement) {
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

    container.appendChild(header);
    container.appendChild(selectButtonsContainer);
    container.appendChild(groupByFolderLabel);
  }
}
