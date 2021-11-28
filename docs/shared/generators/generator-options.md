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

Dynamic options can prompt the user to select from a list of options. To define a prompt, add an `x-prompt` property to the option object, set the type to list, and define an items array for the choices.

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
      },
      "x-prompt": "What is your desired library name?",
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

The properties of a generator. It is formed in:

```json
{
  "properties_name": {
    // properties configuration
  }
}
```

The available options of the properties configuration can be
seen at [Properties](#properties) section.

#### `required`

The properties that is required. Example:

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

In this example, the property `name` is required, while
the property `type` is optional. You can define your schema like:

```ts
interface Schema {
  name: string; // required
  type?: string; // optional
}
```

#### `description`

The description of your schema for user to understand
what he can do with the generator.

Example: `A exception class generator.`

#### `definitions`

WIP. Not pretty sure what it is. Its structure is pretty similar
to `properties`.

#### `additionalProperties`

WIP. Not pretty sure what it is, either.

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

The type of the input. Can be either of `string`, `number`, `bigint`, `boolean`, `object` or `array`.

Example:

```json
{
  "type": "string",
  "minLength": "10"
}
```

#### `required`

WIP

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

WIP

#### `oneOf`

Only accepts that value that matches either of the condition properties. Example:

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

In this example, `sourceMap` accepts the value whose type is either `boolean` or `string`. Another example:

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

`optimization` accepts either an object that includes `scripts` and `styles` properties, or an boolean that switches the optimization on or off.

#### `anyOf`

Only accepts that value that matches one of the condition properties. Example:

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

In this example, `format` accepts the string including in the `enum` property, or/and the string whose minimum length is larger than 1.

#### `allOf`

Only accepts that value that matches all of the condition properties.  Example:

```json
{
  "a": {
    "type": "number",
    "allOf": [{ "multipleOf": 5 }, { "multipleOf": 3 }],
  }
}
```

In this example, `a` only accepts the value that can be divided by 5 **and** 3.

#### `items`

WIP. Unsure what it is.

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

The format of this property. Available options are: `path`, `html-selector`, and etc. Example:

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

In this example, the providing value of `prefix` should be formed in the `html-selector` schema.

#### `visible`

Indicate that if the property should be visible in the configuration UI. Example:

```json
{
  "path": {
    "format": "path",
    "visible": false,
  }
}
```

According to the source code: the `path` won't be visible in the configuration UI, and will default to the relative path (if available and users do not provide that property).

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

Reference to somewhere. WIP.

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

Unknown. WIP.

#### `x-prompt`

Prompt and help user to input the value of the property. The full example can be seen at [Adding dynamic prompts](#adding-dynamic-prompts).

`x-prompt` can be a `string` or an `object`. The full declaration is:

```ts
// with ? - optional
// without ? - required
// | - or
'x-prompt'?:
  | string
  | { message: string; type: string; items: any[]; multiselect?: boolean };
```

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

Indicate that if the property is deprecated. Can be a `boolean` or a `string`. The `boolean` example:

```json
{
  "setupFile": {
    "description": "The name of a setup file used by Jest. (use Jest config file https://jestjs.io/docs/en/configuration#setupfilesafterenv-array)",
    "type": "string",
    "x-deprecated": true
  }
}
```

It indicates that the property `setupFile` is deprecated without a reason. The `string` example:

```json
{
  "tsSpecConfig": {
    "type": "string",
    "description": "The tsconfig file for specs.",
    "x-deprecated": "Use the `tsconfig` property for `ts-jest` in the e2e project `jest.config.js` file. It will be removed in the next major release."
  }
}
```

It indicates that users should use the `tsconfig` property rather than specify this property.

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

Make sure that the number is greater than or equal the specified number.

```json
{
  "value": {
    "type": "number",
    "minimum": 5
  }
}
```

In this example, `value` **only** accepts the value that is greater than or equal to 5 (`value >= 5`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `number` specific: `exclusiveMinimum`

Make sure that the number is greater than the specified number.

```json
{
  "value": {
    "type": "number",
    "exclusiveMinimum": 4,
  }
}
```

In this example, `value` **only** accepts the value that is greater than 4 (`value > 4`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `number` specific: `maximum`

Make sure that the number is less than or equal the specified number.

```json
{
  "value": {
    "type": "number",
    "maximum": 200
  }
}
```

In this example, `value` **only** accepts the value that is less than or equal to 200 (`value <= 200`).

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

In this example, `value` **only** accepts the value that is less than 201 (`value < 201`).

You can read more at [Understanding JSON schema](https://json-schema.org/understanding-json-schema/reference/numeric.html#range).

#### `string` specific: `pattern`

Make sure that the string matches the RegExp pattern.

```json
{
  "value": {
    "type": "string",
    "pattern": "^\\d+$"
  }
}
```

In this example, `value` requires the value to match the `^\\d+$` pattern, which is a regular expression that matches the string that contains only digits.

#### `string` specific: `minLength`

Make sure that the string length is greater than or equal to the specified value.

```json
{
  "value": {
    "type": "string",
    "minLength": 10,
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
    "maxLength": 10,
  }
}
```

In this example, `value` requires the value to be at most 10 characters long.

### More information

[The current configurable options (and its parse method) can be found here](https://github.com/nrwl/nx/blob/master/packages/tao/src/shared/params.ts). You would need a basic knowledge of TypeScript to read this.
