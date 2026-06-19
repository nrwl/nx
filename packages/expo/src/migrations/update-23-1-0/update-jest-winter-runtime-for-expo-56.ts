import { Tree, joinPathFragments, logger } from '@nx/devkit';
import { getExpoAppRoots } from './lib/expo-apps';

const WINTER_GLOBALS_BLOCK = `
// Expo SDK 55+ installs lazy winter-runtime globals (fetch, URL, etc.) that
// require files Jest treats as "outside of the scope of the test code" in a
// monorepo. Replace them with the runtime's own globals so the lazy getters
// never fire during tests.
const defineGlobal = (name, value) => {
  try {
    Object.defineProperty(global, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {}
};
defineGlobal('fetch', globalThis.fetch);
defineGlobal('Headers', globalThis.Headers);
defineGlobal('Request', globalThis.Request);
defineGlobal('Response', globalThis.Response);
defineGlobal('FormData', globalThis.FormData);
defineGlobal('URL', globalThis.URL);
defineGlobal('URLSearchParams', globalThis.URLSearchParams);
`;

/**
 * Expo SDK 56's winter runtime installs lazy globals that Jest rejects as
 * "outside of the scope of the test code" in a monorepo. Add the winter-globals
 * neutralization block to the generated test-setup files that mock
 * `ImportMetaRegistry` but don't yet have it.
 */
export default function update(tree: Tree) {
  for (const projectRoot of getExpoAppRoots(tree)) {
    for (const ext of ['ts', 'js']) {
      const setupPath = joinPathFragments(projectRoot, `src/test-setup.${ext}`);
      if (!tree.exists(setupPath)) {
        continue;
      }

      const content = tree.read(setupPath, 'utf-8');
      // Only update the generated winter-runtime setup, and only once.
      if (
        !content ||
        !content.includes('expo/src/winter/ImportMetaRegistry') ||
        content.includes('defineGlobal(')
      ) {
        continue;
      }

      const anchor = '}));\n';
      const idx = content.indexOf(anchor);
      const updated =
        idx === -1
          ? `${content}\n${WINTER_GLOBALS_BLOCK}`
          : content.slice(0, idx + anchor.length) +
            WINTER_GLOBALS_BLOCK +
            content.slice(idx + anchor.length);

      tree.write(setupPath, updated);
      logger.info(
        `Updated ${setupPath} for the Expo SDK 56 winter runtime in Jest.`
      );
    }
  }
}
