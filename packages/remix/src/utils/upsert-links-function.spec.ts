import { stripIndents } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { upsertLinksFunction } from './upsert-links-function';

describe('upsertLinksFunctions', () => {
  it('should add the imports and the link function when it does not exist', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(`root.tsx`, ``);

    // ACT
    upsertLinksFunction(
      tree,
      'root.tsx',
      'styles',
      './tailwind.css',
      '{ rel: "stylesheet", href: styles }'
    );

    // ASSERT
    expect(tree.read('root.tsx', 'utf-8')).toMatchInlineSnapshot(`
      "import type { LinksFunction } from '@remix-run/node';
      import styles from "./tailwind.css";
      export const links: LinksFunction = () => [
      { rel: "stylesheet", href: styles },
      ];"
    `);
  });

  it('should update an existing links function with the new object', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `root.tsx`,
      stripIndents`import type { LinksFunction } from '@remix-run/node';

    export const links: LinksFunction = () => [
      { rel: "icon", href: "/favicon.png" type: "image/png" }
    `
    );

    // ACT
    upsertLinksFunction(
      tree,
      'root.tsx',
      'styles',
      './tailwind.css',
      '{ rel: "stylesheet", href: styles }'
    );

    // ASSERT
    expect(tree.read('root.tsx', 'utf-8')).toMatchInlineSnapshot(`
      "import type { LinksFunction } from '@remix-run/node';
      import styles from "./tailwind.css";

      export const links: LinksFunction = () => [
      { rel: "stylesheet", href: styles },
      { rel: "icon", href: "/favicon.png" type: "image/png" }"
    `);
  });
});
