#### Add ids to Storybook Highlight payloads

Storybook 9.1.21 and 10.6.2 ignore a `HIGHLIGHT` payload that uses `selectors` without a string `id`. Storybook logs a warning in the browser console and draws nothing. Earlier versions drew the highlight and added a new one for every emit.

This migration adds an `id` to the payloads it can change without breaking a type check. These are object literals without an `id`, emitted through an emitter returned by `useChannel` from `storybook/preview-api`, as in the Storybook docs. Storybook types that emitter's payload as `any`. The event can be `HIGHLIGHT` imported from `storybook/highlight` under any name, or its string value `storybook/highlight/add`.

The id is the file path followed by a random suffix, such as `` `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}` ``. Every emit gets a new id, so each one adds its own highlight, as in earlier versions. Storybook builds the ids of legacy `elements` payloads the same way. To make a later emit replace the earlier highlight, change the id to a fixed string.

The migration then lists every file that uses `storybook/highlight` or `clickEvent`, including the files it changed. In agentic runs, an AI agent finishes the Highlight changes in those files:

- It gives an `id` to the other payloads, such as payloads emitted through `addons.getChannel()`, through a typed emitter or from a variable.
- It replaces `clickEvent` in menu items with `clickable: true`. A click now emits `HIGHLIGHT_MENU_CLICK` with the highlight id, the menu item id and the click details, so the agent moves the `clickEvent` listener to that event.
- It replaces reads of `outerHTML` and `attributes` on the `element` of the click details, which no longer has them.
- It adds an `id` to objects typed `HighlightOptions`, which now requires one.

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
