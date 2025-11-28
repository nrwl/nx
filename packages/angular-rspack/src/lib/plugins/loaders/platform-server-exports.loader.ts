import {
  type LoaderContext,
  type LoaderDefinitionFunction,
} from '@rspack/core';

export default function loader(
  this: LoaderContext<{
    angularSSRInstalled: boolean;
    isZoneJsInstalled: boolean;
  }>,
  content: string,
  map: Parameters<LoaderDefinitionFunction>[1]
) {
  const { angularSSRInstalled, isZoneJsInstalled } = this.getOptions();

  let source = `${content}

  // EXPORTS added by @nx/angular-rspack
  export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';
  `;

  if (angularSSRInstalled) {
    source += `
      export { ɵgetRoutesFromAngularRouterConfig } from '@angular/ssr';
    `;
  }

  if (isZoneJsInstalled) {
    source = `import 'zone.js/node';
    ${source}`;
  }

  this.callback(null, source, map);

  return;
}
