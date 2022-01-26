import { VirtualElement } from '@popperjs/core';
import tippy, { Instance, hideAll } from 'tippy.js';
import { selectStatically } from './theme-resolver';

export class GraphTooltipService {
  open(ref: VirtualElement, tooltipContent: HTMLElement): Instance {
    let instance = tippy(document.createElement('div'), {
      trigger: 'manual',
      theme: selectStatically('dark-nx', 'nx'),
      interactive: true,
      appendTo: document.body,
      content: tooltipContent,
      getReferenceClientRect: ref.getBoundingClientRect,
    });

    instance.show();

    return instance;
  }

  hideAll() {
    hideAll();
  }
}
