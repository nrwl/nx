import { Subject } from 'rxjs';
import { GraphPerfReport } from './graph';
import { ProjectGraphList } from './models';
import { removeChildrenFromContainer } from './util';

export class DebuggerPanel {
  set renderTime(renderTime: GraphPerfReport) {
    this.renderReportElement.innerHTML = `Last render took ${renderTime.renderTime}ms: <b class="font-mono text-medium">${renderTime.numNodes} nodes</b> | <b class="font-mono text-medium">${renderTime.numEdges} edges</b>.`;
  }

  private selectProjectSubject = new Subject<string>();

  selectProject$ = this.selectProjectSubject.asObservable();

  private renderReportElement: HTMLElement;

  constructor(
    private container: HTMLElement,
    private projectGraphs: ProjectGraphList[],
    private initialSelectedGraph: string
  ) {
    this.render();
  }

  private render() {
    removeChildrenFromContainer(this.container);

    const header = document.createElement('h4');
    header.className = 'text-lg font-bold mr-4';
    header.innerText = `Debugger`;

    const select = document.createElement('select');
    select.className =
      'w-auto flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white';

    this.projectGraphs.forEach((projectGraph) => {
      const option = document.createElement('option');
      option.value = projectGraph.id;
      option.innerText = projectGraph.label;

      select.appendChild(option);
    });

    select.value = this.initialSelectedGraph;
    select.dataset['cy'] = 'project-select';

    select.onchange = (event) =>
      this.selectProjectSubject.next(
        (event.currentTarget as HTMLSelectElement).value
      );

    this.renderReportElement = document.createElement('p');
    this.renderReportElement.className = 'text-sm';

    this.container.appendChild(header);
    this.container.appendChild(select);
    this.container.appendChild(this.renderReportElement);
  }
}
