import { Subject } from 'rxjs';

export interface TextFilterChangeEvent {
  text: string;
  includeInPath: boolean;
}

export class TextFilterPanel {
  private textInput: HTMLInputElement;
  private includeInPathCheckbox: HTMLInputElement;
  private changesSubject = new Subject<TextFilterChangeEvent>();

  changes$ = this.changesSubject.asObservable();

  constructor(private container: HTMLElement) {
    this.render();
  }

  private emitChanges() {
    this.changesSubject.next({
      text: this.textInput.value.toLowerCase(),
      includeInPath: this.includeInPathCheckbox.checked,
    });
  }

  private render() {
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('flex');

    this.textInput = document.createElement('input');
    this.textInput.type = 'text';
    this.textInput.name = 'filter';
    this.textInput.dataset['cy'] = 'textFilterInput';
    this.textInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        this.emitChanges();
      }
    });
    this.textInput.style.flex = '1';
    this.textInput.style.marginRight = '1.5em';

    const filterButton = document.createElement('button');
    filterButton.innerText = 'Filter';
    filterButton.dataset['cy'] = 'textFilterButton';
    filterButton.style.flex = 'none';

    filterButton.addEventListener('click', () => {
      this.emitChanges();
    });

    inputContainer.appendChild(this.textInput);
    inputContainer.appendChild(filterButton);

    const includeProjectLabel = document.createElement('label');
    this.includeInPathCheckbox = document.createElement('input');
    this.includeInPathCheckbox.type = 'checkbox';
    this.includeInPathCheckbox.name = 'textFilterCheckbox';
    this.includeInPathCheckbox.value = 'includeInPath';

    includeProjectLabel.appendChild(this.includeInPathCheckbox);
    includeProjectLabel.appendChild(
      document.createTextNode('include projects in path')
    );

    this.container.appendChild(inputContainer);
    this.container.appendChild(includeProjectLabel);
  }
}
