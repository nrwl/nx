import { updateJson } from './file-utils';

export function configureTargetOptions(
  targetNames: string[],
  options: Record<string, unknown>
): () => void {
  const originalTargetDefaults: Record<string, unknown> = {};
  let hadTargetDefaults = false;

  updateJson('nx.json', (nxJson) => {
    hadTargetDefaults = Boolean(nxJson.targetDefaults);
    nxJson.targetDefaults ??= {};

    for (const targetName of targetNames) {
      const defaults = nxJson.targetDefaults[targetName];
      if (defaults !== undefined) {
        originalTargetDefaults[targetName] = defaults;
      }
      nxJson.targetDefaults[targetName] = Array.isArray(defaults)
        ? [...defaults, { options }]
        : { ...defaults, options: { ...defaults?.options, ...options } };
    }

    return nxJson;
  });

  return () => {
    updateJson('nx.json', (nxJson) => {
      for (const targetName of targetNames) {
        const previousValue = originalTargetDefaults[targetName];
        if (previousValue === undefined) {
          delete nxJson.targetDefaults[targetName];
        } else {
          nxJson.targetDefaults[targetName] = previousValue;
        }
      }
      if (
        !hadTargetDefaults &&
        nxJson.targetDefaults &&
        !Object.keys(nxJson.targetDefaults).length
      ) {
        delete nxJson.targetDefaults;
      }

      return nxJson;
    });
  };
}
