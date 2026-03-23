---
name: nx-docs-style-check
description: Check modified Nx documentation pages against the astro-docs style guide. Auto-trigger after writing or editing docs content in the nx repo. Also trigger on "check style", "style guide", "docs review", "validate docs". Should run as a final step whenever docs files are modified. IMPORTANT: anytime astro-docs/**/*.mdoc files are modified, this should always run automatically without being asked.
allowed-tools: Read, Glob, Grep
---

# Nx docs style check

You are a documentation editor for Nx. Whenever you detect that the user is writing or editing
documentation files in `astro-docs/src/content/` (`.mdoc`, `.mdx`, `.md`), automatically run this
check and fix any issues. Do not wait to be asked.

## Phase 1: Information architecture audit

Read `astro-docs/STYLE_GUIDE.md` (the "Information architecture" section) and
`astro-docs/sidebar.mts` to understand where the page lives in the sidebar hierarchy.

For every new or moved page, evaluate against ALL FIVE principles. These are non-negotiable:

### 1. Progressive disclosure ("journey" rule)

- Is this for the first 30 minutes (Getting Started), first 30 days (Features), or forever (Reference)?
- Flag if the content complexity doesn't match the section's experience level.

### 2. Category homogeneity ("scan" rule)

- Look at sibling pages in the same sidebar section.
- Do they all share the same content type (concepts, tasks, or products)?
- Flag if this page mixes types that siblings don't.

### 3. Type-based navigation ("intent" rule)

- Is this a learning page (narrative/guide) or a lookup page (reference/API)?
- Flag if it's in the wrong category (e.g., a reference page in a guides section).

### 4. Pen and paper test ("theory" rule)

- Can the page be explained using only pen and paper (no terminal needed)?
- YES = belongs in "How Nx Works" (architecture/concepts)
- NO (needs terminal/code examples) = belongs in "Platform Features" or "Technologies"
- Flag if a concept page has terminal output, CLI commands, or code-heavy examples.

### 5. Universal vs. specific ("placement" rule)

- Does this feature apply to every Nx user?
- YES = "Platform Features"
- NO (only React/Angular/etc. users) = "Technologies"
- Flag if a technology-specific page is in Platform Features or vice versa.

## Phase 2: Style validation

### Step 1: Run Vale and fix errors

Run `nx run astro-docs:vale` to check the modified files.

- **errors** — fix these automatically. Edit the file to resolve the violation.
- **warnings** — fix these automatically when the fix is unambiguous (e.g., sentence case headings).
  For ambiguous cases, suggest the fix and ask.
- **suggestions** — mention them to the user but do not auto-fix.

### Step 2: Fix issues Vale doesn't catch

Read `astro-docs/STYLE_GUIDE.md` and check for that things that Vale may have missed.

### Handling false positives

Use inline Vale comments to suppress legitimate exceptions:

```markdown
<!-- vale Nx.Headings = NO -->

## extractLicenses

<!-- vale Nx.Headings = YES -->
```

Common cases where suppression is appropriate:

- **CLI option headings** (e.g., `## extractLicenses`) — camelCase by design.
  Prefer wrapping in backticks first (`## \`extractLicenses\``).
- **Product possessives in historical/migration context** (e.g., "Angular's original schematic system")
- **Terminology in migration docs** (e.g., explaining what "schematics" were before being renamed)

Do NOT suppress rules just to avoid fixing real violations.

## Output summary

After fixing, report what you did:

```
## Style check results

### Information architecture: [PASS/FAIL]
[List any violations or confirm all five principles pass]

### Vale: [X errors fixed, Y warnings fixed, Z suggestions noted]
[Summary of changes made]

### Manual fixes: [list of additional fixes applied]
```
