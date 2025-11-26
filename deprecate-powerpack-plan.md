# Plan: Deprecate Powerpack Documentation (DOC-338)

## Overview

Migrate Powerpack content out of its dedicated section and integrate it directly into Enterprise documentation. The goal is to quietly restructure content without drawing attention to the deprecation.

**Linear Issue:** https://linear.app/nxdev/issue/DOC-338/deprecate-powerpack-docs-page-and-references

## URL Structure Changes

### Current → New (Enterprise Guides)

| Current Path                                                         | New Path                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/docs/enterprise/powerpack/`                                        | DELETE (flatten contents)                                  |
| `/docs/enterprise/powerpack/conformance`                             | `/docs/enterprise/conformance`                             |
| `/docs/enterprise/powerpack/owners`                                  | `/docs/enterprise/owners`                                  |
| `/docs/enterprise/powerpack/configure-conformance-rules-in-nx-cloud` | `/docs/enterprise/configure-conformance-rules-in-nx-cloud` |
| `/docs/enterprise/powerpack/publish-conformance-rules-to-nx-cloud`   | `/docs/enterprise/publish-conformance-rules-to-nx-cloud`   |
| `/docs/enterprise/activate-powerpack`                                | `/docs/enterprise/activate-license`                        |

### Current → New (Reference Docs)

| Current Path                              | New Path                        |
| ----------------------------------------- | ------------------------------- |
| `/docs/reference/powerpack/`              | DELETE (flatten contents)       |
| `/docs/reference/powerpack/conformance/*` | `/docs/reference/conformance/*` |
| `/docs/reference/powerpack/owners/*`      | `/docs/reference/owners/*`      |

### nx.dev Redirects (Next.js site)

| Current Path               | New Path               |
| -------------------------- | ---------------------- |
| `/powerpack`               | → `/enterprise`        |
| `/powerpack/license`       | → `/enterprise`        |
| `/powerpack/special-offer` | Keep existing redirect |

---

## Phase 1: astro-docs Enterprise Content Restructuring

### 1.1 Move enterprise/Powerpack/ contents to enterprise/

**Files to move:**

- `astro-docs/src/content/docs/enterprise/Powerpack/conformance.mdoc` → `enterprise/conformance.mdoc`
- `astro-docs/src/content/docs/enterprise/Powerpack/owners.mdoc` → `enterprise/owners.mdoc`
- `astro-docs/src/content/docs/enterprise/Powerpack/configure-conformance-rules-in-nx-cloud.mdoc` → `enterprise/configure-conformance-rules-in-nx-cloud.mdoc`
- `astro-docs/src/content/docs/enterprise/Powerpack/publish-conformance-rules-to-nx-cloud.mdoc` → `enterprise/publish-conformance-rules-to-nx-cloud.mdoc`

**Files to delete:**

- `astro-docs/src/content/docs/enterprise/Powerpack/index.mdoc`
- `astro-docs/src/content/docs/enterprise/Powerpack/` (entire folder after moving contents)

### 1.2 Rename activate-powerpack.mdoc

- Rename: `enterprise/activate-powerpack.mdoc` → `enterprise/activate-license.mdoc`
- Update title from "Activate Nx Powerpack" to "Activate Enterprise License" (or similar)
- Update content to de-emphasize Powerpack branding

### 1.3 Add license reference to Remote Cache Plugins

- Edit: `astro-docs/src/content/docs/reference/Remote Cache Plugins/index.mdoc`
- Add a note/link about enterprise license activation

---

## Phase 2: astro-docs Reference Content Restructuring

### 2.1 Move reference/Powerpack/ contents to reference/

**Folders to move:**

- `reference/Powerpack/conformance/` → `reference/conformance/`
  - `index.mdoc`
  - `overview.mdoc`
  - `Executors.mdoc`
  - `Generators.mdoc`
  - `create-conformance-rule.mdoc`
  - `test-conformance-rule.mdoc`
- `reference/Powerpack/owners/` → `reference/owners/`
  - `index.mdoc`
  - `overview.mdoc`
  - `Generators.mdoc`

**Files to delete:**

- `reference/Powerpack/index.mdoc`
- `reference/Powerpack/` (entire folder after moving contents)

---

## Phase 3: nx-dev (Next.js) Changes

### 3.1 Remove Powerpack landing page

- Delete or redirect: `nx-dev/nx-dev/app/powerpack/page.tsx`
- Handle: `nx-dev/nx-dev/pages/powerpack/license.tsx`

### 3.2 Update menu-items.ts

**File:** `nx-dev/ui-common/src/lib/headers/menu-items.ts`

Rename the section from "Nx Powerpack Features (Paid Enterprise Extensions)" to "Nx Enterprise Features" and update URLs:

```typescript
// CHANGE FROM:
'Nx Powerpack Features (Paid Enterprise Extensions)': [
  {
    name: 'Run Conformance Rules',
    href: '/nx-enterprise/powerpack/conformance',
    ...
  },
  {
    name: 'Define Project Owners',
    href: '/nx-enterprise/powerpack/owners',
    ...
  },
],

// CHANGE TO:
'Nx Enterprise Features': [
  {
    name: 'Run Conformance Rules',
    href: '/docs/enterprise/conformance',
    icon: CheckBadgeIcon,
    isNew: false,
    isHighlight: false,
  },
  {
    name: 'Define Project Owners',
    href: '/docs/enterprise/owners',
    icon: UserGroupIcon,
    isNew: false,
    isHighlight: false,
  },
],
```

### 3.3 Update redirect-rules.js

**File:** `nx-dev/nx-dev/redirect-rules.js`

Add new redirects:

```javascript
// Add to enterpriseNxSection or create new section
'/powerpack': '/enterprise',
'/powerpack/license': '/enterprise',

// Update existing powerpack redirects to point to new locations
'/features/powerpack': '/enterprise',
'/features/powerpack/conformance': '/docs/enterprise/conformance',
'/features/powerpack/owners': '/docs/enterprise/owners',
'/nx-enterprise/powerpack': '/enterprise',
'/nx-enterprise/powerpack/conformance': '/docs/enterprise/conformance',
'/nx-enterprise/powerpack/owners': '/docs/enterprise/owners',
```

### 3.4 Update redirect-rules-docs-to-astro.js

**File:** `nx-dev/nx-dev/redirect-rules-docs-to-astro.js`

Update all powerpack redirects to point to new flattened structure:

```javascript
// Enterprise section updates
'/nx-enterprise/activate-powerpack': '/docs/enterprise/activate-license',
'/nx-enterprise/powerpack/conformance': '/docs/enterprise/conformance',
'/nx-enterprise/powerpack/owners': '/docs/enterprise/owners',
'/nx-enterprise/powerpack': '/docs/enterprise',

// Reference section updates
'/reference/core-api/conformance': '/docs/reference/conformance',
'/reference/core-api/conformance/overview': '/docs/reference/conformance/overview',
'/reference/core-api/owners': '/docs/reference/owners',
'/reference/core-api/owners/overview': '/docs/reference/owners/overview',
// ... and all other conformance/owners reference paths
```

---

## Phase 4: Content Updates

### 4.1 Update internal links in moved files

After moving files, update all internal links to reflect new paths:

- Links like `/docs/enterprise/powerpack/conformance` → `/docs/enterprise/conformance`
- Links like `/docs/reference/powerpack/conformance/overview` → `/docs/reference/conformance/overview`
- Links to `/docs/enterprise/activate-powerpack` → `/docs/enterprise/activate-license`

### 4.2 De-emphasize Powerpack branding in content

Update content in these files to:

- Remove or soften Powerpack-specific callouts
- Change "Nx Powerpack" references to "Nx Enterprise" where appropriate
- Keep feature names (conformance, owners) prominent
- Update the warning callout in activate-license.mdoc

### 4.3 Search for remaining Powerpack references

After restructuring, grep for remaining "powerpack" references across:

- `astro-docs/src/content/docs/`
- `nx-dev/`
- Update any remaining references to use new paths

---

## Phase 5: Cleanup

### 5.1 Keep ui-powerpack library (for now)

**Decision:** Keep `nx-dev/ui-powerpack/` library for now. Can be cleaned up later if confirmed unused.

### 5.2 Remove/archive powerpack images

Files in `nx-dev/nx-dev/public/images/powerpack/` - decide if needed

### 5.3 Blog post considerations

- Keep existing blog posts for historical reference
- `docs/blog/2024-09-25-introducing-nx-powerpack.md` - no changes needed

---

## Critical Files Summary

### Must Edit

1. `astro-docs/src/content/docs/enterprise/activate-powerpack.mdoc` (rename + update)
2. `nx-dev/ui-common/src/lib/headers/menu-items.ts` (remove Powerpack section)
3. `nx-dev/nx-dev/redirect-rules.js` (add /powerpack redirects)
4. `nx-dev/nx-dev/redirect-rules-docs-to-astro.js` (update all powerpack paths)
5. `astro-docs/src/content/docs/reference/Remote Cache Plugins/index.mdoc` (add license reference)

### Must Move

1. `astro-docs/src/content/docs/enterprise/Powerpack/` contents → `enterprise/`
2. `astro-docs/src/content/docs/reference/Powerpack/` contents → `reference/`

### Must Delete

1. `astro-docs/src/content/docs/enterprise/Powerpack/` folder
2. `astro-docs/src/content/docs/reference/Powerpack/` folder
3. `nx-dev/nx-dev/app/powerpack/page.tsx` (or redirect)
4. `nx-dev/nx-dev/pages/powerpack/license.tsx` (or redirect)

---

## Validation Steps

1. Run `nx affected -t build,test,lint` to catch any broken imports
2. Test redirects locally
3. Verify sidebar navigation in astro-docs
4. Search for any remaining "powerpack" references in URLs
5. Test key pages load correctly after deployment
