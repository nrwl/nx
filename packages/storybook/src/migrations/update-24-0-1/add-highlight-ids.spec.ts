import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addHighlightIds from './add-highlight-ids';

const PREVIEW = `import { addons, useChannel } from 'storybook/preview-api';
import { HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';
import * as highlight from 'storybook/highlight';

const highlightCount = 'taken';
const base = { selectors: ['h1'] };

export const decorators = [
  (storyFn) => {
    const emitHighlight = useChannel({});
    emitHighlight(ADD_HIGHLIGHT, { selectors: ['h2'] });
    emitHighlight(ADD_HIGHLIGHT, { ...base, priority: 1 });
    emitHighlight(ADD_HIGHLIGHT, base);
    return storyFn();
  },
];

export async function highlightAll() {
  const channel = addons.getChannel();
  for (const selector of ['a', 'button']) {
    channel.emit(highlight.HIGHLIGHT, {
      // the selector under test
      selectors: [selector],
    });
  }
}
`;

const FALLBACKS = `import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

function withHighlightId(payload, id) {
  return id ? { ...payload, id } : payload;
}

const other = 'label';

export function highlight(selectors, id, options, key) {
  const emit = useChannel({});
  emit(HIGHLIGHT, { id, selectors });
  emit(HIGHLIGHT, { id: undefined, selectors });
  emit(HIGHLIGHT, { id: '', selectors });
  emit(HIGHLIGHT, { id: options.id, selectors });
  emit(HIGHLIGHT, { id: options.id ?? id, selectors });
  emit(HIGHLIGHT, { id: 'fixed', ...options, selectors });
  emit(HIGHLIGHT, { selectors, [key]: undefined });
  emit(HIGHLIGHT, { id: 'fixed', selectors, [key]: id });
  emit(HIGHLIGHT, { selectors, [other]: 'x' });
  emit(HIGHLIGHT, options);
  emit(HIGHLIGHT, withHighlightId(options, id));
}
`;

