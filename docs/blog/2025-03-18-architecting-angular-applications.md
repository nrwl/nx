---
title: 'Angular Architecture Guide To Building Maintainable Applications at Scale'
slug: architecting-angular-applications
authors: ['Juri Strumpflohner']
tags: ['nx']
description: 'Learn how to build scalable Angular applications using domain-driven design, clear boundaries, and Nx tooling for better maintainability and team collaboration.'
cover_image: /blog/images/articles/architecting-angular-apps-bg.jpg
---

{% callout type="deepdive" title="Angular Week Series" expanded=true %}

This article is part of the Angular Week series:

- [Modern Angular Testing with Nx](/blog/modern-angular-testing-with-nx)
- **Angular Architecture Guide To Building Maintainable Applications at Scale**
- [Using Rspack with Angular](/blog/using-rspack-with-angular)
- [Enterprise Patterns](/blog/enterprise-angular-book)

{% /callout %}

Software Architecture consists of a variety of aspects that need to be considered. One key aspect though is to maximize the ability to remain flexible and adaptable to new customer requirements. Maybe you've already come across the "Project Paradox":

![Project Paradox](/blog/images/articles/project-paradox.avif)

A good software architecture helps mitigate the Project Paradox by enabling reversible decisions, progressive evolution, and delaying commitments until more knowledge is available. This can be achieved by aiming for a modular design that facilitates encapsulation, allowing incremental changes, and decoupling dependencies with clearly defined boundaries.

In this article we focus mostly on:

- how to implement a scalable architecture, not only at runtime, but at development time
- how to structure your codebase and establish boundaries
- how to encode and automate best practices to ensure their longevity

{% toc /%}

## Pizza-boxes, Onions and Hexagons - How to organize code

Probably the simplest and most widespread (and probably most straightforward) approach for separating different aspects of an application is the **layered architecture** (in Italy we call them Pizza-box architecture).

![layered-architecture.avif](/blog/images/articles/layered-architecture.avif)

If you ever looked into software architecture and structuring of projects, this is probably what you've come across. There are variations of this such as the hexagonal and onion architecture, which differ mostly in how dependencies are wired up.
The common denominator of these architectures (often also denoted as **horizontal approaches**) is that they are mostly focused on dividing the system based on technical responsibilities.

On the other hand, **vertical architecture approaches** organize the application into functional segments or domains focusing on the business capabilities. This is a common approach in microservices architectures.

![Possible domain architecture for our example application](/blog/images/articles/domain-driven-architecture.avif)

## Breaking up the Monolith - How to identify where boundaries are

{% video-player src="/documentation/blog/media/layered-to-domain-areas.mp4" alt="Moving from a layered architecture to domain oriented" showDescription=true showControls=false autoPlay=true loop=true /%}

Instead of organizing code by technical types (components, services, directives) we want to structure our codebase around business domains. Good candidates for domains are areas that:

