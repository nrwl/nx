#### Add ids to Storybook Highlight payloads

Storybook 9.1.21 and 10.6.2 ignore a `HIGHLIGHT` payload that uses `selectors` without a string `id`. Storybook logs a warning in the browser console and draws nothing. Earlier versions drew the highlight and added a new one for every emit.

This migration adds an `id` to each `HIGHLIGHT` payload without one. It finds the payloads in the JavaScript and TypeScript files of the workspace:

- Calls to `emit`, to an `emit` method such as `channel.emit`, or to an emitter returned by `useChannel`.
- The event passed as `HIGHLIGHT` imported from `storybook/highlight` under any name, through a namespace import, or as its string value `storybook/highlight/add`.

The id combines the file path with a counter that increases on every emit. Repeated emits still add separate highlights until Storybook clears them for the next story render.

When a payload already sets an `id`, the generated id is only a fallback:

- An `id` that is always a non-empty string, such as `'headings'` or `` `row-${index}` ``, stays unchanged.
- An `id` set to `undefined`, `null` or an empty string is replaced.
- Any other `id` becomes `id: <value> || <generated id>`.
- A payload that isn't an object literal, or that spreads another object after its `id`, is wrapped in a `withHighlightId(payload, id)` function declared in the file. It keeps the payload's own `id` unless that id is missing or empty.

Legacy payloads that use `elements` stay unchanged.

The migration lists the Highlight usage it can't change, and in agentic runs an AI agent finishes it:

- Menu items that use `clickEvent`. Storybook no longer emits that event. Menu items now use `clickable: true`, and a click emits `HIGHLIGHT_MENU_CLICK` with the highlight id, the menu item id and the click details.
- Code that uses the `ClickEventDetails` type. Its `element` no longer has `outerHTML` or `attributes`.
- Code that uses the `HighlightOptions` type, which now requires `id`.
- `HIGHLIGHT` used outside an emit call, or passed to a function the migration doesn't recognize as an emit.
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

let highlightCount = 0;

export const decorators = [
  (storyFn) => {
    const emit = useChannel({});
    emit(HIGHLIGHT, {
      id: `apps/app/.storybook/preview.ts:${++highlightCount}`,
      selectors: ['h2'],
    });
    return storyFn();
  },
];
```

#### Reference

- [Storybook migration guide for Highlight menu items and ids](https://github.com/storybookjs/storybook/blob/v10.6.2/MIGRATION.md#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id)
