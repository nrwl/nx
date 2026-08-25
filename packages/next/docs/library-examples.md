## Examples

##### Create a new lib

```shell
nx g lib libs/my-lib
```

##### Create a new lib under a directory

The following will create a library at `libs/shared/my-lib`.

```shell
nx g lib libs/shared/my-lib
```

##### Export React Server Components

Unlike a React library, a Next.js library has a second entry point, `src/server.ts`, for React Server Components. Exporting a server component from `src/index.ts` marks that whole file as server-only and breaks imports from client components, so keep client components in `src/index.ts` and server components in `src/server.ts`.

```typescript
// apps/my-app/app/page.tsx
import { MyComponent } from '@myorg/my-lib';
import { HelloServer } from '@myorg/my-lib/server';
```