- have distinct business capabilities (e.g. in the example of an online shop: orders, products, payments)
- reflect team structure within the organization; domain boundaries often mirror organizational structure (Conway's Law)
- can evolve independently from each other, at different speeds
- have clear responsibilities and boundaries

To use the example of an e-commerce application, we might have:

- Products: Product catalog, inventory, categorization
- Orders: Order processing, history, fulfillment
- Checkout: Payment processing, cart management
- User Management: Authentication, profiles, preferences
- Shipping & Logistics: Delivery options, tracking, address management

All of these need to work together for fulfilling the business requirements, but they can evolve independently and responsibilities can clearly be associated. In general, start broad and then refine over time as you gain more insights.

Having such boundaries clearly separated not only helps with the longer-term maintainability of the application, but also helps assign teams and minimizes cross-team dependencies.

## Start Small, Grow as you Need It

A common mistake is to think too much about the ideal end goal and prepare things "just in case". Yep, over-engineering. Exactly, you might not need a monorepo (at least not yet). However, you want to make sure to not add roadblocks in your way.

A lot of our Angular users don't necessarily start to use Nx because they need a monorepo, but because they want to be able to modularize their monolithic codebase. Hetzner Cloud - one of [our customers](/customers) - is a good example for that. Their main goal for initially adopting Nx was to [break apart their monolith](/blog/hetzner-cloud-success-story).

If you want to start building a single Angular application with Nx, you can use the `--preset=angular-standalone` flag:

```shell
npx create-nx-workspace myshop --preset=angular-standalone
```

This creates a new Angular workspace (not a monorepo) with a single application located in the `src` folder.

```text
└─ myshop
   ├─ e2e
   │  ├─ ...
   │  ├─ playwright.config.ts
   │  └─ tsconfig.json
   ├─ public/
   ├─ src
   │  ├─ app
   │  │  ├─ ...
   │  │  ├─ app.component.ts
   │  │  ├─ app.config.ts
   │  │  └─ app.routes.ts
   │  ├─ index.html
   │  ├─ ...
   │  └─ main.ts
   ├─ eslint.config.mjs
   ├─ jest.config.ts
   ├─ jest.preset.js
   ├─ nx.json
   ├─ project.json
   ├─ tsconfig.app.json
   ├─ tsconfig.editor.json
   ├─ tsconfig.json
   └─ tsconfig.spec.json
```

It uses Nx for running and building your project. Nx relies on the Angular Devkit builders but might also add in its own to fill in gaps (e.g. adding Jest/Vitest support). Have a look at the `project.json`:

```json {% fileName="project.json" %}
{
  "name": "myshop",
  "sourceRoot": "./src",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:browser",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/myshop",
        "index": "./src/index.html",
        "main": "./src/main.ts",
        ...
      },
      "configurations": {...},
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      ...
    },
    ...
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "lintFilePatterns": ["./src"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectName}"],
      "options": {
        "jestConfig": "jest.config.ts"
      }
    },
    "serve-static": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "myshop:build",
        "port": 4200,
        "spa": true
      }
    }
  }
}
```

If you have an existing Angular CLI project, you can also [add Nx support to it](/recipes/angular/migration/angular) by running:

```shell
npx nx init
```

If you already know you want to go straight to an Nx monorepo, you can add the `--integrated` flag to the `nx init` command.

## Modularize your Code into Projects Following Your Domain Areas

When starting with Angular, you might structure your application like this:

```text
src/
├── app/
│   ├── auth/          # Authentication feature
│   ├── products/      # Product management feature
│   ├── cart/          # Shopping cart feature
│   └── checkout/      # Checkout feature
├── assets/
└── styles/
```

This feature-based organization is already an improvement over the traditional "type-based" structure (where code is organized by technical type like components/, services/, etc.). However, it still has limitations:

- Boundaries are purely folder-based with no real enforcement
- Easy to create unwanted dependencies between features
- Hard to maintain as the application grows
- No clear rules about what can depend on what

Instead of relying on folder-based separation, we can create dedicated projects (also called libraries) for different parts of our application. Looking at our workspace structure, we have organized our code into domain-specific projects:

```text
myshop/
├── src/               # Main application
└── packages/          # Library projects
    ├── products/      # Product domain
    ├── orders/        # Order management
    ├── checkout/      # Checkout process
    ├── user-management/
    ├── shipping-logistics/
    └── ...
```

These projects aren't necessarily meant to be published as npm packages - their main purpose is to create clear boundaries in your codebase. The application still builds everything together, but the project structure helps maintain clear separation of concerns.

As domains grow more complex, you might want to split them further into more specialized libraries. For example, our products domain is organized as:

```text
packages/products/
├── data-access/               # API and state management
├── feat-product-list/         # Product listing feature
├── feat-product-detail/       # Product detail feature
├── feat-product-reviews/      # Product reviews feature
├── ui-product-card/           # Reusable product card component
└── ui-product-carousel/       # Product carousel component
```

This structure follows a pattern where each domain can have:

- **Feature libraries** (`feat-*`): Implement specific business features or pages
- **UI libraries** (`ui-*`): Contain presentational components
- **Data-access libraries**: Handle API communication and state management

Since this is a standalone application (not a monorepo), we use TypeScript path mappings to link these projects together. In our `tsconfig.base.json`, you can see how each project is mapped:

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    "paths": {
      "@myshop/products-data-access": [
        "packages/products/data-access/src/index.ts"
      ],
      "@myshop/products-feat-product-list": [
        "packages/products/feat-product-list/src/index.ts"
      ],
      "@myshop/products-ui-product-card": [
        "packages/products/ui-product-card/src/index.ts"
      ],
      ...
    }
  }
}
```

These mappings allow you to have clear imports in your code:

```typescript
// Clear imports showing the domain and type of code you're using
import { ProductListComponent } from '@myshop/products-feat-product-list';
import { ProductCardComponent } from '@myshop/products-ui-product-card';
import { ProductService } from '@myshop/products-data-access';
```

This makes it immediately obvious:

1. Which domain the code belongs to (`products`)
2. What type of code it is (`feat-*`, `ui-*`, `data-access`)
3. What specific feature or component you're importing

## The Application is Your Linking and Deployment Container

![Distribution of apps and libs in an Nx workspace](/blog/images/articles/nx-app-libs-distribution.avif)

In a well-modularized architecture, your application shell should be surprisingly thin. Think of your main application as primarily a composition layer: it imports and coordinates the various domain libraries but contains minimal logic itself.

The ideal application structure has:

- **Thin application shell** - Contains mainly routing configuration, bootstrap logic, and layout composition
- **Domain libraries** - All business logic, UI components, and data access code

At the Angular router level you then import the various feature libraries:

```typescript
...
export const appRoutes: Route[] = [
  {
    path: 'products',
    loadComponent: () =>
      import('@myshop/products-feat-product-list').then(
        (m) => m.ProductsFeatProductListComponent
      ),
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('@myshop/products-feat-product-detail').then(
        (m) => m.ProductsFeatProductDetailComponent
      ),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('@myshop/products-feat-product-reviews').then(
        (m) => m.ProductsFeatProductReviewsComponent
      ),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('@myshop/orders-feat-order-history').then(
        (m) => m.OrdersFeatOrderHistoryComponent
      ),
  },
  {
    path: 'create-order',
    loadComponent: () =>
      import('@myshop/orders-feat-create-order').then(
        (m) => m.OrdersFeatCreateOrderComponent
      ),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('@myshop/checkout-feat-checkout-flow').then(
        (m) => m.CheckoutFeatCheckoutFlowComponent
      ),
  },
  ...
  {
    path: '',
    redirectTo: 'products',
    pathMatch: 'full',
  },
];
```

> This routing configuration is just an example to convey the idea. You can go even further by having the top level domain-entry routing at the application and then domain specific routing is added by the various domain libraries themselves.

When building, Nx compiles all the imported libraries together with your application code, creating a single deployable bundle. The libraries themselves don't produce deployable artifacts, they are implementation details that are consumed by the application.

This pattern makes it much easier to move features between applications later if needed, as your business logic isn't tied to any specific application shell. It also provides a clear mental model: applications are for deployment, libraries are for code organization and reuse.

## When to Create a New Library

There is really no correct or wrong answer here. You should not just go and create a library for each component. That's probably too much. It really depends on how closely related various components or use cases are.

Let's have a look at our current product domain example:

```text
packages/products/
├── data-access/               # API and state management
├── feat-product-list/         # Product listing feature
├── feat-product-detail/       # Product detail feature
├── feat-product-reviews/      # Product reviews feature
├── ui-product-card/           # Reusable product card component
└── ui-product-carousel/       # Product carousel component
```

We could easily just have a single `feat-product-list` which contains both, the list as well as detail view navigation because they might be closely connected. Similarly we could group `ui-product-card` and `ui-product-carousel` into a single `ui-product` library.

A good rule of thumb is to understand and see how often various parts change over time. As your application grows, watch for these signs that your library boundaries might need adjustment:

- **Frequent Cross-Library Changes** - You consistently need to modify multiple libraries for a single feature change
- **Circular Dependencies** - Libraries depend on each other in ways that create circular references
- **Unclear Ownership** - Multiple teams frequently need to coordinate to modify the same library
- **Complex Dependencies** - Simple features require importing from many different libraries or domains
- **Excessive Shared Code** - You find yourself duplicating types and utilities across domains

Remember that library boundaries aren't set in stone - they should evolve with your application. Start with broader boundaries and refine them as you gain insights into how your code changes together.

## Guard Your Boundaries - Automatically Enforcing Clear Dependencies

Once you've established your domain boundaries and architectural layers, you need to ensure they remain intact as your codebase grows. Nx provides powerful tools to enforce these boundaries through module boundary rules that can be configured in your ESLint configuration.

In our example, we use a dual-tagging approach:

1. **Scope tags** (`scope:<name>`): These reflect our domain boundaries, representing different business capabilities like `products`, `orders`, `checkout` etc. They encode our vertical slicing approach.
2. **Type tags** (`type:<name>`): These represent our horizontal architectural layers such as `feature`, `ui`, `data-access`, and `util`.

Here's how the rules are configured:

```typescript
// Type-based rules
{
  sourceTag: 'type:feature',
  onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:data-access']
},
{
  sourceTag: 'type:ui',
  onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:data-access']
},

