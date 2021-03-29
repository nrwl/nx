import * as cy from 'cytoscape';

export class ProjectNodeToolTip {
  constructor(private node: cy.NodeSingular) {}

  render() {
    const wrapper = document.createElement('div');
    const header = this.createHeader();
    const tags = this.createTags();
    const buttons = this.createButtons();

    wrapper.appendChild(header);
    wrapper.appendChild(tags);
    wrapper.appendChild(buttons);

    return wrapper;
  }

  private createHeader() {
    const header = document.createElement('h4');
    const typeLabel = document.createElement('span');
    const projectName = document.createTextNode(this.node.attr('id'));

    typeLabel.classList.add('tag');
    typeLabel.innerText = this.node.attr('type');

    header.appendChild(typeLabel);
    header.appendChild(projectName);

    return header;
  }

  private createTags() {
    const wrapper = document.createElement('p');
    const tagLabel = document.createElement('strong');
    const tags = document.createTextNode(
      this.node.attr('tags')?.join(', ') ?? ''
    );

    tagLabel.innerText = 'tags';

    wrapper.appendChild(tagLabel);
    wrapper.appendChild(document.createElement('br'));
    wrapper.appendChild(tags);

    return wrapper;
  }

  private createButtons() {
    const wrapper = document.createElement('div');
    const focusButton = document.createElement('button');
    const excludeButton = document.createElement('button');

    wrapper.classList.add('flex');

    focusButton.addEventListener('click', () =>
      window.focusProject(this.node.attr('id'))
    );
    focusButton.innerText = 'Focus';

    excludeButton.addEventListener('click', () => {
      window.excludeProject(this.node.attr('id'));
    });

    excludeButton.innerText = 'Exclude';

    wrapper.appendChild(focusButton);
    wrapper.appendChild(excludeButton);

    return wrapper;
  }
}
