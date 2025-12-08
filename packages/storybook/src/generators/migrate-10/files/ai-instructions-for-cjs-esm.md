# Instructions for LLM: Transform Storybook Config Files from CommonJS to ESM

## Task Overview

Find all .storybook/main.ts and .storybook/main.js files in the workspace and transform
any CommonJS (CJS) configurations to ES Modules (ESM).

### Step 1: Find All Storybook Config Files

Use glob patterns to locate all Storybook main configuration files:
**/.storybook/main.js
**/.storybook/main.ts

### Step 2: Identify CommonJS vs ESM

For each file found, read its contents and determine if it uses CommonJS syntax by
checking for:

CommonJS indicators:

- `module.exports =` or `module.exports.`
- `exports.`
- `require()` function calls

ESM indicators (already correct):

- export default
- export const/export function
- import statements

### Step 3: Transform CJS to ESM

For each file identified as CommonJS, perform the following transformations:

A. Convert `module.exports`

// FROM (CJS):

```
module.exports = {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
    addons: ['@storybook/addon-essentials']
};
```

// TO (ESM):

```
export default {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
    addons: ['@storybook/addon-essentials']
};
```

B. Convert `require()` to import

// FROM (CJS):

```
const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');
const { mergeConfig } = require('vite');
```

// TO (ESM):

```
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';
```

C. Handle `path.join()` patterns

// FROM (CJS):

```
const path = require('path');
const rootMain = require(path.join(__dirname, '../../.storybook/main'));
```

// TO (ESM):

```
import { join } from 'path';
import rootMain from '../../.storybook/main';
```

D. Handle Dynamic Requires in Config Functions

// FROM (CJS):

```
module.exports = {
    viteFinal: async (config) => {
        const { mergeConfig } = require('vite');
        return mergeConfig(config, {});
    }
};
```

// TO (ESM):

```
import { mergeConfig } from 'vite';

export default {
    viteFinal: async (config) => {
        return mergeConfig(config, {});
    }
};
```

### Step 4: Validation Checks

After transformation, verify:

1. All require() calls have been converted to import statements at the top of the file
2. All module.exports have been converted to export default or named exports
3. Imports are at the top of the file (before the export)
4. The file maintains proper TypeScript typing if it's a .ts file

### Step 5: Report Results

Provide a summary of:

- Total files found
- Files that were already ESM (no changes needed)
- Files that were transformed from CJS to ESM
- List the specific files that were modified

### Example Complete Transformation

Before (CJS):

```
const path = require('path');
const { mergeConfig } = require('vite');

module.exports = {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
    addons: ['@storybook/addon-essentials'],
    viteFinal: async (config) => {
        return mergeConfig(config, {
            resolve: {
                alias: {}
            }
        });
    }
};
```

After (ESM):

```
import { join } from 'path';
import { mergeConfig } from 'vite';

export default {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
    addons: ['@storybook/addon-essentials'],
    viteFinal: async (config) => {
        return mergeConfig(config, {
            resolve: {
                alias: {}
            }
        });
    }
};
```

## Important Notes

- Preserve all comments in the original files
- Maintain the same indentation and formatting style
- For TypeScript files (.ts), ensure type imports use import type when appropriate
- Test that the transformations don't break the Storybook configuration