describe('add-highlight-ids migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should give each HIGHLIGHT payload without an id a counter-based id', async () => {
    tree.write('apps/app/.storybook/preview.ts', PREVIEW);
    tree.write(
      'libs/ui/src/highlight.js',
      `#!/usr/bin/env node
export function show(channel) {
  channel.emit('storybook/highlight/add', { selectors: ['p'] });
}
`
    );

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { addons, useChannel } from 'storybook/preview-api';
      import { HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';
      import * as highlight from 'storybook/highlight';

      let highlightCount2 = 0;

      function withHighlightId<T extends object | undefined>(payload: T, id: string) {
        const copy: { id?: unknown } = { ...payload };
        return { ...copy, id: copy.id || id } as T & { id: string };
      }

      const highlightCount = 'taken';
      const base = { selectors: ['h1'] };

      export const decorators = [
        (storyFn) => {
          const emitHighlight = useChannel({});
          emitHighlight(ADD_HIGHLIGHT, {
            id: \`apps/app/.storybook/preview.ts:\${++highlightCount2}\`,
            selectors: ['h2'],
          });
          emitHighlight(
            ADD_HIGHLIGHT,
            withHighlightId(
              { ...base, priority: 1 },
              \`apps/app/.storybook/preview.ts:\${++highlightCount2}\`,
            ),
          );
          emitHighlight(
            ADD_HIGHLIGHT,
            withHighlightId(base, \`apps/app/.storybook/preview.ts:\${++highlightCount2}\`),
          );
          return storyFn();
        },
      ];

      export async function highlightAll() {
        const channel = addons.getChannel();
        for (const selector of ['a', 'button']) {
          channel.emit(highlight.HIGHLIGHT, {
            id: \`apps/app/.storybook/preview.ts:\${++highlightCount2}\`,
            // the selector under test
            selectors: [selector],
          });
        }
      }
      "
      `);
    expect(tree.read('libs/ui/src/highlight.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "#!/usr/bin/env node
      let highlightCount = 0;

      export function show(channel) {
        channel.emit('storybook/highlight/add', {
          id: \`libs/ui/src/highlight.js:\${++highlightCount}\`,
          selectors: ['p'],
        });
      }
      "
    `);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should fall back to a generated id where the payload id can be missing or empty', async () => {
    tree.write('libs/ui/src/highlight.js', FALLBACKS);

    const result = await addHighlightIds(tree);

    expect(tree.read('libs/ui/src/highlight.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { useChannel } from 'storybook/preview-api';
      import { HIGHLIGHT } from 'storybook/highlight';

      let highlightCount = 0;

      function withHighlightId2(payload, id) {
        const copy = { ...payload };
        return { ...copy, id: copy.id || id };
      }

      function withHighlightId(payload, id) {
        return id ? { ...payload, id } : payload;
      }

      const other = 'label';

      export function highlight(selectors, id, options, key) {
        const emit = useChannel({});
        emit(HIGHLIGHT, { id: id || \`libs/ui/src/highlight.js:\${++highlightCount}\`, selectors });
        emit(
          HIGHLIGHT,
          withHighlightId2({ id: undefined, selectors }, \`libs/ui/src/highlight.js:\${++highlightCount}\`),
        );
        emit(
          HIGHLIGHT,
          withHighlightId2({ id: '', selectors }, \`libs/ui/src/highlight.js:\${++highlightCount}\`),
        );
        emit(HIGHLIGHT, { id: options.id || \`libs/ui/src/highlight.js:\${++highlightCount}\`, selectors });
        emit(HIGHLIGHT, {
          id: (options.id ?? id) || \`libs/ui/src/highlight.js:\${++highlightCount}\`,
          selectors,
        });
        emit(
          HIGHLIGHT,
          withHighlightId2(
            { id: 'fixed', ...options, selectors },
            \`libs/ui/src/highlight.js:\${++highlightCount}\`,
          ),
        );
        emit(
          HIGHLIGHT,
          withHighlightId2(
            { selectors, [key]: undefined },
            \`libs/ui/src/highlight.js:\${++highlightCount}\`,
          ),
        );
        emit(
          HIGHLIGHT,
          withHighlightId2(
            { id: 'fixed', selectors, [key]: id },
            \`libs/ui/src/highlight.js:\${++highlightCount}\`,
          ),
        );
        emit(
          HIGHLIGHT,
          withHighlightId2({ selectors, [other]: 'x' }, \`libs/ui/src/highlight.js:\${++highlightCount}\`),
        );
        emit(HIGHLIGHT, withHighlightId2(options, \`libs/ui/src/highlight.js:\${++highlightCount}\`));
        emit(
          HIGHLIGHT,
          withHighlightId2(withHighlightId(options, id), \`libs/ui/src/highlight.js:\${++highlightCount}\`),
        );
      }
      "
      `);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not change payloads that have an id, legacy payloads or listeners', async () => {
    const content = `import { addons, useChannel } from 'storybook/preview-api';
import { HIGHLIGHT, RESET_HIGHLIGHT } from 'storybook/highlight';

export const decorators = [
  (storyFn, { args }) => {
    const emit = useChannel({ [HIGHLIGHT]: () => {} });
    emit(HIGHLIGHT, { id: 'headings', selectors: ['h2'] });
    emit(HIGHLIGHT, { id: \`row-\${args.row}\`, selectors: ['tr'] });
    emit(HIGHLIGHT, { id: args.open ? 'open' : 'closed', selectors: ['p'] });
    emit(HIGHLIGHT, { ...args.highlight, id: args.id || 'custom' });
    emit(HIGHLIGHT, { [args.key]: undefined, id: 'late', selectors: ['h4'] });
    emit(HIGHLIGHT, { elements: ['h3'], color: 'red', style: 'solid' });
    emit(RESET_HIGHLIGHT);
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
    tree.write(
      'libs/other/src/config.ts',
      `export const tracking = { clickEvent: 'open' };\n`
    );

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8')).toBe(content);
    expect(tree.read('libs/ui/src/relay.ts', 'utf-8')).toBe(relay);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be a no-op when run twice', async () => {
    tree.write('apps/app/.storybook/preview.ts', PREVIEW);
    tree.write('libs/ui/src/highlight.js', FALLBACKS);
    await addHighlightIds(tree);
    const preview = tree.read('apps/app/.storybook/preview.ts', 'utf-8');
    const fallbacks = tree.read('libs/ui/src/highlight.js', 'utf-8');
    expect(preview).not.toBe(PREVIEW);
    expect(fallbacks).not.toBe(FALLBACKS);

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8')).toBe(preview);
    expect(tree.read('libs/ui/src/highlight.js', 'utf-8')).toBe(fallbacks);
    expect(result).toEqual({ skipAgentic: true });
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
      'id: `apps/app/src/menu.stories.ts:${++highlightCount}`'
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "agentContext": [
          "apps/app/src/menu.stories.ts:9 uses HIGHLIGHT outside an emit call, so the payloads emitted through it were not checked. Give each one a unique string "id".",
          "apps/app/src/menu.stories.ts:16 passes HIGHLIGHT to "send", which this migration doesn't recognize as an emit. If it emits the event, give the payload a unique string "id".",
          "apps/app/src/menu.stories.ts:17 passes the HIGHLIGHT payload through a spread argument, so it was not checked. Give it a unique string "id".",
          "apps/app/src/menu.stories.ts has Highlight menu items that use "clickEvent" (line 14), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/src/menu.stories.ts uses the HighlightOptions type, which now requires "id". Give each object of that type a unique string "id", or type it as Omit<HighlightOptions, 'id'> when this migration added the "id" where the object is emitted.",
          "apps/app/src/menu.stories.ts uses the ClickEventDetails type, whose "element" no longer has "outerHTML" or "attributes". Read "tagName", "localName" or the matching "selectors" instead.",
          "Could not parse apps/app/src/broken.stories.ts, so its HIGHLIGHT payloads and menu items were not checked. Give each HIGHLIGHT payload a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/src/intro.mdx uses "storybook/highlight" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/.storybook/preview.cjs:1 loads "storybook/highlight" in a way this migration doesn't read, such as a require, a dynamic import or a re-export. Give each HIGHLIGHT payload emitted through it a unique string "id".",
          "libs/menus/src/items.js has Highlight menu items that use "clickEvent" (line 1), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        ],
        "nextSteps": [
          "apps/app/src/menu.stories.ts:9 uses HIGHLIGHT outside an emit call, so the payloads emitted through it were not checked. Give each one a unique string "id".",
          "apps/app/src/menu.stories.ts:16 passes HIGHLIGHT to "send", which this migration doesn't recognize as an emit. If it emits the event, give the payload a unique string "id".",
          "apps/app/src/menu.stories.ts:17 passes the HIGHLIGHT payload through a spread argument, so it was not checked. Give it a unique string "id".",
          "apps/app/src/menu.stories.ts has Highlight menu items that use "clickEvent" (line 14), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/src/menu.stories.ts uses the HighlightOptions type, which now requires "id". Give each object of that type a unique string "id", or type it as Omit<HighlightOptions, 'id'> when this migration added the "id" where the object is emitted.",
          "apps/app/src/menu.stories.ts uses the ClickEventDetails type, whose "element" no longer has "outerHTML" or "attributes". Read "tagName", "localName" or the matching "selectors" instead.",
          "Could not parse apps/app/src/broken.stories.ts, so its HIGHLIGHT payloads and menu items were not checked. Give each HIGHLIGHT payload a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/src/intro.mdx uses "storybook/highlight" in a file this migration can't parse. Give each HIGHLIGHT payload it emits a unique string "id", and replace "clickEvent" in its menu items as described in https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
          "apps/app/.storybook/preview.cjs:1 loads "storybook/highlight" in a way this migration doesn't read, such as a require, a dynamic import or a re-export. Give each HIGHLIGHT payload emitted through it a unique string "id".",
          "libs/menus/src/items.js has Highlight menu items that use "clickEvent" (line 1), which Storybook no longer emits. Set "clickable: true" on them, give their HIGHLIGHT payload a fixed "id", and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK, which passes the highlight id, the menu item id and the click details. See https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id.",
        ],
      }
    `);
  });
});