// Domain-based rules
{
  sourceTag: 'scope:orders',
  onlyDependOnLibsWithTags: ['scope:orders', 'scope:products', 'scope:shared']
},
{
  sourceTag: 'scope:products',
  onlyDependOnLibsWithTags: ['scope:products', 'scope:shared']
}
```

The rules enforce a clear dependency structure:

- **Type rules** ensure architectural layering. For instance, UI components can only depend on other UI components, utilities, and data-access libraries. This prevents circular dependencies and maintains a clean architecture.
- **Domain rules** control which domains can talk to each other. For example, the `orders` domain can depend on `products` (since orders contain products), but `products` cannot depend on `orders`.
- Every domain can depend on `shared` code, but `shared` code can only depend on other shared code, preventing it from becoming a source of circular dependencies.

These rules are enforced at build time through ESLint. If a developer tries to import from a forbidden domain or layer, they'll receive an immediate error, helping maintain the architectural integrity of your application. This allows you to get feedback as early as possible when you run your PR checks on CI.

Note that this tagging structure is just a suggestion - you can adapt it to your specific needs. The key is to have clear, enforceable boundaries that reflect both your technical architecture and your business domains.

Read more about [Nx boundary rules in our documentation](/features/enforce-module-boundaries).

## Automate Your Standards

As your workspace grows, it becomes increasingly important to automate and enforce your team's standards and best practices.

The key to successful automation is finding the right balance. Start with automating the most common patterns that need standardization, and gradually add more automation as patterns emerge. Focus on the standards that provide the most value to your team. These automation capabilities are really here to ensure that your team's standards are not just documented but actively enforced through tooling, making it easier for developers to do the right thing by default.

Nx provides powerful mechanisms to achieve this.

### Custom Generators for Consistent Code Generation

Nx is extensible. As such it allows you to create custom code generators that you can use to encode your organization's standards and best practices.

The generator itself is just a function that manipulates files:

```typescript
import { Tree, formatFiles } from '@nx/devkit';

