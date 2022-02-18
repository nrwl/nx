import { VirtualElement } from '@popperjs/core';
import tippy, { Instance, hideAll } from 'tippy.js';
import * as ReactDOM from 'react-dom';
import { selectValueByThemeStatic } from './theme-resolver';

export class GraphTooltipService {
  open(ref: VirtualElement, tooltipContent: JSX.Element): Instance {
    const tempDiv = document.createElement('div');

    ReactDOM.render(tooltipContent, tempDiv);

    let instance = tippy(document.createElement('div'), {
      trigger: 'manual',
      theme: selectValueByThemeStatic('dark-nx', 'nx'),
      interactive: true,
      appendTo: document.body,
      content: tempDiv,
      getReferenceClientRect: ref.getBoundingClientRect,
      maxWidth: 'none',
    });

    instance.show();

    return instance;
  }

  hideAll() {
    hideAll();
  }
}
