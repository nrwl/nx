# Customizing generator options

## Adding a TypeScript schema

To create a TypeScript schema to use in your generator function, define a TypeScript file next to your schema.json named `schema.ts`. Inside the `schema.ts`, define an interface to match the properties in your schema.json file, and whether they are required.

```typescript
export interface GeneratorOptions {
  name: string;
  type?: string;
}
```

Import the TypeScript schema into your generator file and replace the any in your generator function with the interface.

```typescript
import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace';

export default async function (tree: Tree, schema: GeneratorOptions) {
  await libraryGenerator(tree, { name: `${schema.name}-${schema.type || ''}` });
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

## Adding static options

Static options for a generator don't prompt the user for input. To add a static option, define a key in the schema.json file with the option name, and define an object with its type, description, and optional default value.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "type": {
      "type": "string",
      "description": "Provide the library type, such as 'data-access' or 'state'"
    }
  },
  "required": ["name"]
}
```

If you run the generator without providing a value for the type, it is not included in the generated name of the library.

## Adding dynamic prompts

Dynamic options can prompt the user to select from a list of options. To define a prompt, add a `x-prompt` property to the option object, set the type to list, and define an items array for the choices.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "type": {
      "type": "string",
      "description": "Provide the library type",
      "x-prompt": {
        "message": "Which type of library would you like to generate?",
        "type": "list",
        "items": [
          {
            "value": "data-access",
            "label": "Data Access"
          },
          {
            "value": "feature",
            "label": "Feature"
          },
          {
            "value": "state",
            "label": "State Management"
          }
        ]
      }
    }
  },
  "required": ["name"]
}
```

Running the generator without providing a value for the type will prompt the user to make a selection.

## All configurable schema options

Properties tagged with ⚠️ are required. Others are optional.

### Schema

```json
{
  "properties": {
    "name": {} // see Properties
  },
  "required": [],
  "description": "",
  "definitions": {}, // same as "properties"
  "additionalProperties": false
}
```

#### ⚠️ `properties`

The properties of a generator. Properties are listed by name:

```json
{
  "properties_name": {
    // properties configuration
  }
}
```

The available options of the properties' configuration can be
seen in the [Properties](#properties) section.

#### `required`

The property keys that are required. Example:

```json
{
  "properties": {
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string"
    }
  },
  "required": ["name"]
}
```

In this example, the property `name` is required, while the property `type` is optional.
You can define your TypeScript schema like this:

```ts
interface Schema {
  name: string; // required
  type?: string; // optional
}
```

#### `description`

The description of your schema for users to understand
what they can do with the generator.

Example: `A exception class generator.`

#### `definitions`

Define an auxiliary schema in order to be reused and combined later on. Examples:

```json
{
  "$id": "https://example.com/schemas/customer",
  "$schema": "https://json-schema.org/draft/2020-12/schema",

  "type": "object",
  "properties": {
    "first_name": { "type": "string" },
    "last_name": { "type": "string" },
    "shipping_address": { "$ref": "/schemas/address" },
    "billing_address": { "$ref": "/schemas/address" }
  },
  "required": [
    "first_name",
    "last_name",
    "shipping_address",
    "billing_address"
  ],

  "$defs": {
    "address": {
      "$id": "/schemas/address",
      "$schema": "http://json-schema.org/draft-07/schema#",

      "type": "object",
      "properties": {
        "street_address": { "type": "string" },
        "city": { "type": "string" },
        "state": { "$ref": "#/definitions/state" }
      },
      "required": ["street_address", "city", "state"],

      "definitions": {
        "state": { "enum": ["CA", "NY", "... etc ..."] }
      }
    }
  }
}
```

In this example, we defined the `state` in the `definitions` and
reference it later by `$ref`.

> Reference 1: [JSON Schema > Definitions & References](https://cswr.github.io/JsonSchema/spec/definitions_references/)
>
> Reference 2: [Understanding JSON Schema > Extending Recursive Schemas](https://json-schema.org/understanding-json-schema/structuring.html?highlight=definitions#bundling)

#### `additionalProperties`

Specify whether the additional properties in the input are allowed. Example:

```json
{
  "type": "object",
  "properties": {
    "number": { "type": "number" },
    "street_name": { "type": "string" },
    "street_type": { "enum": ["Street", "Avenue", "Boulevard"] }
  },
  "additionalProperties": false
}
```

In this example, this schema only accepts the properties that are explicitly defined in the `properties` object such like:

```json
{ "number": 1600, "street_name": "Pennsylvania", "street_type": "Avenue" }
```

Any additional properties will be considered invalid.

```json
{
  "number": 1600,
  "street_name": "Pennsylvania",
  "street_type": "Avenue",
  "direction": "NW"
}
```

> The above examples are from [Understanding JSON schema > Additional Properties](https://json-schema.org/understanding-json-schema/reference/object.html#additional-properties).
> There are more details in that tutorial.

### Properties

```json
{
  "type": "",
  "required": [],
  "enum": [],
  "properties": {},
  "oneOf": [],
  "anyOf": [],
  "allOf": [],
  "items": [],
  "alias": "",
  "aliases": [],
  "description": "",
  "format": "",
  "visible": false,
  "default": "",
  "$ref": "",
  "$default": {
    "$source": "argv",
    "index": 0
  },
  "additionalProperties": false,
  "x-prompt": {
    "message": "",
    "type": "",
    "items": [],
    "multiselect": false
  },
  "x-deprecated": false
}
```

Options available in `number` type:

```json
{
  "multipleOf": 5,
  "minimum": 5,
  "exclusiveMinimum": 4,
  "maximum": 200,
  "exclusiveMaximum": 201
}
```

Options available in `string` type:

```json
{
  "pattern": "\\d+",
  "minLength": 10,
  "maxLength": 100
}
```

#### `type`

The type of the input. Can be one of `string`, `number`, `bigint`, `boolean`, `object` or `array`.

Example:

```json
{
  "type": "string",
  "minLength": "10"
}
```

#### `required`

The property keys that are required. Example:

```json
{
  "properties": {
    "a": {
      "type": "boolean"
    },
    "b": {
      "type": "boolean"
    }
  },
  "required": ["a"]
}
```

In this example, the property `a` is required, while the property `b` is optional.

#### `enum`

Make sure that the value is in the enumeration. Example:

```json
{
  "type": "string",
  "enum": ["foo", "bar"]

  // valid case: `foo`, `bar`
  // invalid case: any other string like `hello`
}
```

#### `properties`

The sub-properties of a property. Example:

```json
{
  "index": {
    "description": "Configures the generation of the application's HTML index.",
    "type": "object",
    "description": "",
    "properties": {
      "input": {
        "type": "string",
        "minLength": 1,
        "description": "The path of a file to use for the application's generated HTML index."
      },
      "output": {
        "type": "string",
        "minLength": 1,
        "default": "index.html",
        "description": "The output path of the application's generated HTML index file. The full provided path will be used and will be considered relative to the application's configured output path."
      }
    },
    "required": ["input"]
  }
}
```

In this example, the property `index` is a `object`, which accepts two properties: `input` and `output`.

#### `oneOf`

Only accepts a value that matches one of the condition properties. Example:

```json
{
  "sourceMap": {
    "description": "Output sourcemaps. Use 'hidden' for use with error reporting tools without generating sourcemap comment.",
    "default": true,
    "oneOf": [
      {
        "type": "boolean"
      },
      {
        "type": "string"
      }
    ]
  }
}
```

In this example, `sourceMap` accepts a value whose type is either `boolean` or `string`. Another example:

```json
{
  "optimization": {
    "description": "Enables optimization of the build output.",
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "scripts": {
            "type": "boolean",
            "description": "Enables optimization of the scripts output.",
            "default": true
          },
          "styles": {
            "type": "boolean",
            "description": "Enables optimization of the styles output.",
            "default": true
          }
        },
        "additionalProperties": false
      },
      {
        "type": "boolean"
      }
    ]
  }
}
```

`optimization` accepts either an object that includes `scripts` and `styles` properties, or a boolean that switches the optimization on or off.

#### `anyOf`

Only accepts a value that matches one of the condition properties. Example:

```json
{
  "format": {
    "type": "string",
    "description": "ESLint Output formatter (https://eslint.org/docs/user-guide/formatters).",
    "default": "stylish",
    "anyOf": [
      {
        "enum": [
          "stylish",
          "compact",
          "codeframe",
          "unix",
          "visualstudio",
          "table",
          "checkstyle",
          "html",
          "jslint-xml",
          "json",
          "json-with-metadata",
          "junit",
          "tap"
        ]
      },
      { "minLength": 1 }
    ]
  }
}
```

In this example, `format` accepts a string listed in the `enum` property, and/or a string whose minimum length is larger than 1.

#### `allOf`

Only accepts a value that matches all the condition properties. Example:

```json
{
  "a": {
    "type": "number",
    "allOf": [{ "multipleOf": 5 }, { "multipleOf": 3 }]
  }
}
```

In this example, `a` only accepts a value that can be divided by 5 **and** 3.

#### `alias`

The alias of this property. Example:

```json
{
  "tags": {
    "type": "string",
    "description": "Add tags to the project (used for linting)",
    "alias": "t"
  },
  "directory": {
    "type": "string",
    "description": "A directory where the project is placed",
    "alias": "d"
  }
}
```

You can pass either `--tags` or `-t` to provide the value of the property `tag`; either `--directory` or `-d` to provide the value of the property `directory`.

#### `aliases`

Mostly same as `alias`, but it can accept multiple aliases. Example:

```json
{
  "directory": {
    "description": "Directory where the generated files are placed.",
    "type": "string",
    "aliases": ["dir", "path"]
  }
}
```

You can pass either `--dir`, `--path` or even `--directory` to provide the value of the property `directory`.

#### `description`

The description for users of your property. Example:

```json
{
  "flat": {
    "description": "Flag to indicate if a directory is created.",
    "type": "boolean",
    "default": false
  }
}
```

#### `format`

The format of this property. Available options are: `path`, `html-selector`, etc. Example:

```json
{
  "prefix": {
    "type": "string",
    "format": "html-selector",
    "description": "The prefix to apply to generated selectors.",
    "alias": "p"
  }
}
```

In this example, the value provided for `prefix` should be formatted using the `html-selector` schema.

#### `visible`

Indicate whether the property should be visible in the configuration UI. Example:

```json
{
  "path": {
    "format": "path",
    "visible": false
  }
}
```

In this example, the `path` won't be visible in the configuration UI, and will apply a default value.

#### `default`

The default value of this property. Example:

```json
{
  "linter": {
    "description": "The tool to use for running lint checks.",
    "type": "string",
    "enum": ["eslint", "tslint"],
    "default": "eslint"
  }
}
```

In this example, `linter` will pick `eslint` when users do not provide the value explicitly.

#### `$ref`

Reference to a schema. Examples can be seen in the [`definitions`](#definitions) section.

#### `$default`

The default source of this property. The full declaration of `$default` is:

```ts
// with ? - optional
// without ? - required
// | - or
$default?: { $source: 'argv'; index: number } | { $source: 'projectName' };
```

Example of `$source: argv`:

```json
{
  "name": {
    "type": "string",
    "description": "Library name",
    "$default": {
      "$source": "argv",
      "index": 0
    },
    "x-prompt": "What name would you like to use for the library?",
    "pattern": "^[a-zA-Z].*$"
  }
}
```

`name` will pick the first argument of the command line as the default value.

Example of `$source: projectName`:

```json
{
  "project": {
    "type": "string",
    "description": "The name of the project.",
    "alias": "p",
    "$default": {
      "$source": "projectName"
    },
    "x-prompt": "What is the name of the project for the migration?"
  }
}
```

`project` will pick the default project name as the default value.

#### `additionalProperties`

See [the above `additionalProperties` section](#additionalproperties).

#### `x-prompt`

Prompt and help user to input the value of the property. It can be a `string` or a `object`. The full declaration is:

```ts
// with ? - optional
// without ? - required
// | - or
'x-prompt'?:
  | string
  | { message: string; type: string; items: any[]; multiselect?: boolean };