export default async function (tree: Tree, schema: any) {
  // Add your generator logic here
  // For example, create files, modify configurations, etc.

  await formatFiles(tree);
}
```

Your team can then run these generators through the Nx CLI (via the `nx generate ...` command) or [Nx Console](/getting-started/editor-setup):

For more detailed information about creating custom generators, including how to add options, create files, and modify existing ones, check out the [Local Generators documentation](/extending-nx/recipes/local-generators).

### Leverage Nx Console AI Integration

If you use [Nx Console](/getting-started/editor-setup), Nx's editor extension for VSCode and IntelliJ, then you should already have the latest AI capabilities enabled.

Nx Console [just got some enhancements](/blog/nx-made-cursor-smarter) with the goal of providing contextual information to editor integrated LLMs such as Copilot and Cursor. By providing Nx workspace metadata to these models they are able to provide much more valuable, context specific information and perform actions via the Nx CLI.

You can find more detailed information [in our documentation](/features/enhance-AI) about how to enable and use the capabilities.

## Single-app vs Multiple App Deployment

Until now we didn't really talk about a monorepo at all. We have a single Angular application and modularized its features into dedicated projects. The projects themselves are really just to encapsulate their logic and structure our application. While we could make them buildable by themselves (mostly for leveraging speed gains from incremental building) most of them do not have build targets. You can test and lint them independently but with a standalone Angular application, all your features are bundled and deployed together as a single unit.

While this approach is simple and works well for smaller applications, there are several scenarios where you might want to split your application:

- **Different scaling requirements**: Your customer-facing store might need high availability and scalability to handle thousands of concurrent users, while your admin interface serves a much smaller number of internal users
- **Resource optimization**: Not all users need all features. For example, administrative features like inventory management are only needed by staff members
- **Independent deployment cycles**: Different parts of your application might need to evolve at different speeds. Your admin interface might need frequent updates for internal tools, while your customer-facing store remains more stable
- **Security considerations**: Keeping administrative features in a separate application can reduce the attack surface of your customer-facing application

As your application grows, you might want to split it into multiple applications - perhaps separating your customer-facing storefront from your administrative interface. The first step is to convert your standalone application into a monorepo structure. Nx comes with a `convert-to-monorepo` command to do exactly that:

```shell
nx g convert-to-monorepo
```

This command moves your existing application into an `apps` directory and adjusts any configuration that needs to be adjusted for supporting multiple side-by-side applications in a monorepo setup.

> Note: If you're looking for a NPM/Yarn/PNPM workspaces based monorepo setup, then make sure to read our article about the [New Nx Experience for TypeScript Monorepos](/blog/new-nx-experience-for-typescript-monorepos).

### Creating Multiple Applications

Once you have a monorepo structure, you can create additional applications that share code with your original app. For example, you might want to create an admin application:

```shell
nx g @nx/angular:app admin
```

Now you can move administrative features (like inventory management) to the new admin app by importing libraries relevant to the new app (such as for example the inventory management libraries).

Here's what the new structure could look like:

```text
myshop/
├── apps/
│   ├── shop/          # Customer-facing storefront (high availability needed)
│   └── admin/         # Administrative interface (internal users only)
└── packages/
    ├── products/      # Shared product domain
    ├── orders/        # Shared order management
    ├── checkout/      # Shop-specific checkout process
    └── shared/        # Common utilities and components
