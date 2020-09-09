import { Popper } from 'cytoscape-popper';
import tippy, { Instance } from 'tippy.js';
import { hideAll } from 'tippy.js';

export class GraphTooltipService {
  open(ref: Popper.ReferenceObject, tooltipContent: HTMLElement): Instance {
    // unfortunately, a dummy element must be passed as tippy only accepts a dom element as the target
    // https://github.com/atomiks/tippyjs/issues/661
    let dummyDomEle = document.createElement('div');

    let tip = tippy(dummyDomEle, {
      trigger: 'manual', // call show() and hide() yourself
      lazy: false, // needed for onCreate()
      interactive: true,
      appendTo: document.body,
      onCreate: (instance) => {
        instance.popperInstance.reference = ref;
      }, // needed for `ref` positioning
      content: tooltipContent,
    });

    tip.show();

    return tip;
  }

  hideAll() {
    hideAll();
  }
}
