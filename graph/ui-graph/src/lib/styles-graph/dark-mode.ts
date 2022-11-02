import { SingularData, Core } from 'cytoscape';

export const darkModeScratchKey = 'NX_GRAPH_DARK_MODE';

export function scratchHasDarkMode(element: SingularData | Core) {
  return element.scratch(darkModeScratchKey) === true;
}

export function switchValueByDarkMode<T>(
  element: SingularData | Core,
  dark: T,
  light: T
) {
  return scratchHasDarkMode(element) ? dark : light;
}
