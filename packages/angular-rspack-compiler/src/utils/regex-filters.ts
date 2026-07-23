export const TS_ALL_EXT_REGEX = /\.[cm]?tsx?(\?|$)/;
export const TS_EXT_REGEX = /\.[cm]?ts(\?|$)/;
export const TSX_EXT_REGEX = /\.tsx(\?|$)/;
export const JS_ALL_EXT_REGEX = /\.[cm]?jsx?(\?|$)/;
export const JS_EXT_REGEX = /\.[cm]?js$/;

export function isStandardJsFile(filename: string) {
  return JS_EXT_REGEX.test(filename);
}
