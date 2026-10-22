#### Add ids to Storybook Highlight payloads

Storybook 9.1.21 and 10.6.2 ignore a `HIGHLIGHT` payload that uses `selectors` without a string `id`. Storybook logs a warning in the browser console and draws nothing. Earlier versions drew the highlight and added a new one for every emit.

This migration adds an `id` to each object literal `HIGHLIGHT` payload without one. It finds the payloads in the JavaScript and TypeScript files of the workspace:

- Calls to `emit`, to an `emit` method such as `channel.emit`, or to an emitter returned by `useChannel`.
- The event passed as `HIGHLIGHT` imported from `storybook/highlight` under any name, through a namespace import, or as its string value `storybook/highlight/add`.

The id is the file path followed by a random suffix, such as `` `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}` ``. Every emit gets a new id, so each one adds its own highlight, as in earlier versions. Storybook builds the ids of legacy `elements` payloads the same way. To make a later emit replace the earlier highlight, change the id to a fixed string.

A payload whose `id` is always a non-empty string, such as `'headings'` or `` `row-${index}` ``, stays unchanged. So does a payload that uses the legacy `elements`.

The migration lists the Highlight usage it can't change, and in agentic runs an AI agent finishes it:

- Menu items that use `clickEvent` in a `HIGHLIGHT` payload. Storybook no longer emits that event. Menu items now use `clickable: true`, and a click emits `HIGHLIGHT_MENU_CLICK` with the highlight id, the menu item id and the click details.
- A payload whose menu items come from code the migration doesn't follow, such as a variable, a function call or a spread. Their `clickEvent` wasn't checked.
- Objects outside a payload that have `title` and a `clickEvent` that isn't a function. They may be menu items defined elsewhere, and only the ones that reach a payload's menu need changes.
- Code that uses the `ClickEventDetails` type. Its `element` no longer has `outerHTML` or `attributes`.
- Code that uses the `HighlightOptions` type, which now requires `id`.
- A payload whose `id` may not be a non-empty string, such as a variable, `undefined`, `''` or a number, or whose `id` can come from a spread or a computed key.
- A payload that isn't an object literal, such as a variable.
- A payload without an `id` in a scope where `Math` is a local binding, such as a parameter or an import named `Math`. The generated id calls `Math.random()`.
- A payload without an `id` under `satisfies` with a type other than `HighlightOptions`, or under a JSDoc `@satisfies` in a JavaScript file. That type may not allow the added `id`.
- `HIGHLIGHT` used outside an emit call, or passed to a function the migration doesn't recognize as an emit.
- A namespace import of `storybook/highlight` used other than to read one export by name, such as destructured, read with a computed key or exported.
- A payload passed through a spread argument.
- `storybook/highlight` loaded with `require`, a dynamic import or a re-export.
- Files the migration can't parse, and MDX, Svelte and Vue files that use `storybook/highlight`.

#### Sample code changes

##### Before

```ts title="apps/app/.storybook/preview.ts"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

export const decorators = [
  (storyFn) => {
    const emit = useChannel({});
    emit(HIGHLIGHT, { selectors: ['h2'] });
    return storyFn();
  },
];
```

##### After

```ts title="apps/app/.storybook/preview.ts"
import { useChannel } from 'storybook/preview-api';
import { HIGHLIGHT } from 'storybook/highlight';

export const decorators = [
  (storyFn) => {
    const emit = useChannel({});
    emit(HIGHLIGHT, {
      id: `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}`,
      selectors: ['h2'],
    });
    return storyFn();
  },
];
```

#### Reference

- [Storybook migration guide for Highlight menu items and ids](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id)
