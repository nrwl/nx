# Next.js 16 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing Next.js projects from Next.js 15 to Next.js 16. Work systematically through each breaking change category.

## Pre-Migration Checklist

1. **Identify all Next.js projects**:

   ```bash
   nx show projects --with-target build | xargs -I {} nx show project {} --json | jq -r 'select(.targets.build.executor | contains("next")) | .name'
   ```

   Or search for Next.js configuration files:

   ```bash
   find . -name "next.config.*" -not -path "*/node_modules/*"
   ```

2. **Update packages**:

   ```bash
   npm install next@latest react@latest react-dom@latest
   npm install -D @types/react @types/react-dom  # if using TypeScript
   ```

3. **Verify minimum requirements**:
   - Node.js 20.9+ (Node.js 18 is no longer supported)
   - TypeScript 5.1.0+
   - Browser support: Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+

## Migration Steps by Category

### 1. Async Request APIs (Major Breaking Change)

This is the most impactful change in Next.js 16. All dynamic request APIs are now asynchronous.

**Search Patterns**:

- `cookies()` usage in server components
- `headers()` usage in server components
- `draftMode()` usage
- `params` in page, layout, route handlers, and metadata files
- `searchParams` in page components

#### 1.1 Page Components with params

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export default function Page({ params }) {
  const { slug } = params;
  return <h1>{slug}</h1>;
}

// AFTER (Next.js 16)
export default async function Page(props) {
  const { slug } = await props.params;
  return <h1>{slug}</h1>;
}
```

**Action Items**:

- [ ] Make all page components that use `params` async
- [ ] Add `await` before accessing `props.params`
- [ ] Update TypeScript types if applicable

#### 1.2 Page Components with searchParams

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export default function Page({ searchParams }) {
  const query = searchParams.q;
  return <Results query={query} />;
}

// AFTER (Next.js 16)
export default async function Page(props) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  return <Results query={query} />;
}
```

**Action Items**:

- [ ] Make all page components that use `searchParams` async
- [ ] Add `await` before accessing `props.searchParams`

#### 1.3 Layout Components with params

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export default function Layout({ children, params }) {
  const { locale } = params;
  return <div data-locale={locale}>{children}</div>;
}

// AFTER (Next.js 16)
export default async function Layout(props) {
  const { locale } = await props.params;
  return <div data-locale={locale}>{props.children}</div>;
}
```

#### 1.4 Route Handlers

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export async function GET(request, { params }) {
  const { id } = params;
  return Response.json({ id });
}

// AFTER (Next.js 16)
export async function GET(request, props) {
  const { id } = await props.params;
  return Response.json({ id });
}
```

#### 1.5 cookies() and headers()

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
import { cookies, headers } from 'next/headers';

export default function Page() {
  const cookieStore = cookies();
  const headersList = headers();
  const theme = cookieStore.get('theme');
  const userAgent = headersList.get('user-agent');
  return <div>...</div>;
}

// AFTER (Next.js 16)
import { cookies, headers } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const theme = cookieStore.get('theme');
  const userAgent = headersList.get('user-agent');
  return <div>...</div>;
}
```

#### 1.6 draftMode()

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
import { draftMode } from 'next/headers';

export default function Page() {
  const { isEnabled } = draftMode();
  return <div>{isEnabled ? 'Draft' : 'Published'}</div>;
}

// AFTER (Next.js 16)
import { draftMode } from 'next/headers';

export default async function Page() {
  const { isEnabled } = await draftMode();
  return <div>{isEnabled ? 'Draft' : 'Published'}</div>;
}
```

#### 1.7 generateMetadata with params

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export async function generateMetadata({ params }) {
  const { slug } = params;
  return { title: slug };
}

// AFTER (Next.js 16)
export async function generateMetadata(props) {
  const { slug } = await props.params;
  return { title: slug };
}
```

#### 1.8 Automated Migration

Run the Next.js codemod for automated migration:

```bash
npx @next/codemod@canary upgrade latest
```

Generate type helpers for safer migrations (Next.js 15.5+):

```bash
npx next typegen
```

This generates `PageProps`, `LayoutProps`, and `RouteContext` helpers.

### 2. Image Generation Functions

**Search Pattern**: `generateImageMetadata`, `default function Image` in opengraph-image or twitter-image files

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export function generateImageMetadata({ params }) {
  const { slug } = params;
  return [{ id: '1' }];
}

export default function Image({ params, id }) {
  const slug = params.slug;
  return new ImageResponse(/* ... */);
}

// AFTER (Next.js 16)
export async function generateImageMetadata({ params }) {
  const { slug } = await params;
  return [{ id: '1' }];
}

export default async function Image({ params, id }) {
  const { slug } = await params;
  const imageId = await id;
  return new ImageResponse(/* ... */);
}
```

