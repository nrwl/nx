/*
 * This plugin is a workaround to a known styled-jsx issue.
 *
 * See: https://github.com/vercel/styled-jsx/issues/695
 *
 * If the issue is fixed in the future, we should be able to remove this patch.
 */

function onPreRenderHTML(_, pluginOptions: any) {
  try {
    const _JSXStyle = require('styled-jsx/style').default;
    Object.assign(global, { _JSXStyle });
  } catch {
    // nothing
  }
}

export { onPreRenderHTML };
