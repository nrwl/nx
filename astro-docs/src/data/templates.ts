/**
 * Source of truth for the Templates gallery (/docs/templates) and each template
 * detail page (/docs/templates/<slug>).
 *
 * A "template" maps to a GitHub repository in the `nrwl` org that
 * `create-nx-workspace` can clone via `--template`. The four base templates
 * (empty/react/angular/typescript) also support a short alias; new templates
 * use the full `nrwl/<repo>` form.
 *
 * Commands and project names here are kept in sync with each template repo's
 * actual project names and targets (verified against each repo, not assumed).
 */

export type TemplateCategory =
  | 'AI'
  | 'Starter'
  | 'Fullstack'
  | 'Backend'
  | 'Module Federation'
  | 'Documentation'
  | 'Packages'
  | 'Media';

export interface TemplateStep {
  label: string;
  code: string;
}

export interface TemplateHighlight {
  title: string;
  body: string;
}

export interface TemplateLink {
  label: string;
  href: string;
}

export interface Template {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: TemplateCategory;
  useCases: string[];
  stack: string[];
  repo: string;
  templateArg: string;
  accent: string;
  accentTo: string;
  glyph: string;
  image?: string;
  demoUrl?: string;
  status: 'stable' | 'new';
  featured?: boolean;
  highlights: TemplateHighlight[];
  whatsInside: string[];
  gettingStarted: TemplateStep[];
  learnMore?: TemplateLink[];
}

const graphStep: TemplateStep = {
  label: "Visualize your monorepo's graph in the browser",
  code: 'npx nx graph',
};