**Action Items**:

- [ ] Make `generateImageMetadata` functions async
- [ ] Make Image components async
- [ ] Add `await` for both `params` and `id` access

### 3. Sitemap Generation

**Search Pattern**: `sitemap` functions with `id` parameter

**Changes Required**:

```tsx
// BEFORE (Next.js 15)
export default async function sitemap({ id }) {
  const start = id * 50000;
  // ...
}

// AFTER (Next.js 16)
export default async function sitemap({ id }) {
  const resolvedId = await id;
  const start = resolvedId * 50000;
  // ...
}
```

### 4. Turbopack Configuration

Turbopack is now the default bundler for development.

**Search Pattern**: `--turbo` or `--turbopack` flags in package.json scripts, `turbopack` in next.config

#### 4.1 Remove Explicit Turbopack Flags

```json
// BEFORE (Next.js 15)
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}

// AFTER (Next.js 16) - Turbopack is default
{
  "scripts": {
    "dev": "next dev"
  }
}
```

#### 4.2 Opt Out to Webpack (if needed)

```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

#### 4.3 Move Turbopack Config Out of Experimental

```ts
// BEFORE (Next.js 15)
const nextConfig = {
  experimental: {
    turbopack: {
      /* options */
    },
  },
};

// AFTER (Next.js 16)
const nextConfig = {
  turbopack: {
    /* options */
  },
};
```

#### 4.4 Update Sass Imports (Turbopack Specific)

```scss
/* BEFORE */
@import '~bootstrap/dist/css/bootstrap.min.css';

/* AFTER - Remove tilde prefix */
@import 'bootstrap/dist/css/bootstrap.min.css';
```

**Action Items**:

- [ ] Remove `--turbo` and `--turbopack` flags from scripts
- [ ] Move `turbopack` config from `experimental` to root level
- [ ] Remove tilde (`~`) prefix from Sass imports
- [ ] Add `--webpack` flag if Webpack is required

### 5. Middleware to Proxy Rename

**Search Pattern**: `middleware.ts` or `middleware.js` files

**Changes Required**:

```bash
# Rename the file
mv middleware.ts proxy.ts
```

```ts
// BEFORE (middleware.ts)
export function middleware(request) {
  // ...
}

// AFTER (proxy.ts)
export function proxy(request) {
  // ...
}
```

**Config Updates**:

```js
// BEFORE
{
  skipMiddlewareUrlNormalize: true;
}

// AFTER
{
  skipProxyUrlNormalize: true;
}
```

**Important**: The Edge runtime is no longer supported in `proxy`. It now uses Node.js runtime.

**Action Items**:

- [ ] Rename `middleware.ts/js` to `proxy.ts/js`
- [ ] Rename exported function from `middleware` to `proxy`
- [ ] Update config option names
- [ ] Remove Edge runtime usage from proxy files

### 6. Parallel Routes default.js Requirement

**Search Pattern**: Directories starting with `@` in the app folder (parallel route slots)

All parallel route slots now require an explicit `default.js` file.

**Changes Required**:

```tsx
// Create app/@modal/default.tsx for each parallel route slot
import { notFound } from 'next/navigation';

export default function Default() {
  notFound(); // or return null
}
```

**Action Items**:

- [ ] Find all parallel route slots (`app/@*/`)
- [ ] Create `default.tsx` in each slot that doesn't have one

### 7. Image Optimization Changes

#### 7.1 Local Images with Query Strings

```tsx
// Now requires explicit configuration
<Image src="/assets/photo?v=1" alt="Photo" width="100" height="100" />
```

```js
// next.config.js
module.exports = {
  images: {
    localPatterns: [
      {
        pathname: '/assets/**',
        search: '?v=1',
      },
    ],
  },
};
```

#### 7.2 Default Value Changes

Add these to `next.config.js` if you need the old defaults:

```js
module.exports = {
  images: {
    // minimumCacheTTL changed from 60 to 14400 seconds
    minimumCacheTTL: 60,

    // Value 16 removed from default imageSizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // qualities now defaults to [75] only
    qualities: [50, 75, 100],

    // Local IP now blocked by default
    dangerouslyAllowLocalIP: true, // only for private networks

    // Maximum redirects changed from unlimited to 3
    maximumRedirects: 5,
  },
};
```

#### 7.3 Deprecated images.domains

```js
// BEFORE - Remove this
module.exports = {
  images: {
    domains: ['example.com'],
  },
};

