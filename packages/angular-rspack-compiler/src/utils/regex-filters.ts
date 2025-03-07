export const TS_ALL_EXT_REGEX = /\.[cm]?(ts)[^x]?\??/;
export const JS_ALL_EXT_REGEX = /\.[cm]?(js)[^x]?\??/;
export const JS_EXT_REGEX = /\.[cm]?js$/;

export function isStandardJsFile(filename: string) {
  return JS_EXT_REGEX.test(filename);
}
