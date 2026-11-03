import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addHighlightIds from './add-highlight-ids';

const DOCS =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id';
const highlightNote = (filePath: string) =>
  `${filePath} uses "storybook/highlight". Make sure each HIGHLIGHT payload with "selectors" has a unique string "id", that menu items use "clickable" instead of "clickEvent", and that code reading click details doesn't use "outerHTML" or "attributes". See ${DOCS}.`;
const clickEventNote = (filePath: string) =>
  `${filePath} uses "clickEvent". If it defines Highlight menu items, set "clickable: true" on them and move the "clickEvent" listener to HIGHLIGHT_MENU_CLICK. See ${DOCS}.`;

describe('add-highlight-ids migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should give payloads emitted through a useChannel emitter a generated id', async () => {
    tree.write(
      'apps/app/.storybook/preview.ts',
      `import { useChannel as useStorybookChannel } from 'storybook/preview-api';
import { HIGHLIGHT, HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';

export const decorators = [
  (storyFn) => {
    const emit = useStorybookChannel({});
    emit(HIGHLIGHT, { selectors: ['h2'] });
    emit(ADD_HIGHLIGHT, { // the selector under test
      selectors: ['a'] });
    emit('storybook/highlight/add', { selectors: ['p'], menu: [] });
    return storyFn();
  },
];
`
    );

    const result = await addHighlightIds(tree);

    expect(tree.read('apps/app/.storybook/preview.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { useChannel as useStorybookChannel } from 'storybook/preview-api';
      import { HIGHLIGHT, HIGHLIGHT as ADD_HIGHLIGHT } from 'storybook/highlight';

      export const decorators = [
        (storyFn) => {
          const emit = useStorybookChannel({});
          emit(HIGHLIGHT, {
            id: \`apps/app/.storybook/preview.ts-\${Math.random().toString(36).slice(2)}\`,
            selectors: ['h2'],
          });
          emit(ADD_HIGHLIGHT, {
            id: \`apps/app/.storybook/preview.ts-\${Math.random().toString(36).slice(2)}\`, // the selector under test
            selectors: ['a'],
          });
          emit('storybook/highlight/add', {
            id: \`apps/app/.storybook/preview.ts-\${Math.random().toString(36).slice(2)}\`,
            selectors: ['p'],
            menu: [],
          });
          return storyFn();
        },
      ];
      "
    `);
    expect(result).toEqual({
      nextSteps: [highlightNote('apps/app/.storybook/preview.ts')],
      agentContext: [highlightNote('apps/app/.storybook/preview.ts')],
    });
  });

  it('should give a call a different id each time it emits', async () => {
    // The path must stay literal inside the generated template literal.
    const filePath = 'libs/ui/src/`odd ${dir}`/highlight.js';
    tree.write(
      filePath,
      `import { useChannel } from 'storybook/preview-api';

export function highlightAll() {
  const emit = useChannel({});
  for (const selector of ['a', 'button']) {
    emit('storybook/highlight/add', { selectors: [selector] });
  }
}
`
    );

    await addHighlightIds(tree);

    const body = tree
      .read(filePath, 'utf-8')
      .replace(/^import .*$/m, '')
      .replace('export ', '');
    const ids: string[] = [];
    new Function('useChannel', `${body}\nreturn highlightAll;`)(
      () => (_event, payload) => ids.push(payload.id)
    )();
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) {
      expect(id.startsWith(`${filePath}-`)).toBe(true);
    }
  });

  it('should leave payloads unchanged unless an id can be added safely', async () => {
    const emitters = `import { addons, useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

type Payload = { selectors: string[] };
type Emit = (event: string, payload: Payload) => void;

export function decorator(options: { key: string }) {
  const emit = useChannel({});
  const typedEmit: Emit = useChannel({});
  const castEmit = useChannel({}) as Emit;
  const payload = { selectors: ['a'] };

  addons.getChannel().emit(HIGHLIGHT, { selectors: ['b'] });
  typedEmit(HIGHLIGHT, { selectors: ['c'] });
  castEmit(HIGHLIGHT, { selectors: ['d'] });
  emit(HIGHLIGHT, payload);
  emit(HIGHLIGHT, { selectors: ['e'] } satisfies Payload);
  emit(HIGHLIGHT, { id: 'fixed', selectors: ['f'] });
  emit(HIGHLIGHT, { ...payload });
  emit(HIGHLIGHT, { [options.key]: ['g'] });
  emit(HIGHLIGHT, { elements: ['h'] });
  emit('my-addon/highlight', { selectors: ['m'] });
}

export function typedParameter(emit: Emit) {
  emit(HIGHLIGHT, { selectors: ['i'] });
}

export function localEvent(HIGHLIGHT: string) {
  const emit = useChannel({});
  emit(HIGHLIGHT, { selectors: ['j'] });
}

export function localMath(Math: unknown) {
  const emit = useChannel({});
  emit(HIGHLIGHT, { selectors: ['k'] });
}

export function localHook(useChannel: () => Emit) {
  const emit = useChannel();
  emit(HIGHLIGHT, { selectors: ['l'] });
}
`;
    const jsDoc = `import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

/** @type {(event: string, payload: { selectors: string[] }) => void} */
const emit = useChannel({});

export function highlightHeadings() {
  emit(HIGHLIGHT, { selectors: ['h2'] });
}
`;
    const mathImport = `import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';
import * as Math from './math';

export function highlightHeadings() {
  const emit = useChannel({});
  emit(HIGHLIGHT, { selectors: ['h2'] });
}
`;
    const broken = `import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

const emit = useChannel({});
emit(HIGHLIGHT, { selectors: ['h2'] });

export const Broken = {
`;
    tree.write('libs/ui/src/emitters.ts', emitters);
    tree.write('libs/ui/src/jsdoc.js', jsDoc);
    tree.write('libs/ui/src/math-import.ts', mathImport);
    tree.write('libs/ui/src/broken.stories.ts', broken);

    const result = await addHighlightIds(tree);

    expect(tree.read('libs/ui/src/emitters.ts', 'utf-8')).toBe(emitters);
    expect(tree.read('libs/ui/src/jsdoc.js', 'utf-8')).toBe(jsDoc);
    expect(tree.read('libs/ui/src/math-import.ts', 'utf-8')).toBe(mathImport);
    expect(tree.read('libs/ui/src/broken.stories.ts', 'utf-8')).toBe(broken);
    expect(result).toEqual({
      nextSteps: expect.any(Array),
      agentContext: [
        highlightNote('libs/ui/src/emitters.ts'),
        highlightNote('libs/ui/src/jsdoc.js'),
        highlightNote('libs/ui/src/math-import.ts'),
        highlightNote('libs/ui/src/broken.stories.ts'),
      ],
    });
  });

  it('should list every file that uses storybook/highlight or clickEvent', async () => {
    tree.write(
      'apps/app/.storybook/preview.cjs',
      `const { HIGHLIGHT } = require('storybook/highlight');

module.exports = { HIGHLIGHT };
`
    );
    tree.write(
      'apps/app/src/intro.mdx',
      `import { HIGHLIGHT } from 'storybook/highlight';
`
    );
    tree.write(
      'libs/menus/src/items.js',
      `export const items = [{ id: 'save', title: 'Save', clickEvent: 'save' }];
`
    );

    const result = await addHighlightIds(tree);

    expect(result).toEqual({
      nextSteps: expect.any(Array),
      agentContext: [
        highlightNote('apps/app/.storybook/preview.cjs'),
        highlightNote('apps/app/src/intro.mdx'),
        clickEventNote('libs/menus/src/items.js'),
      ],
    });
  });

  it('should skip the prompt when no source file uses Highlight', async () => {
    tree.write(
      'apps/app/src/button.stories.ts',
      `export default { title: 'Button' };
`
    );
    tree.write(
      'docs/highlight.md',
      `Emit \`HIGHLIGHT\` from \`storybook/highlight\` and replace \`clickEvent\`.
`
    );

    expect(await addHighlightIds(tree)).toEqual({ skipAgentic: true });
  });
});
