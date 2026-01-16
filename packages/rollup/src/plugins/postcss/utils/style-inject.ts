/**
 * Inlined style-inject module
 * Original: https://github.com/nicolo-ribaudo/style-inject
 *
 * This module is used at runtime to inject CSS into the DOM when
 * the `inject` option is enabled and `extract` is disabled.
 */

/**
 * The style-inject runtime code that gets injected into the bundle
 * This is the ES module version that will be imported at runtime
 */
export const styleInjectCode = `
function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;

  if (typeof document === 'undefined') {
    return;
  }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

export { styleInject };
export default styleInject;
`.trim();

/**
 * Virtual module ID for style-inject
 */
export const STYLE_INJECT_ID = '\0style-inject';

/**
 * Path that will be used in imports
 */
export const STYLE_INJECT_PATH = 'style-inject';
