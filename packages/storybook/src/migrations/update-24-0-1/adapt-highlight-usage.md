# Storybook Highlight Migration Instructions for LLM

## Overview

Storybook 9.1.21 and 10.6.2 changed the Highlight channel API:

- A `HIGHLIGHT` payload that uses `selectors` needs a string `id`. Storybook ignores it otherwise.
- Menu items no longer accept `clickEvent`. They take `clickable: true`, and a click emits `HIGHLIGHT_MENU_CLICK` with `(highlightId, itemId, details)`.
- `details.element` no longer has `outerHTML` or `attributes`. It keeps `tagName` and `localName`.

A deterministic pre-pass added an `id` to object literal payloads emitted through an emitter returned by `useChannel`. `impl.agentContext` in the step's `nx_migrate_prompt` block lists every file that uses `storybook/highlight` or `clickEvent`, including the files the pre-pass changed. When you apply these instructions by hand, the next steps the migration printed list the same files. Change only those files and the files Step 2 leads you to. Do not change Highlight code in `node_modules`, payloads that use `elements`, or Storybook and Nx configuration.

## Pre-Migration Checklist

Confirm both conditions before changing anything. If either fails, make no changes and stop.

1. `impl.agentContext` lists at least one file. If that field is absent, use the next steps the migration printed. If you have neither, search the workspace outside `node_modules` for `storybook/highlight` and `clickEvent`, and treat each matching file as listed.
2. The workspace is on `storybook` 9.1.21 or later in the 9.x line, or on 10.6.2 or later (`storybook` in `package.json`).

## Step 1: Verify the pre-pass

Open each file the pre-pass changed, listed in `impl.changes`. If that field is absent, search the workspace outside `node_modules` for `Math.random().toString(36).slice(2)`. The pre-pass gave each payload an id made of the file path and a random suffix, such as `` `apps/app/.storybook/preview.ts-${Math.random().toString(36).slice(2)}` ``. Every emit gets a new id, so each one adds its own highlight, as Storybook did before the upgrade. Do not re-apply these edits. Step 3 is the only reason to change a generated id.

## Step 2: Find the Highlight usage

In each listed file, find:

- Every `HIGHLIGHT` emit, through any emitter: a `useChannel` emitter, `channel.emit`, or a function that wraps an emit. The event is `HIGHLIGHT` from `storybook/highlight`, under any name or through a namespace import, or its string value `storybook/highlight/add`.
- Menu items in those payloads. Follow each `menu` value through variables, function calls, spreads and imports to the items it builds.
- Objects typed `HighlightOptions`, and code that uses `ClickEventDetails` or the `details` of a menu click.

A file that only uses `clickEvent` may have nothing to do with Highlight. Change its objects only after you follow them to the `menu` of a `HIGHLIGHT` payload.

When a listed file re-exports `HIGHLIGHT`, `HighlightOptions` or `ClickEventDetails`, or exports a function that emits `HIGHLIGHT`, search the workspace outside `node_modules` for the files that import it, and treat those files as listed.

## Step 3: Replace `clickEvent` in menu items

For each menu item that sets `clickEvent`, including through an assignment such as `item.clickEvent = '<event>'` or a spread:

1. Replace `clickEvent: '<event>'` with `clickable: true`. Replace a `clickEvent` assignment the same way.
2. Give the `HIGHLIGHT` payload that carries the menu a fixed, descriptive `id`, replacing a generated one. With a fixed id, a later emit replaces the earlier highlight. If the call emits several times between story renders and each highlight must stay visible, add a unique suffix after a fixed prefix and compare the prefix in the listener.
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

## Step 4: Stop reading `outerHTML` and `attributes`

For each use of `ClickEventDetails` you found, and for each listener you moved in Step 3, replace reads of `details.element.outerHTML` and `details.element.attributes`. Use `details.element.tagName`, `details.element.localName` or `details.selectors`. If the code needs the element's markup or attributes and nothing else gives them, leave that code unchanged and report it to the user.

## Step 5: Fix objects typed `HighlightOptions`

`HighlightOptions.id` is now required. Give each object of that type without an `id` a unique string `id`. If one object is emitted several times between story renders and each highlight must stay visible, add a unique id where it is emitted instead, and type the object as `Omit<HighlightOptions, 'id'>`.

## Step 6: Give the remaining payloads an id

Make sure each `HIGHLIGHT` payload that uses `selectors` has a unique, non-empty string `id`:

- Without an `id`, add one made of the file path and a random suffix, like the pre-pass. Where `Math` is a local binding, build the id without it, for example with `globalThis.Math.random()` or a fixed string.
- When the `id` comes from a variable, an argument, a spread or a computed key, keep it, and add a fallback only where it can be missing or empty.
- When the payload has a type that doesn't allow `id`, such as a `satisfies` type, a parameter type or a type annotation, add `id` to that type.

## Post-Migration Validation

1. Run the `typecheck`, `lint` and `test` targets that exist for the projects owning the changed files, for example `npx nx run-many -t typecheck,lint,test -p <projects>`.
2. Fix failures caused by this migration and re-run until green.
3. Search the workspace, outside `node_modules`, for `clickEvent` and confirm no Highlight menu item still uses it.

## Nx-Specific Notes

Highlight code lives in Storybook preview and manager files (`.storybook/preview.*`, `.storybook/manager.*`), in story files, and in addon libraries inside the workspace. Each Storybook project has its own `.storybook` directory.
