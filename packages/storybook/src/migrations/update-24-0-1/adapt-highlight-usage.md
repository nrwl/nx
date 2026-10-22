# Storybook Highlight Migration Instructions for LLM

## Overview

Storybook 9.1.21 and 10.6.2 changed the Highlight channel API:

- A `HIGHLIGHT` payload that uses `selectors` needs a string `id`. Storybook ignores it otherwise.
- Menu items no longer accept `clickEvent`. They take `clickable: true`, and a click emits `HIGHLIGHT_MENU_CLICK` with `(highlightId, itemId, details)`.
- `details.element` no longer has `outerHTML` or `attributes`. It keeps `tagName` and `localName`.

A deterministic pre-pass already added an `id` to the object literal `HIGHLIGHT` payloads it could change. `impl.agentContext` in the step's `nx_migrate_prompt` block lists the remaining items. When you apply these instructions by hand, the next steps the migration printed list the same items. Finish those items and nothing else. Do not change Highlight code in `node_modules`, payloads that use `elements`, or Storybook and Nx configuration.

## Pre-Migration Checklist

Confirm both conditions before changing anything. If either fails, make no changes and stop.

1. `impl.agentContext` lists at least one item. If that field is absent, use the next steps the migration printed. If you have neither, search the workspace outside `node_modules` for `storybook/highlight` and `clickEvent`, and treat each match as an item.
2. The workspace is on `storybook` 9.1.21 or later in the 9.x line, or on 10.6.2 or later (`storybook` in `package.json`).

## Step 1: Verify the pre-pass

Open each file the pre-pass changed, listed in `impl.changes`. If that field is absent, search the workspace outside `node_modules` for `Math.random().toString(36).slice(2)`. The pre-pass gave each payload an id made of the file path and a random suffix, such as `` `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}` ``. Every emit gets a new id, so each one adds its own highlight, as Storybook did before the upgrade. Do not re-apply these edits. Step 2 is the only reason to change a generated id.

## Step 2: Replace `clickEvent` in menu items

Three kinds of items lead here:

- Menu items that use `clickEvent` inside a `HIGHLIGHT` payload. Change each one.
- A payload whose menu items come from code the pre-pass doesn't follow, such as a variable, a function call, another module or a spread. Follow the `menu` value to its items and open each one. Change every item that sets `clickEvent`, including through an assignment such as `item.clickEvent = '<event>'` or a spread.
- Objects with `title` and `clickEvent` that may be menu items. Change one only after you follow it to the `menu` of a `HIGHLIGHT` payload. Leave the others unchanged.

For each menu item you change:

1. Replace `clickEvent: '<event>'` with `clickable: true`. Replace a `clickEvent` assignment the same way.
2. Give the `HIGHLIGHT` payload that carries the menu a fixed, descriptive `id`, replacing the generated one. With a fixed id, a later emit replaces the earlier highlight. If the call emits several times between story renders and each highlight must stay visible, add a unique suffix after a fixed prefix and compare the prefix in the listener.
3. Search the workspace, outside `node_modules`, for the listener of `<event>`. It can live in a preview file, a story, or a manager or addon file. Move it to `HIGHLIGHT_MENU_CLICK`, imported from `storybook/highlight`. The old listener received `(itemId, details)`. The new one receives `(highlightId, itemId, details)` and must return early when `highlightId` is not the payload's id.

**Before:**

```ts
emit(HIGHLIGHT, {
  id: `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}`,
  selectors: ['h2'],
  menu: [
    [
      {
        id: 'details',
        title: 'Show details',
        clickEvent: 'my-addon/show-details',
      },
    ],
  ],
});

channel.on('my-addon/show-details', (itemId, details) => {
  showDetails(itemId, details);
});
```

**After:**

```ts
import { HIGHLIGHT, HIGHLIGHT_MENU_CLICK } from 'storybook/highlight';

emit(HIGHLIGHT, {
  id: 'my-addon/headings',
  selectors: ['h2'],
  menu: [[{ id: 'details', title: 'Show details', clickable: true }]],
});

channel.on(HIGHLIGHT_MENU_CLICK, (highlightId, itemId, details) => {
  if (highlightId !== 'my-addon/headings') return;
  showDetails(itemId, details);
});
```

## Step 3: Stop reading `outerHTML` and `attributes`

For each file listed with the `ClickEventDetails` type, and for each listener you moved in Step 2, replace reads of `details.element.outerHTML` and `details.element.attributes`. Use `details.element.tagName`, `details.element.localName` or `details.selectors`. If the code needs the element's markup or attributes and nothing else gives them, leave that code unchanged and report it to the user.

## Step 4: Fix objects typed `HighlightOptions`

`HighlightOptions.id` is now required. Give each object of that type without an `id` in a listed file a unique string `id`. If one object is emitted several times between story renders and each highlight must stay visible, add a unique id where it is emitted instead, and type the object as `Omit<HighlightOptions, 'id'>`.

## Step 5: Give the remaining payloads an id

The other items list `HIGHLIGHT` usage the pre-pass could not check or change:

- A payload that isn't an object literal.
- A payload whose `id` may not be a non-empty string: a variable, `undefined`, `''`, a number, or an `id` that a spread or a computed key can set.
- A payload without an `id` in a scope where `Math` is a local binding, so the pre-pass couldn't use `Math.random()` there.
- The event used outside an emit call, or passed to a function the pre-pass didn't recognize as an emit.
- A payload passed through a spread argument.
- `storybook/highlight` loaded with `require`, a dynamic import or a re-export, or a file the pre-pass couldn't parse.

For each one, find the `HIGHLIGHT` payloads it emits. Make sure each payload that uses `selectors` gets a unique, non-empty string `id`, such as the file path and a random suffix like the pre-pass. Where `Math` is a local binding, build the id without it, for example with `globalThis.Math.random()` or a fixed string. When the `id` comes from a variable or an argument, keep it and add a fallback only where it can be missing or empty. Skip a listed function that doesn't emit `HIGHLIGHT`.

## Post-Migration Validation

1. Run the `typecheck`, `lint` and `test` targets that exist for the projects owning the changed files, for example `npx nx run-many -t typecheck,lint,test -p <projects>`.
2. Fix failures caused by this migration and re-run until green.
3. Search the workspace, outside `node_modules`, for `clickEvent` and confirm no Highlight menu item still uses it.

## Nx-Specific Notes

Highlight code lives in Storybook preview and manager files (`.storybook/preview.*`, `.storybook/manager.*`), in story files, and in addon libraries inside the workspace. Each Storybook project has its own `.storybook` directory.
