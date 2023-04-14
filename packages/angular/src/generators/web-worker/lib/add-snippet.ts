import type { Tree } from '@nx/devkit';
import { joinPathFragments, stripIndents } from '@nx/devkit';

export function addSnippet(tree: Tree, name: string, path: string) {
  const fileRegExp = new RegExp(`^${name}.*\\.ts`);

  const children = tree.children(path);
  const siblingModules = children
    .filter((f) => fileRegExp.test(f) && !/(module|spec)\.ts$/.test(f))
    .sort();

  if (siblingModules.length === 0) {
    return;
  }

  const siblingModulePath = joinPathFragments(path, siblingModules[0]);
  const logMessage = 'console.log(`page got message ${data}`);';
  const workerCreationSnippet = stripIndents`
      if (typeof Worker !== 'undefined') {
        // Create a new
        const worker = new Worker(new URL('./${name}.worker', import.meta.url));
        worker.onmessage = ({ data }) => {
          ${logMessage}
        };
        worker.postMessage('hello');
      } else {
        // Web Workers are not supported in this environment.
        // You should add a fallback so that your program still executes correctly.
      }
    `;

  const originalContent = tree.read(siblingModulePath, 'utf-8');
  tree.write(
    siblingModulePath,
    stripIndents`${originalContent}
  ${workerCreationSnippet}`
  );
}
