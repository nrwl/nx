#### Convert Jest Config to CJS

Converts `jest.config.ts` files to `jest.config.cts`. This is needed because Node.js type-stripping in newer versions (22+, 24+) can cause issues with ESM syntax in `.ts` files when the project is configured for CommonJS.

This migration only runs if `@nx/jest/plugin` is registered in `nx.json`.

#### Examples

##### Before

```typescript title="jest.config.ts"
import { foo } from 'bar';
import baz from 'qux';

export default {
  displayName: 'myapp',
  preset: foo,
  transform: baz,
};
```

##### After

```typescript title="jest.config.cts"
const { foo } = require('bar');
const baz = require('qux').default ?? require('qux');

module.exports = {
  displayName: 'myapp',
  preset: foo,
  transform: baz,
};
```