```

The string `x-prompt` example:

```json
{
  "name": {
    "type": "string",
    "description": "Library name",
    "$default": {
      "$source": "argv",
      "index": 0
    },
    "x-prompt": "What is your desired library name?"
  }
}
```

The object example can be seen at [Adding dynamic prompts](#adding-dynamic-prompts).

##### ⚠️ `x-prompt` > `message`

The prompt message.

Example: `Which type of library would you like to generate?`

##### ⚠️ `x-prompt` > `type`

The type of the prompt.

##### ⚠️ `x-prompt` > `items`

The choice of the prompt. The `x-prompt.type` must be `list`. The declaration of `items` is:

```ts
// with ? - optional
// without ? - required
// | - or
items?: (string | { name: string; message: string })[];
```

Example that contains `value` and `label`:

```json
{
  "style": {
    "description": "The file extension to be used for style files.",
    "type": "string",
    "default": "css",
    "enum": ["css", "scss", "sass", "less"],
    "x-prompt": {
      "message": "Which stylesheet format would you like to use?",
      "type": "list",
      "items": [
        {
          "value": "css",
          "label": "CSS"
        },
        {
          "value": "scss",
          "label": "SASS(.scss)  [ http://sass-lang.com   ]"
        },
        {
          "value": "sass",
          "label": "SASS(.sass)  [ http://sass-lang.com   ]"
        },
        {
          "value": "less",
          "label": "LESS         [ http://lesscss.org     ]"
        }
      ]
    }
  }
}
```

##### `x-prompt` > `multiselect`

Allow to multi-select in the prompt.

#### `x-deprecated`

Indicate whether the property is deprecated. Can be a `boolean` or a `string`. The `boolean` example:

```json
{
  "setupFile": {
    "description": "The name of a setup file used by Jest. (use Jest config file https://jestjs.io/docs/en/configuration#setupfilesafterenv-array)",
    "type": "string",
    "x-deprecated": true
  }
}
```

This indicates that the property `setupFile` is deprecated without a reason. The `string` example:

```json
{
  "tsSpecConfig": {
    "type": "string",
    "description": "The tsconfig file for specs.",
    "x-deprecated": "Use the `tsconfig` property for `ts-jest` in the e2e project `jest.config.js` file. It will be removed in the next major release."
  }
}
```

This indicates that users should use the `tsconfig` property rather than specify this property.

#### `number` specific: `multipleOf`

Make sure that the number can be divided by the specified number. Example:

```json
{
  "a": {
    "type": "number",
    "multipleOf": 5
  }
}
```

In this example, `a` **only** accepts the value that can be divided by 5.

#### `number` specific: `minimum`

Make sure that the number is greater than or equal to the specified number.

```json
{
  "value": {
    "type": "number",
    "minimum": 5
  }
}
```

In this example, `value` **only** accepts a value that is greater than or equal to 5 (`value >= 5`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `number` specific: `exclusiveMinimum`

Make sure that the number is greater than the specified number.

```json
{
  "value": {
    "type": "number",
    "exclusiveMinimum": 4
  }
}
```

In this example, `value` **only** accepts a value that is greater than 4 (`value > 4`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `number` specific: `maximum`

Make sure that the number is less than or equal to the specified number.

```json
{
  "value": {
    "type": "number",
    "maximum": 200
  }
}
```

In this example, `value` **only** accepts a value that is less than or equal to 200 (`value <= 200`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `number` specific: `exclusiveMaximum`

Make sure that the number is less than the specified number.

```json
{
  "value": {
    "type": "number",
    "maximum": 201
  }
}
```

In this example, `value` **only** accepts a value that is less than 201 (`value < 201`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `string` specific: `pattern`

Make sure that the string matches the Regexp pattern.

```json
{
  "value": {
    "type": "string",
    "pattern": "^\\d+$"
  }
}
```

In this example, `value` requires the value to match the `^\\d+$` pattern, which is a regular expression that matches a string that contains only digits.

#### `string` specific: `minLength`

Make sure that the string length is greater than or equal to the specified value.

```json
{
  "value": {
    "type": "string",
    "minLength": 10
  }
}
```

In this example, `value` requires the value to be at least 10 characters long.

#### `string` specific: `maxLength`

Make sure that the string length is less than or equal to the specified value.

```json
{
  "value": {
    "type": "string",
    "maxLength": 10
  }
}
```

In this example, `value` requires the value to be at most 10 characters long.

### More information

[The current configurable options (and its parse method) can be found here](https://github.com/nrwl/nx/blob/master/packages/tao/src/shared/params.ts). You would need a basic knowledge of TypeScript to read this.

Most examples are referenced from the codebase of Nx. Thanks to everyone who have ever contributed to Nx!