export const templates: Template[] = [
  // ---------------------------------------------------------------------------
  // Base templates (published, short alias works)
  // ---------------------------------------------------------------------------
  {
    slug: 'blank',
    name: 'Blank',
    tagline: 'An empty, fully configured monorepo to grow into.',
    description:
      'A minimal Nx monorepo with no projects yet - the configuration, caching, and tooling are wired up for you. Start from scratch with module boundaries, affected commands, and a project graph from the first commit.',
    category: 'Starter',
    useCases: ['Starter', 'Monorepo', 'From scratch'],
    stack: ['Nx', 'TypeScript'],
    repo: 'empty-template',
    templateArg: 'empty',
    accent: '#64748b',
    accentTo: '#0f172a',
    glyph: 'Blank',
    image: '/docs/templates-media/blank.webp',
    status: 'stable',
    featured: true,
    highlights: [
      {
        title: 'Zero assumptions',
        body: 'No framework lock-in. Add React, Node, or anything else with a single generator when you need it.',
      },
      {
        title: 'Caching from day one',
        body: 'Local and remote caching, affected commands, and the project graph are configured before you write a line of code.',
      },
      {
        title: 'Module boundaries ready',
        body: 'Tag-based lint rules are set up so your architecture stays clean as the monorepo grows.',
      },
    ],
    whatsInside: [
      'A configured Nx monorepo (nx.json, tsconfig.base.json)',
      'Package-manager workspaces configured under packages/',
      'No projects - you decide what goes in',
    ],
    gettingStarted: [
      { label: 'Add your first app', code: 'npx nx g @nx/react:app apps/web' },
      { label: 'Add a library', code: 'npx nx g @nx/js:lib packages/util' },
      graphStep,
    ],
  },
  {
    slug: 'tanstack-start',
    name: 'TanStack Start',
    tagline: 'Full-stack React on TanStack Start with type-safe routing.',
    description:
      'A TanStack Start monorepo - full-stack React powered by Vite, with type-safe file-based routing, server functions, and streaming. Paired with shared libraries and Nx so you get instant feedback locally and cached, affected-aware builds in CI.',
    category: 'Fullstack',
    useCases: ['Fullstack', 'React', 'SSR', 'Type-safe'],
    stack: ['TanStack Start', 'React', 'Vite', 'TypeScript'],
    repo: 'tanstack-start-template',
    templateArg: 'nrwl/tanstack-start-template',
    accent: '#f97316',
    accentTo: '#451a03',
    glyph: 'TanStack',
    image: '/docs/templates-media/tanstack-start.webp',
    status: 'new',
    featured: false,
    highlights: [
      {
        title: 'Type-safe to the route',
        body: 'File-based routing with end-to-end type safety, server functions, and SSR configured for you.',
      },
      {
        title: 'Vite-fast feedback',
        body: 'Instant HMR in development and Nx caching that skips work you have already done.',
      },
      {
        title: 'Grows with you',
        body: 'Shared libraries are set up so the app stays thin and the logic stays reusable.',
      },
    ],
    whatsInside: [
      'apps/web - TanStack Start application (Vite)',
      'packages/ui - shared React components',
      'Inferred Nx targets from the app scripts',
    ],
    gettingStarted: [
      { label: 'Start developing', code: 'npx nx run web:dev' },
      { label: 'Build every project', code: 'npx nx run-many -t build' },
      graphStep,
    ],
    learnMore: [
      { label: 'TanStack Start', href: 'https://tanstack.com/start' },
    ],
  },
  {
    slug: 'tanstack-ai',
    name: 'TanStack AI',
    tagline:
      'A streaming, type-safe AI chat with tool calling on TanStack Start.',
    description:
      'An AI chat app: a TanStack Start front end wired to TanStack AI for streaming chat, isomorphic tool calling, and agents - provider-agnostic and defaulting to Claude. Tools are defined once and run on the server with full type safety, and it lives in an Nx monorepo with a shared tool library, caching, and affected builds.',
    category: 'AI',
    useCases: ['AI', 'Chat', 'Agents', 'Fullstack', 'Type-safe'],
    stack: ['TanStack Start', 'TanStack AI', 'React', 'Claude', 'Vite'],
    repo: 'tanstack-ai-template',
    templateArg: 'nrwl/tanstack-ai-template',
    accent: '#2dd4bf',
    accentTo: '#4338ca',
    glyph: 'TanStack AI',
    image: '/docs/templates-media/tanstack-ai.webp',
    status: 'new',
    featured: true,
    highlights: [
      {
        title: 'Streaming and type-safe',
        body: 'TanStack AI streams responses end to end with full TypeScript inference - typed messages, tools, and structured outputs.',
      },
      {
        title: 'Define a tool once',
        body: 'Isomorphic tools run on the server but are callable by the model and your components, with one definition and automatic validation.',
      },
      {
        title: 'Provider-agnostic',
        body: 'Ships with Claude by default. Swap to OpenAI, Gemini, or OpenRouter by changing a single adapter line.',
      },
      {
        title: 'Built on Nx',
        body: 'A shared tool library, caching, and affected builds keep the AI app fast to iterate on and ready to scale.',
      },
    ],
    whatsInside: [
      'apps/web - TanStack Start app with a streaming chat UI',
      'packages/ai - shared TanStack AI tool definitions and types',
      'A server route that streams chat over Server-Sent Events',
    ],
    gettingStarted: [
      {
        label: 'Add your Anthropic API key',
        code: 'echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env',
      },
      {
        label: 'Start the chat app',
        code: 'npx nx run @tanstack-ai-template/web:dev',
      },
      { label: 'Build every project', code: 'npx nx run-many -t build' },
      graphStep,
    ],
    learnMore: [
      { label: 'TanStack AI', href: 'https://tanstack.com/ai' },
      { label: 'TanStack Start', href: 'https://tanstack.com/start' },
    ],
  },
  {
    slug: 'react',
    name: 'React',
    tagline: 'A fullstack React monorepo with an Express API.',
    description:
      'A React monorepo shaped for real apps: a Vite-powered shop app, an Express API, and a set of feature, data-access, and UI libraries connected through enforced module boundaries. Vitest for unit tests, Playwright for e2e, and self-healing CI.',
    category: 'Fullstack',
    useCases: ['Fullstack', 'Starter', 'React'],
    stack: ['React', 'Vite', 'Express', 'Vitest', 'Playwright'],
    repo: 'react-template',
    templateArg: 'react',
    accent: '#149eca',
    accentTo: '#0b4f6c',
    glyph: 'React',
    image: '/docs/templates-media/react.webp',
    status: 'stable',
    featured: true,
    highlights: [
      {
        title: 'Frontend + backend in one monorepo',
        body: 'A React shop and an Express API share types through libraries - change a model once and affected catches every consumer.',
      },
      {
        title: 'Architected with libraries',
        body: 'Feature, data-access, and UI libraries with scope/type tags show how a real React monorepo is organized.',
      },
      {
        title: 'Fast tests',
        body: 'Vitest for units, Playwright for e2e, and e2e task splitting ready for Nx Cloud.',
      },
    ],
    whatsInside: [
      'apps/shop - React e-commerce app (Vite)',
      'apps/api - Express backend serving product data',
      'packages/shop/* - feature, data-access, and UI libraries',
      'packages/shared/* - shared models and test utilities',
      'apps/shop-e2e - Playwright end-to-end tests',
    ],
    gettingStarted: [
      { label: 'Serve the app', code: 'npx nx run @org/shop:serve' },
      { label: 'Test every project', code: 'npx nx run-many -t test' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'React monorepo tutorial',
        href: 'https://nx.dev/getting-started/tutorials/react-monorepo-tutorial',
      },
      {
        label: 'Enforce module boundaries',
        href: 'https://nx.dev/features/enforce-module-boundaries',
      },
    ],
  },
  {
    slug: 'angular',
    name: 'Angular',
    tagline:
      'A fullstack Angular monorepo with an Express API and clean boundaries.',
    description:
      'A standalone-API Angular monorepo paired with an Express backend and a library-first architecture. Shows how to structure an enterprise Angular app with feature and UI libraries, enforced module boundaries, and CI that heals itself.',
    category: 'Fullstack',
    useCases: ['Fullstack', 'Starter', 'Angular', 'Enterprise'],
    stack: ['Angular', 'Express', 'Jest', 'Playwright'],
    repo: 'angular-template',
    templateArg: 'angular',
    accent: '#dd0031',
    accentTo: '#6b0019',
    glyph: 'Angular',
    image: '/docs/templates-media/angular.webp',
    status: 'stable',
    featured: true,
    highlights: [
      {
        title: 'Enterprise-ready structure',
        body: 'Standalone components, feature and UI libraries, and scope/type tags that keep large Angular codebases maintainable.',
      },
      {
        title: 'Fullstack from day one',
        body: 'An Express API ships alongside the Angular app and shares typed models through a library.',
      },
      {
        title: 'Boundaries enforced',
        body: 'Lint rules stop the wrong layers from importing each other so the architecture survives growth.',
      },
    ],
    whatsInside: [
      'apps/shop - Angular application (standalone APIs)',
      'apps/api - Express backend',
      'packages/* - feature, data-access, and UI libraries with tags',
      'apps/shop-e2e - Playwright end-to-end tests',
    ],
    gettingStarted: [
      { label: 'Serve the app', code: 'npx nx run shop:serve' },
      { label: 'Test every project', code: 'npx nx run-many -t test' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'Angular monorepo tutorial',
        href: 'https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial',
      },
    ],
  },
  {
    slug: 'typescript',
    name: 'TypeScript Packages',
    tagline:
      'A monorepo of publishable TypeScript packages, release tooling included.',
    description:
      'A package-based monorepo for publishing libraries to npm. TypeScript packages with project references, incremental builds, and Nx Release configured for versioning and changelogs - the foundation for a design system, SDK, or any multi-package library.',
    category: 'Packages',
    useCases: ['Packages', 'Library', 'NPM', 'Publishing'],
    stack: ['TypeScript', 'Vitest', 'Nx Release'],
    repo: 'typescript-template',
    templateArg: 'typescript',
    accent: '#3178c6',
    accentTo: '#16314d',
    glyph: 'TS',
    image: '/docs/templates-media/typescript.webp',
    status: 'stable',
    featured: false,
    highlights: [
      {
        title: 'Built to publish',
        body: 'Nx Release handles versioning, changelogs, and publishing across every package with one command.',
      },
      {
        title: 'Fast, incremental builds',
        body: 'TypeScript project references plus caching mean you only rebuild what changed.',
      },
      {
        title: 'Add packages in seconds',
        body: 'Generate a new publishable package with consistent config every time.',
      },
    ],
    whatsInside: [
      'packages/* - TypeScript libraries, most ready to publish',
      'Nx Release configured for versioning + changelogs',
      'Vitest for unit testing',
    ],
    gettingStarted: [
      {
        label: 'Add a new package',
        code: 'npx nx g @nx/js:lib packages/my-lib --publishable',
      },
      { label: 'Build every package', code: 'npx nx run-many -t build' },
      { label: 'Dry-run a release', code: 'npx nx release --dry-run' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'Manage releases with Nx',
        href: 'https://nx.dev/features/manage-releases',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // New templates (cloned via nrwl/<repo>)
  // ---------------------------------------------------------------------------
  {
    slug: 'nextjs',
    name: 'Next.js',
    tagline:
      'A Next.js App Router app with a shared UI library, ready for teams.',
    description:
      'A Next.js monorepo using the App Router, server components, and a shared React UI library. The starting point for a marketing site, dashboard, or product front end where you want Nx caching, affected builds, and room to add more apps later.',
    category: 'Fullstack',
    useCases: ['Fullstack', 'Starter', 'React', 'SSR'],
    stack: ['Next.js', 'React', 'Tailwind', 'Jest', 'Playwright'],
    repo: 'nextjs-template',
    templateArg: 'nrwl/nextjs-template',
    accent: '#0ea5e9',
    accentTo: '#020617',
    glyph: 'Next.js',
    image: '/docs/templates-media/nextjs.webp',
    status: 'new',
    featured: true,
    highlights: [
      {
        title: 'App Router first',
        body: 'Server components, layouts, and route handlers configured the way modern Next.js apps are built.',
      },
      {
        title: 'Share, do not copy',
        body: 'A shared UI library is wired into the app so design and logic live in one place across future apps.',
      },
      {
        title: 'CI that scales',
        body: 'Caching and affected mean adding a second or third Next.js app does not slow your pipeline down.',
      },
    ],
    whatsInside: [
      'apps/web - Next.js App Router application',
      'packages/ui - shared React component library',
      'apps/web-e2e - Playwright end-to-end tests',
    ],
    gettingStarted: [
      {
        label: 'Start the dev server',
        code: 'npx nx run @nextjs-template/web:dev',
      },
      {
        label: 'Build for production',
        code: 'npx nx run @nextjs-template/web:build',
      },
      { label: 'Test every project', code: 'npx nx run-many -t test' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'Next.js with Nx',
        href: 'https://nx.dev/technologies/react/next/introduction',
      },
    ],
  },
  {
    slug: 'react-mfe',
    name: 'React Module Federation',
    tagline: 'A microfrontend host and remotes, federated over Vite.',
    description:
      'A microfrontend architecture: a host that composes independently deployable remotes using Vite-powered Module Federation (the consumer and provider generators in @nx/react). Each remote is its own Nx project with its own pipeline, while shared libraries keep the look and feel consistent.',
    category: 'Module Federation',
    useCases: ['Module Federation', 'React', 'Enterprise'],
    stack: ['React', 'Vite', 'Module Federation', 'Playwright'],
    repo: 'react-mfe-template',
    templateArg: 'nrwl/react-mfe-template',
    accent: '#a855f7',
    accentTo: '#2e1065',
    glyph: 'MFE',
    image: '/docs/templates-media/react-mfe.webp',
    status: 'new',
    featured: true,
    highlights: [
      {
        title: 'Independently deployable',
        body: 'A host shell consumes remotes at runtime so teams can ship their slice of the app on their own cadence.',
      },
      {
        title: 'Federated over Vite',
        body: 'Module Federation configured with Vite for fast dev servers and lean production bundles.',
      },
      {
        title: 'Built for many teams',
        body: 'A microfrontend graph is a strong fit for Nx Cloud distribution - build and test every remote in parallel.',
      },
    ],
    whatsInside: [
      'apps/shell - host application',
      'apps/shop, apps/cart - federated remotes',
      'packages/ui - shared design system used across the host and remotes',
    ],
    gettingStarted: [
      { label: 'Serve the host (consumer)', code: 'npx nx run shell:dev' },
      { label: 'Serve a remote (provider)', code: 'npx nx run shop:dev' },
      { label: 'Build every project', code: 'npx nx run-many -t build' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'Module Federation with Nx',
        href: 'https://nx.dev/technologies/module-federation/introduction',
      },
    ],
  },
  {
    slug: 'astro-starlight',
    name: 'Astro Starlight Docs',
    tagline: 'A documentation site on Astro and Starlight, next to your code.',
    description:
      'A documentation site built with Astro and Starlight - fast, searchable, and content-first. Set up inside an Nx monorepo so your docs live next to the code they describe and share components and content libraries with the rest of your monorepo.',
    category: 'Documentation',
    useCases: ['Documentation', 'Astro', 'Content', 'Marketing Sites'],
    stack: ['Astro', 'Starlight', 'Markdown'],
    repo: 'astro-starlight-template',
    templateArg: 'nrwl/astro-starlight-template',
    accent: '#f43f5e',
    accentTo: '#4c0519',
    glyph: 'Docs',
    image: '/docs/templates-media/astro-starlight.webp',
    status: 'new',
    featured: false,
    highlights: [
      {
        title: 'Docs next to your code',
        body: 'Keep documentation in the same monorepo as the product so it is updated in the same PR.',
      },
      {
        title: 'Starlight, preconfigured',
        body: 'Search, navigation, dark mode, and sensible defaults from Starlight - add your content.',
      },
      {
        title: 'Affected docs builds',
        body: 'Nx only rebuilds the docs site when something it depends on actually changes.',
      },
    ],
    whatsInside: [
      'apps/docs - Astro + Starlight documentation site',
      'Nx targets: dev, build, preview',
    ],
    gettingStarted: [
      { label: 'Start the docs site', code: 'npx nx run docs:dev' },
      { label: 'Build the static site', code: 'npx nx run docs:build' },
      { label: 'Build every project', code: 'npx nx run-many -t build' },
      graphStep,
    ],
    learnMore: [{ label: 'Starlight', href: 'https://starlight.astro.build' }],
  },
  {
    slug: 'nestjs',
    name: 'NestJS API',
    tagline: 'A structured NestJS REST API built with the oxc toolchain.',
    description:
      'A NestJS API laid out for growth: modules, controllers, and a shared types library, built with the Rust-based oxc toolchain for fast compiles and a Dockerfile ready to ship. Nx orchestrates the oxc build as a task, so you get caching and affected on top. A solid backend foundation that slots into any front end.',
    category: 'Backend',
    useCases: ['Backend', 'API', 'Enterprise', 'Node'],
    stack: ['NestJS', 'TypeScript', 'oxc', 'Docker'],
    repo: 'nestjs-template',
    templateArg: 'nrwl/nestjs-template',
    accent: '#e0234e',
    accentTo: '#4c0519',
    glyph: 'Nest',
    image: '/docs/templates-media/nestjs.webp',
    status: 'new',
    featured: false,
    highlights: [
      {
        title: 'Opinionated structure',
        body: 'Modules and controllers organized the Nest way, with a shared types library for DTOs.',
      },
      {
        title: 'oxc-fast builds',
        body: 'The Rust-based oxc toolchain compiles the API quickly, wired as an Nx task so builds are cached and affected-aware.',
      },
      {
        title: 'Container-ready',
        body: 'A Dockerfile and health endpoint are included so you can deploy on day one.',
      },
    ],
    whatsInside: [
      'apps/api - NestJS REST API with sample resources',
      'packages/types - shared DTO + type library',
      'A Dockerfile for the API',
    ],
    gettingStarted: [
      { label: 'Serve the API', code: 'npx nx run api:serve' },
      { label: 'Test every project', code: 'npx nx run-many -t test' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'NestJS with Nx',
        href: 'https://nx.dev/technologies/node/nest/introduction',
      },
    ],
  },
  {
    slug: 'express-api',
    name: 'Express API',
    tagline: 'A lean Node + Express API with shared libraries and Docker.',
    description:
      'A lightweight Express API for when you want full control without a framework. Organized routes, a shared utility library, and a Dockerfile - a minimal but real backend that builds fast and is easy to extend.',
    category: 'Backend',
    useCases: ['Backend', 'API', 'Node', 'Starter'],
    stack: ['Express', 'Node', 'TypeScript', 'Docker'],
    repo: 'express-api-template',
    templateArg: 'nrwl/express-api-template',
    accent: '#22c55e',
    accentTo: '#052e16',
    glyph: 'Express',
    image: '/docs/templates-media/express-api.webp',
    status: 'new',
    featured: false,
    highlights: [
      {
        title: 'Minimal by design',
        body: 'Just Express and Node - no framework overhead, with a clean route and controller structure.',
      },
      {
        title: 'Share logic in libraries',
        body: 'A shared library shows how to keep business logic out of route handlers and reusable across services.',
      },
      {
        title: 'Ready to containerize',
        body: 'A Dockerfile is included so the API is deployable from the start.',
      },
    ],
    whatsInside: [
      'apps/api - Express API with health + sample routes',
      'packages/util - shared utility library',
      'A Dockerfile for the API',
    ],
    gettingStarted: [
      {
        label: 'Serve the API',
        code: 'npx nx run @express-api-template/api:serve',
      },
      {
        label: 'Build the API',
        code: 'npx nx run @express-api-template/api:build',
      },
      { label: 'Test every project', code: 'npx nx run-many -t test' },
      graphStep,
    ],
    learnMore: [
      {
        label: 'Node APIs with Nx',
        href: 'https://nx.dev/technologies/node/introduction',
      },
    ],
  },
  {
    slug: 'remotion',
    name: 'Remotion Video',
    tagline: 'Programmatic videos in React, rendered in CI.',
    description:
      'Create videos with React using Remotion. This monorepo ships an example composition, a reusable animation library, and Nx targets so you can preview in Remotion Studio locally and render videos as cached, distributable tasks in CI.',
    category: 'Media',
    useCases: ['Media', 'Video', 'React', 'Creative'],
    stack: ['Remotion', 'React', 'TypeScript'],
    repo: 'remotion-template',
    templateArg: 'nrwl/remotion-template',
    accent: '#06b6d4',
    accentTo: '#083344',
    glyph: 'Remotion',
    image: '/docs/templates-media/remotion.webp',
    status: 'new',
    featured: false,
    highlights: [
      {
        title: 'Video as code',
        body: 'Compose videos with React components and data - version them, review them, and reuse them.',
      },
      {
        title: 'Reusable animations',
        body: 'A shared library of animation components and easings keeps your compositions DRY.',
      },
      {
        title: 'Render in CI',
        body: 'Renders become Nx tasks - cache them, run them on changed compositions only, and distribute them with Nx Cloud.',
      },
    ],
    whatsInside: [
      'apps/video - Remotion project with example compositions',
      'packages/animations - reusable animation components and easings',
      'Nx targets for studio + render',
    ],
    gettingStarted: [
      { label: 'Open Remotion Studio', code: 'npx nx run video:studio' },
      { label: 'Render the example video', code: 'npx nx run video:render' },
      graphStep,
    ],
    learnMore: [{ label: 'Remotion', href: 'https://www.remotion.dev' }],
  },
];

export const categories: TemplateCategory[] = [
  'AI',
  'Starter',
  'Fullstack',
  'Backend',
  'Module Federation',
  'Documentation',
  'Packages',
  'Media',
];

export function getTemplate(slug: string): Template | undefined {
  return templates.find((t) => t.slug === slug);
}

/** The command users run to create a monorepo from this template. */
export function installCommand(
  t: Template,
  workspaceName = 'my-workspace'
): string {
  return `npx create-nx-workspace@latest ${workspaceName} --template ${t.templateArg}`;
}

export function repoUrl(t: Template): string {
  return `https://github.com/nrwl/${t.repo}`;
}

/** Related templates: same category first, then featured, capped at `count`. */
export function relatedTemplates(t: Template, count = 3): Template[] {
  const others = templates.filter((x) => x.slug !== t.slug);
  const sameCategory = others.filter((x) => x.category === t.category);
  const rest = others.filter((x) => x.category !== t.category && x.featured);
  return [...sameCategory, ...rest, ...others].slice(0, count);
}
