import { Subject } from 'rxjs';
import { ProjectGraphList } from '../graphs';
import { GraphPerfReport } from './graph';
import { removeChildrenFromContainer } from './util';

export class DebuggerPanel {
  set renderTime(renderTime: GraphPerfReport) {
    this.renderReportElement.innerText = `Last render took ${renderTime.renderTime} milliseconds for ${renderTime.numNodes} nodes and ${renderTime.numEdges} edges.`;
  }

  private selectProjectSubject = new Subject<string>();

  selectProject$ = this.selectProjectSubject.asObservable();

  private renderReportElement: HTMLElement;

  constructor(
    private container: HTMLElement,
    private projectGraphs: ProjectGraphList[]
  ) {
    this.render();
  }

  private render() {
    removeChildrenFromContainer(this.container);

    const header = document.createElement('h4');
    header.innerText = `Debugger`;

    const select = document.createElement('select');

    this.projectGraphs.forEach((projectGraph) => {
      const option = document.createElement('option');
      option.value = projectGraph.id;
      option.innerText = projectGraph.label;

      select.appendChild(option);
    });

    select.value = window.selectedProjectGraph;
    select.dataset['cy'] = 'project-select';

    select.onchange = (event) =>
      this.selectProjectSubject.next(
        (event.currentTarget as HTMLSelectElement).value
      );

    this.renderReportElement = document.createElement('p');

    this.container.appendChild(header);
    this.container.appendChild(select);
    this.container.appendChild(this.renderReportElement);
  }
}