```

You can see how the already modular structure allows you to adjust your application structure and re-link some of the packages into the new application. Something that would have otherwise been a major undertaking.

Similarly to how we now have two applications that can be deployed and scaled independently, we could go even further and convert it into a microfrontend approach. But more on that in another article.

## Scaling Development

Obviously as your codebase keeps growing you need to have the tooling support that helps keep it sustainable. In particular CI might become a concern as the number of projects grows. For that purpose Nx has several features to keep your CI fast and efficient:

- **[Remote Caching (Nx Replay)](/ci/features/remote-cache)** ensures your code is never rebuilt or retested unnecessarily.
- **[Distributed Task Execution (Nx Agents)](/ci/features/distribute-task-execution)** intelligently allocates tasks across multiple machines.
- **[Atomizer](/ci/features/split-e2e-tasks)** helps manage growing test suites by automatically splitting them into more fine-grained runs and by leveraging Nx Agents to parallelize them across machines.
- **[Flaky Task Detection](/ci/features/flaky-tasks)** identifies flaky tasks (often automated unit or e2e tests) and re-runs them automatically for you.

One of the key advantages of using Nx is that it's not limited to just Angular either. As your application grows, you might need to:

- Add a documentation site using static site generators like [Analog](https://analogjs.org/)
- Create landing pages with Next.js or Astro
- Build backend services with NestJS or Express
- Add specialized tools for specific business needs

Nx supports all these scenarios while maintaining the ability to share code between different technologies. For example, you could:

```text
myshop/
├── apps/
│   ├── shop/          # Main Angular application
│   ├── admin/         # Angular admin interface
│   ├── docs/          # Analog documentation site
│   ├── landing/       # Next.js marketing site
│   └── api/          # NestJS backend
└── packages/
    ├── products/     # Shared product domain (used by both front and backend)
    ├── orders/       # Shared order management
    └── shared/       # Common utilities and types
```

The modular structure we established earlier makes it easy to share types and interfaces between frontend and backend and reuse business logic across different applications.

## Wrapping up

Building maintainable Angular applications at scale requires thoughtful architecture decisions and proper tooling support. We've covered several key aspects:

1. **Domain-Driven Structure**: Moving from traditional layered architectures to organizing code around business domains creates clearer boundaries and better maintainability.

2. **Incremental Adoption**: Starting small with a standalone application and growing into a more complex structure as needed, rather than over-engineering from the start.

3. **Clear Boundaries**: Using projects/libraries to create explicit boundaries between different parts of your application, with automated enforcement through module boundary rules.

4. **Automation & Standards**: Leveraging custom generators and AI-enhanced tooling to maintain consistency and best practices across your codebase.

5. **Scalability Options**: Understanding when and how to evolve from a single application to multiple applications or even microfrontends, while maintaining code sharing and reusability.

Remember that architecture is not a one-time decision but an evolving process - start with clear boundaries and good practices, then adapt as your application and team's needs grow. The key to success lies in having the proper tooling and automation in place to support you as your application grows.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
