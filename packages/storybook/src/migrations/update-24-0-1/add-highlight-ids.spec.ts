import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addHighlightIds from './add-highlight-ids';

const PREVIEW = `import { addons, useChannel } from 'storybook/preview-api';
import { HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';
import * as highlight from 'storybook/highlight';

export const decorators = [
  (storyFn) => {
    const emitHighlight = useChannel({});
    emitHighlight(ADD_HIGHLIGHT, { selectors: ['h2'] });
    return storyFn();
  },
];

export async function highlightLinks() {
  const channel = addons.getChannel();
  channel.emit(highlight.HIGHLIGHT, {
    // the selector under test
    selectors: ['a'],
  });
}
`;

describe('add-highlight-ids migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should give each HIGHLIGHT payload without an id a generated id', async () => {
    tree.write('apps/app/.storybook/preview.ts', PREVIEW);

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { addons, useChannel } from 'storybook/preview-api';
      import { HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';
      import * as highlight from 'storybook/highlight';

      export const decorators = [
        (storyFn) => {
          const emitHighlight = useChannel({});
          emitHighlight(ADD_HIGHLIGHT, {
            id: \`apps/app/.storybook/preview.ts-\${Math.random().toString(36).slice(2)}\`,
            selectors: ['h2'],
          });
          return storyFn();
        },
      ];

      export async function highlightLinks() {
        const channel = addons.getChannel();
        channel.emit(highlight.HIGHLIGHT, {
          id: \`apps/app/.storybook/preview.ts-\${Math.random().toString(36).slice(2)}\`,
          // the selector under test
          selectors: ['a'],
        });
      }
      "
    `);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should give a call a different id each time it emits', async () => {
    // The path must stay literal inside the generated template literal.
    const filePath = 'libs/ui/src/`odd ${dir}`/highlight.js';
    tree.write(
      filePath,
      `module.exports = function highlightAll(channel) {
  for (const selector of ['a', 'button']) {
    channel.emit('storybook/highlight/add', { selectors: [selector] });
  }
};
`
    );

    await addHighlightIds(tree);

    const cjsModule = { exports: undefined };
    new Function('module', tree.read(filePath, 'utf-8'))(cjsModule);
    const ids: string[] = [];
    cjsModule.exports({ emit: (_event, payload) => ids.push(payload.id) });
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) {
      expect(id.startsWith(`${filePath}-`)).toBe(true);
    }
  });

  it('should report payloads where Math is a local binding', async () => {
    tree.write(
      'libs/ui/src/highlight.js',
      `export function shadowed(channel, Math) {
  channel.emit('storybook/highlight/add', { selectors: ['p'] });
}

export function unshadowed(channel) {
  channel.emit('storybook/highlight/add', { selectors: ['a'] });
}
`
    );
    // The import is erased at runtime, but TypeScript rejects Math.random() here.
    const typeOnlyImport = `import type * as Math from './math';
import { HIGHLIGHT } from 'storybook/highlight';

export const highlight = (emit) => emit(HIGHLIGHT, { selectors: ['h2'] });
`;
    tree.write('apps/app/.storybook/type-only.ts', typeOnlyImport);

    const result = await addHighlightIds(tree);

    expect(tree.read('libs/ui/src/highlight.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export function shadowed(channel, Math) {
        channel.emit('storybook/highlight/add', { selectors: ['p'] });
      }

      export function unshadowed(channel) {
        channel.emit('storybook/highlight/add', {
          id: \`libs/ui/src/highlight.js-\${Math.random().toString(36).slice(2)}\`,
          selectors: ['a'],
        });
      }
      "
    `);
    expect(tree.read('apps/app/.storybook/type-only.ts', 'utf-8')).toBe(
      typeOnlyImport
    );
    expect(result.agentContext).toMatchInlineSnapshot(`
      [
        "libs/ui/src/highlight.js:2 emits a HIGHLIGHT payload where "Math" is a local binding, so the generated id, which calls Math.random(), was not added. Give it a unique string "id".",
        "apps/app/.storybook/type-only.ts:4 emits a HIGHLIGHT payload where "Math" is a local binding, so the generated id, which calls Math.random(), was not added. Give it a unique string "id".",
      ]
    `);
  });

  it('should not change payloads with a string id, legacy payloads or listeners', async () => {
    const content = `import { addons, useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

export const decorators = [
  (storyFn, { args }) => {
    const emit = useChannel({ [HIGHLIGHT]: () => {} });
    emit(HIGHLIGHT, { id: 'headings', selectors: ['h2'] });
    emit(HIGHLIGHT, { id: \`row-\${args.row}\`, selectors: ['tr'] });
    emit(HIGHLIGHT, { elements: ['h3'], color: 'red', style: 'solid' });
    addons.getChannel().on(HIGHLIGHT, (options) => console.log(options));
    return storyFn();
  },
];
`;
    tree.write('apps/app/.storybook/preview.ts', content);
    const relay = `import { HIGHLIGHT as event } from 'storybook/highlight';

export function relay(channel, event, payload) {
  channel.emit(event, payload);
}
`;
    tree.write('libs/ui/src/relay.ts', relay);

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8')).toBe(content);
    expect(tree.read('libs/ui/src/relay.ts', 'utf-8')).toBe(relay);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should report payloads whose id may not be a non-empty string', async () => {
    const content = `import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

export function highlight(selectors, id, options, key) {
  const emit = useChannel({});
  emit(HIGHLIGHT, { id, selectors });
  emit(HIGHLIGHT, { id: options.id, selectors });
  emit(HIGHLIGHT, { id: undefined, selectors });
  emit(HIGHLIGHT, { id: '', selectors });
  emit(HIGHLIGHT, { id: \`\${id}\`, selectors });
  emit(HIGHLIGHT, { id: 2, selectors });
  emit(HIGHLIGHT, { id: 'fixed', ...options, selectors });
  emit(HIGHLIGHT, { id: 'fixed', selectors, [key]: id });
  emit(HIGHLIGHT, options);
}
`;
    tree.write('libs/ui/src/highlight.js', content);

    const result = await addHighlightIds(tree);

    expect(tree.read('libs/ui/src/highlight.js', 'utf-8')).toBe(content);
    const menuNote = (line: number) =>
      `libs/ui/src/highlight.js:${line} emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.`;
    const idNote = (line: number) =>
      `libs/ui/src/highlight.js:${line} emits a HIGHLIGHT payload whose "id" may not be a non-empty string, so it was not changed. Make sure it has a unique, non-empty string "id".`;
    const notes = [
      ...[6, 7, 8, 9, 10, 11].map(idNote),
      menuNote(12),
      idNote(12),
      menuNote(13),
      idNote(13),
      `libs/ui/src/highlight.js:14 emits a HIGHLIGHT payload that isn't an object literal, so it was not checked. Make sure it has a unique string "id".`,
    ];
    expect(result).toEqual({ nextSteps: notes, agentContext: notes });
  });

  it('should be a no-op when run twice', async () => {
    tree.write('apps/app/.storybook/preview.ts', PREVIEW);
    await addHighlightIds(tree);
    const preview = tree.read('apps/app/.storybook/preview.ts', 'utf-8');
    expect(preview).not.toBe(PREVIEW);

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8')).toBe(preview);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should report clickEvent menu items by whether they reach a HIGHLIGHT payload', async () => {
    const content = `import { HIGHLIGHT } from 'storybook/highlight';

const save = { title: 'Save', clickEvent: 'save-clicked' };
const tracking = { clickEvent: 'track' };
const run = { title: 'Run', clickEvent: () => 'ran' };
const item = { id: 'details', title: 'Show details' };
item.clickEvent = 'my-addon/show-details';

export function highlight(channel, base, options, key) {
  channel.emit(HIGHLIGHT, { id: 'open', selectors: ['h1'], menu: [[{ id: 'open', title: 'Open', clickEvent: 'my-addon/open' }]] });
  channel.emit(HIGHLIGHT, { id: 'details', selectors: ['h2'], menu: [[item, { id: 'close', clickEvent: 'my-addon/close' }]] });
  channel.emit(HIGHLIGHT, { id: 'more', selectors: ['h3'], menu: [[{ ...base, title: 'More' }]] });
  channel.emit(HIGHLIGHT, { ...options, id: 'custom' });
  channel.emit(HIGHLIGHT, { [key]: undefined, id: 'late', selectors: ['h4'] });
}
`;
    tree.write('libs/ui/src/highlight.js', content);

    const result = await addHighlightIds(tree);

    expect(tree.read('libs/ui/src/highlight.js', 'utf-8')).toBe(content);
    expect(result.agentContext).toMatchInlineSnapshot(`
      [
        "libs/ui/src/highlight.js:11 emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "libs/ui/src/highlight.js:12 emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "libs/ui/src/highlight.js:13 emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "libs/ui/src/highlight.js:14 emits a HIGHLIGHT payload whose menu items come from code this migration doesn't follow, so they were not checked for "clickEvent". Follow the menu to its items and replace "clickEvent" on any that use it, as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "libs/ui/src/highlight.js has Highlight menu items that use "clickEvent" (lines 10, 11), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "libs/ui/src/highlight.js has objects with "title" and "clickEvent" (line 3) that may be Highlight menu items. Change only the ones that reach the menu of a HIGHLIGHT payload: set "clickable: true", give that payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK. Leave the others unchanged. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
      ]
    `);
  });

  it('should report the Highlight usage it cannot migrate', async () => {
    tree.write(
      'apps/app/src/menu.stories.ts',
      `import { addons } from 'storybook/preview-api';
import {
  HIGHLIGHT,
  type ClickEventDetails,
  type HighlightOptions,
} from 'storybook/highlight';

const channel = addons.getChannel();
const EVENTS = { add: HIGHLIGHT };

export const play = async (send, args) => {
  channel.emit(HIGHLIGHT, {
    selectors: ['button'],
    menu: [[{ id: 'open', title: 'Open', clickEvent: 'my-addon/open' }]],
  });
  send(HIGHLIGHT, { selectors: ['a'] });
  channel.emit(HIGHLIGHT, ...args);
};
`
    );
    tree.write(
      'libs/menus/src/items.js',
      `export const items = [{ id: 'more', title: 'More', clickEvent: 'my-addon/more' }];\n`
    );
    tree.write(
      'apps/app/src/broken.stories.ts',
      `import { HIGHLIGHT } from 'storybook/highlight';\nemit(HIGHLIGHT, {\n`
    );
    tree.write(
      'apps/app/.storybook/preview.cjs',
      `const { HIGHLIGHT } = require('storybook/highlight');\n`
    );
    tree.write(
      'apps/app/src/intro.mdx',
      `import { HIGHLIGHT } from 'storybook/highlight';\n`
    );

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/src/menu.stories.ts', 'utf-8')).toContain(
      'id: `apps/app/src/menu.stories.ts-${Math.random().toString(36).slice(2)}`'
    );
    expect(result.agentContext).toMatchInlineSnapshot(`
      [
        "apps/app/src/menu.stories.ts:9 uses HIGHLIGHT outside an emit call, so the payloads emitted through it were not checked. Give each one a unique string "id".",
        "apps/app/src/menu.stories.ts:16 passes HIGHLIGHT to "send", which this migration doesn't recognize as an emit. If it emits the event, give the payload a unique string "id".",
        "apps/app/src/menu.stories.ts:17 passes the HIGHLIGHT payload through a spread argument, so it was not checked. Give it a unique string "id".",
        "apps/app/src/menu.stories.ts has Highlight menu items that use "clickEvent" (line 14), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "apps/app/src/menu.stories.ts uses the HighlightOptions type, which now requires "id". Give each object of that type a unique string "id".",
        "apps/app/src/menu.stories.ts uses the ClickEventDetails type, whose "element" no longer has "outerHTML" or "attributes". Read "tagName", "localName" or the matching "selectors" instead.",
        "apps/app/src/broken.stories.ts uses "storybook/highlight" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "apps/app/src/intro.mdx uses "storybook/highlight" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        "apps/app/.storybook/preview.cjs:1 loads "storybook/highlight" in a way this migration doesn't read, such as a require, a dynamic import or a re-export. Give each HIGHLIGHT payload emitted through it a unique string "id".",
        "libs/menus/src/items.js has objects with "title" and "clickEvent" (line 1) that may be Highlight menu items. Change only the ones that reach the menu of a HIGHLIGHT payload: set "clickable: true", give that payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK. Leave the others unchanged. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
      ]
    `);
  });
});
