// Compile this with `npx esbuild nx-dev/tutorial/src/code-block-button/js-module.ts --minify`

(function () {
  /**
   * Handles clicks on a single copy button.
   */
  async function clickHandler(event: Event) {
    /*
     * Attempt to perform the copy operation, first using the Clipboard API,
     * and then falling back to a DOM-based approach
     */
    const button = event.currentTarget as HTMLButtonElement;
    const dataset = button.dataset as {
      code: string;
      copied: string;
      filepath: string;
    };
    const code = dataset.code?.replace(/\u007f/g, '\n');
    const filepath = dataset.filepath;

    button.dispatchEvent(
      new CustomEvent('tutorialkit:[BUTTON_NAME]', {
        detail: { code, filepath },
        bubbles: true,
      })
    );

    // Exit if the copy operation failed or there is already a tooltip present
    if (button.parentNode?.querySelector('.feedback')) {
      return;
    }

    // Show feedback tooltip
    let tooltip: HTMLDivElement | undefined = document.createElement('div');
    tooltip.classList.add('feedback');
    tooltip.append(dataset.copied);
    button.before(tooltip);

    /*
     * Use offsetWidth and requestAnimationFrame to opt out of DOM batching,
     * which helps to ensure that the transition on 'show' works
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tooltip.offsetWidth;
    requestAnimationFrame(() => tooltip?.classList.add('show'));

    // Hide & remove the tooltip again when we no longer need it
    const hideTooltip = () => !tooltip || tooltip.classList.remove('show');
    const removeTooltip = () => {
      if (!(!tooltip || parseFloat(getComputedStyle(tooltip).opacity) > 0)) {
        tooltip.remove();
        tooltip = undefined;
      }
    };
    setTimeout(hideTooltip, 1500);
    setTimeout(removeTooltip, 2500);
    button.addEventListener('blur', hideTooltip);
    tooltip.addEventListener('transitioncancel', removeTooltip);
    tooltip.addEventListener('transitionend', removeTooltip);
  }

  const SELECTOR = '[SELECTOR]';

  /**
   * Searches a node for matching buttons and initializes them
   * unless the node does not support querySelectorAll (e.g. a text node).
   */
  function initButtons(container: ParentNode | Document) {
    container
      .querySelectorAll?.(SELECTOR)
      .forEach((btn) => btn.addEventListener('click', clickHandler));
  }

  // Use the function to initialize all buttons that exist right now
  initButtons(document);

  // Register a MutationObserver to initialize any new buttons added later
  const newButtonsObserver = new MutationObserver((mutations) =>
    mutations.forEach((mutation) =>
      mutation.addedNodes.forEach((node) => {
        initButtons(node as ParentNode);
      })
    )
  );
  newButtonsObserver.observe(document.body, { childList: true, subtree: true });

  // Also re-initialize all buttons after view transitions initiated by popular frameworks
  document.addEventListener('astro:page-load', () => {
    initButtons(document);
  });
})();