// AFTER - Use remotePatterns instead
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
};
```

**Action Items**:

- [ ] Add `localPatterns` for images with query strings
- [ ] Migrate `images.domains` to `images.remotePatterns`
- [ ] Review and update default values if needed

### 8. Caching API Updates

#### 8.1 Remove unstable\_ Prefix

```ts
// BEFORE (Next.js 15)
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from 'next/cache';

// AFTER (Next.js 16)
import { cacheLife, cacheTag } from 'next/cache';
```

#### 8.2 New Cache Functions

**revalidateTag with cacheLife profile**:

```ts
'use server';
import { revalidateTag } from 'next/cache';

export async function updateArticle(articleId: string) {
  revalidateTag(`article-${articleId}`, 'max');
}
```

**updateTag (new)**:

```ts
'use server';
import { updateTag } from 'next/cache';

export async function updateUserProfile(userId: string, profile: Profile) {
  await db.users.update(userId, profile);
  updateTag(`user-${userId}`);
}
```

**refresh (new)**:

```ts
'use server';
import { refresh } from 'next/cache';

export async function markNotificationAsRead(notificationId: string) {
  await db.notifications.markAsRead(notificationId);
  refresh();
}
```

**Action Items**:

- [ ] Remove `unstable_` prefix from `cacheLife` and `cacheTag` imports
- [ ] Consider using new `updateTag` and `refresh` functions

### 9. React Compiler Support

React Compiler is now stable and supported:

```ts
// next.config.ts
const nextConfig = {
  reactCompiler: true,
};

export default nextConfig;
```

Install the plugin:

```bash
npm install -D babel-plugin-react-compiler
```

**Note**: Expect higher compile times with React Compiler enabled.

### 10. Scroll Behavior Override

Next.js no longer overrides `scroll-behavior: smooth` during navigation.

To restore previous behavior:

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
```

### 11. ESLint Migration

The `next lint` command has been removed. Migrate to ESLint CLI directly.

```bash
# Run migration codemod
npx @next/codemod@canary next-lint-to-eslint-cli .
```

Remove from `next.config.js`:

```js
// Remove this
{
  eslint: {
  }
}
```

**Action Items**:

- [ ] Run the ESLint migration codemod
- [ ] Remove `eslint` config from `next.config.js`
- [ ] Update CI scripts to use `eslint` directly instead of `next lint`

### 12. Feature Removals

#### 12.1 AMP Support Removed

- All AMP APIs have been deleted
- Remove `useAmp` hook usage
- Remove `amp` config option
- Delete AMP-specific pages

#### 12.2 Runtime Configuration Removed

```js
// BEFORE - Remove these
module.exports = {
  serverRuntimeConfig: { dbUrl: process.env.DATABASE_URL },
  publicRuntimeConfig: { apiUrl: '/api' },
};
```

**Migration for server-side config**:

```tsx
// Use environment variables directly
async function fetchData() {
  const dbUrl = process.env.DATABASE_URL;
  return await db.query(dbUrl, 'SELECT * FROM users');
}
```

**Migration for client-side config**:

```bash
# .env.local
NEXT_PUBLIC_API_URL="/api"
```

```tsx
'use client';
export default function Component() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // ...
}
```

#### 12.3 devIndicators Options Removed

Remove these from `next.config.js`:

- `appIsrStatus`
- `buildActivity`
- `buildActivityPosition`

#### 12.4 experimental.dynamicIO Renamed

```js
// BEFORE
{
  experimental: {
    dynamicIO: true;
  }
}

// AFTER
{
  cacheComponents: true;
}
```

#### 12.5 unstable_rootParams Removed

This API is removed. Await alternative API in a future minor release.

**Action Items**:

- [ ] Remove all AMP-related code
- [ ] Migrate runtime configuration to environment variables
- [ ] Remove deprecated devIndicators options
- [ ] Rename `dynamicIO` to `cacheComponents`

### 13. Development Changes

#### 13.1 Concurrent dev and build

Development now outputs to `.next/dev` (separate from build).

**Update Turbopack tracing command**:

```bash
npx next internal trace .next/dev/trace-turbopack
```

## Post-Migration Validation

### 1. Run Build Per Project

```bash
# Build each Next.js project individually
nx run PROJECT_NAME:build
```

### 2. Run Development Server

```bash
# Start dev server to verify Turbopack works
nx run PROJECT_NAME:serve
```

### 3. Run All Affected Builds

```bash
# Build all affected projects
nx affected -t build
```

### 4. Run Full Validation

```bash
# Run full CI validation
nx prepush
```

### 5. Review Migration Checklist

- [ ] All async request APIs updated
- [ ] All page/layout components using params are async
- [ ] Turbopack configuration updated
- [ ] Middleware renamed to proxy
- [ ] Parallel routes have default.js files
- [ ] Image configuration updated
- [ ] Cache imports updated (removed unstable\_ prefix)
- [ ] AMP code removed
- [ ] Runtime config migrated to env vars
- [ ] ESLint configuration migrated
- [ ] All projects build successfully
- [ ] Development servers start correctly

## Common Issues and Solutions

### Issue: "cookies() expects to be called in a synchronous context"

**Solution**: Make the function async and await `cookies()`

### Issue: "params should be awaited before accessing properties"

**Solution**: Add `await` before accessing `props.params`

### Issue: Build fails with Turbopack

**Solution**: Add `--webpack` flag to build script, then gradually address Turbopack compatibility

### Issue: Middleware not working after rename

**Solution**: Ensure both file and function are renamed from `middleware` to `proxy`

### Issue: Parallel route not rendering

**Solution**: Add `default.tsx` file to the parallel route slot

### Issue: Images with query strings not loading

**Solution**: Add `localPatterns` configuration for those images

### Issue: TypeScript errors with params types

**Solution**: Run `npx next typegen` to generate type helpers, then use `PageProps`, `LayoutProps` types

## Files to Review

Create a checklist of all files that need review:

```bash
# Find all pages with potential params usage
find . -path "*/app/*" -name "page.tsx" -o -name "page.ts" | xargs grep -l "params\|searchParams"

# Find all layouts
find . -path "*/app/*" -name "layout.tsx" -o -name "layout.ts"

# Find all route handlers
find . -path "*/app/*" -name "route.ts" -o -name "route.tsx"

# Find middleware files
find . -name "middleware.ts" -o -name "middleware.js"

# Find files using cookies/headers
rg "from 'next/headers'" --type ts --type tsx

# Find next.config files
find . -name "next.config.*" -not -path "*/node_modules/*"

# Find parallel routes
find . -path "*/app/@*" -type d
```

## Migration Strategy for Large Workspaces

1. **Migrate in phases**: Start with a small project, validate, then expand
2. **Use the codemod**: Run `npx @next/codemod@canary upgrade latest` for automated fixes
3. **Generate types**: Run `npx next typegen` for type-safe migrations
4. **Run tests frequently**: After each configuration change, run affected tests
5. **Document issues**: Keep track of project-specific issues and solutions

## Useful Commands During Migration

```bash
# Find all Next.js projects
nx show projects --with-target build

# Build specific project
nx build PROJECT_NAME

# Serve specific project
nx serve PROJECT_NAME

# Build all affected
nx affected -t build

# View project details
nx show project PROJECT_NAME --web

# Clear Nx cache if needed
nx reset
```

---

## Notes for LLM Execution

When executing this migration:

1. **Work systematically**: Complete one category before moving to the next
2. **Test after each change**: Don't batch all changes without validation
3. **Keep user informed**: Report progress through each section
4. **Handle errors promptly**: If builds fail, fix immediately before proceeding
5. **Use the codemod first**: Let `@next/codemod` handle repetitive async/await changes
6. **Prioritize breaking changes**: Focus on async APIs first as they're most impactful
7. **Create meaningful commits**: Group related changes together with clear messages
8. **Use TodoWrite tool**: Track migration progress for visibility
