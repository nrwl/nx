# Interface: JsonParseOptions

## Hierarchy

- `ParseOptions`

  ↳ **`JsonParseOptions`**

## Table of contents

### Properties

- [allowEmptyContent](../../devkit/documents/JsonParseOptions#allowemptycontent)
- [allowTrailingComma](../../devkit/documents/JsonParseOptions#allowtrailingcomma)
- [disallowComments](../../devkit/documents/JsonParseOptions#disallowcomments)
- [expectComments](../../devkit/documents/JsonParseOptions#expectcomments)

## Properties

### allowEmptyContent

• `Optional` **allowEmptyContent**: `boolean`

#### Inherited from

ParseOptions.allowEmptyContent

---

### allowTrailingComma

• `Optional` **allowTrailingComma**: `boolean`

Allow trailing commas in the JSON content

#### Overrides

ParseOptions.allowTrailingComma

---

### disallowComments

• `Optional` **disallowComments**: `boolean`

Disallow javascript-style

**`Default`**

```ts
false;
```

#### Overrides

ParseOptions.disallowComments

---

### expectComments

• `Optional` **expectComments**: `boolean`

Expect JSON with javascript-style

**`Default`**

```ts
false;
```
