---
title: 'Nx Cloud Conformance: Automate Consistency Across Your Organization'
slug: nx-cloud-conformance-automate-consistency
authors: ['Philip Fulcher']
tags: ['nx-cloud', 'polygraph', 'enterprise']
cover_image: /blog/images/2025-07-16/header.avif
description: 'Learn how Nx Cloud Conformance eliminates manual compliance tracking and enforces coding standards across your entire organization. See how to solve real problems like inconsistent code review processes with technology-agnostic rules.'
youtubeUrl: https://www.youtube.com/watch?v=F645Elxy1dw
---

If you've got consistency problems in your organization, we've got the solution for you. **Conformance** is a powerful new tool within Nx Cloud's Polygraph suite that brings automated consistency and maintainability to your entire organization—regardless of what technology stack you're using.

Say goodbye to spreadsheets for tracking compliance. Get those maintenance items out of your backlog. It's time to solve everything with one tool.

{% toc /%}

## The Problem: Manual Compliance Is Killing Your Productivity

Picture this: Your director of engineering asks, "Why does it take so long to get a PR merged around here?" Sound familiar?

After some investigation, you discover that developers are struggling to get code reviews because not every PR gets assigned to someone. Most of the time, developers are pinging colleagues in Slack, hoping someone can review their code that day. This creates bottlenecks, delays releases, and frustrates your team.

A CODEOWNERS file can solve this problem by automatically assigning reviewers based on directory ownership. But here's the catch: **even good solutions need to be used consistently across your organization.**

How do you enforce the use of CODEOWNERS files across different teams, different repositories, and different technology stacks? How do you ensure they follow your organization's standards without manually checking each repository?

This is where **Conformance** comes in.

## What Is Conformance?

[Conformance](/nx-enterprise/powerpack/conformance) is part of Nx Cloud's Polygraph suite: a collection of features that extend the benefits of Nx workspaces to your entire organization. Conformance allows you to write **technology-agnostic rules** that you can enforce across your organization, no matter what technology you're using.

Think of it as automated governance for your entire codebase. Platform teams can now:

- **Eliminate manual compliance tracking** - No more spreadsheets or manual audits
- **Enforce standards at scale** - Write rules once, apply them everywhere
- **Schedule future enforcement** - Set deadlines for compliance transitions

## Real-World Example: Enforcing CODEOWNERS Standards

Let's solve this code review problem. We'll create a conformance rule that ensures every repository has a properly configured CODEOWNERS file.

First, we need to define our requirements:

1. **A CODEOWNERS file must exist** at the root of the repository
2. **It should start with a catch-all rule** so unassigned directories get reviewers
3. **Every rule should include at least one team** so PRs are assigned to groups of people to ensure coverage

### Setting Up Your Conformance Rules

You have two options for storing conformance rules:

**Create a new workspace from the `@nx/conformance` preset**

1. Create a new example workspace with the `@nx/conformance` preset: `npx create-nx-workspace WORKSPACE_NAME --preset=@nx/conformance`
2. Connect your new example workspace to Nx Cloud by following the instructions during `create-nx-workspace`.
3. Run `npx nx login` in your new example workspace.
4. Publish your rules using the `publish-conformance-rules` target on the `conformance-rules` project: `npx nx publish-conformance-rules`

**Add conformance rules to an existing workspace**

1. Open your existing Nx workspace.
2. Add the `@nx/conformance` plugin: `npx nx add @nx/conformance`.
3. [Set up a new library project](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud) for your conformance rules.
4. Run `npx nx login` in your workspace.
5. Be sure to bundle your rules using the `@nx/conformance:bundle-rules` executor (covered in the above docs).
6. Publish the rules using the `nx-cloud` CLI: `npx nx-cloud publish-conformance-rules /path/to/rule-outputs`.

For our example today, we'll create a new workspace named `stellar-conformance`:

```shell
npx create-nx-workspace@latest stellar-conformance --preset=@nx/conformance
```

This creates a new Nx workspace specifically for managing your organization's conformance rules. The preset includes example rules and the structure you need to get started.

### Writing Your First Conformance Rule

We'll use the `@nx/conformance:conformance-rule` generator to create our CODEOWNERS rule:

```shell
npx nx g @nx/conformance:create-rule codeowners-lint

 NX  Generating @nx/conformance:create-rule

✔ Which directory do you want to create the rule directory in? · packages/conformance-rules/src
✔ What category does this rule belong to? · consistency
✔ What is the description of the rule? · Enforce existence and style of CODEOWNERS file
CREATE packages/conformance-rules/src/codeowners-lint/index.ts
CREATE packages/conformance-rules/src/codeowners-lint/schema.json
```

You'll be asked for the name, description, and directory for your new rule. You'll also be asked for a category. Choose from:

- **Consistency** - Enforcing uniform standards across workspaces
- **Maintainability** - Making code easier to maintain and modify
- **Reliability** - Ensuring dependable and stable code behavior
- **Security** - Protecting against vulnerabilities and risks

For our CODEOWNERS rule, we'll choose `consistency` since it helps make the code review process more consistent.

### Implementing the Rule Logic

Here's what our CODEOWNERS conformance rule looks like:

```typescript
import { createConformanceRule, ConformanceViolation, ConformanceRuleResultSeverity } from '@nx/conformance';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'path';
import { readFileSync } from 'fs';

export default createConformanceRule({
  name: 'codeowners-lint',
  category: 'consistency',
  description: 'Check for existence and format of CODEOWNERS file',
  implementation: async (context) => {
    // Check if CODEOWNERS file exists

    let codeowners;

    try {
      // try to read CODEOWNERS file from the root of the repo
      codeowners = readFileSync(
        join(workspaceRoot, 'CODEOWNERS'),
        'utf-8'
      );
    } catch (error) {
      // if not found, return high severity violation
      return {
        severity: 'high',
        details: {
          violations: [
            {
              workspaceViolation: true,
              message: 'CODEOWNERS file is missing',
            },
          ],
        },
      };
    }

    // Check if CODEOWNERS file is empty

    const violations: ConformanceViolation[] = [];

    // iterate through CODEOWNERS file and remove blank or commented lines
    const codeownersLines = codeowners
      .split('\n')
      .filter(
        (line: string) => line.trim().length > 0 && !line.startsWith('#')
      );

    if (codeownersLines.length === 0) {
      // if there are no lines left, return high severity violation
      return {
        severity: 'high',
        details: {
          violations: [
            {
              workspaceViolation: true,
              message: 'CODEOWNERS file is empty',
            },
          ],
        },
      };
    }

    // Check if CODEOWNERS file has valid format

    const severity: ConformanceRuleResultSeverity = 'medium';

    // check that first rule starts with a wildcard
    if (!codeownersLines.at(0)?.startsWith('*')) {
      // if it doesn't, add medium severity violation to report
      violations.push({
        workspaceViolation: true,
        message: 'CODEOWNERS file should start with a wildcard (*) pattern',
      });
    }

    // check that each rule contains the org name, indicating a team assignment
    if (
      codeownersLines.some(
        (line: string) => !line.includes('@stellar-dynamics')
      )
    ) {
      // if it doesn't, add low severity violation to report
      violations.push({
        workspaceViolation: true,
        message:
          'CODEOWNERS rules should contain at least one @stellar-dynamics team',
      });
    }

    return {
      severity,
      details: {
        violations,
      },
    };
  },
});
```

### Testing Your Rule Locally

![Screenshot of result of running the rule](/blog/images/2025-07-16/results.avif)

Before publishing, test your rule locally by adding it to your `nx.json`:

```json
{
  "conformance": {
    "rules": [
      {
        "rule": "./packages/conformance-rules/src/codeowners-lint"
      }
    ]
  }
}
```

Run the rule:

```shell
npx nx conformance check
```

### Retrieve a personal access token

Because publishing Conformance rules is a privileged action, you'll need to have a [personal access token](/ci/recipes/security/personal-access-tokens). Run `npx nx login` to retrieve this.

### Publishing Rules to Nx Cloud

Once you're satisfied with your rule, publish it to Nx Cloud:

```shell
nx publish-conformance-rules conformance-rules
```

This makes your rule available to your entire organization through Nx Cloud.

## Applying Rules Organization-Wide

After publishing, head to your Nx Cloud dashboard and navigate to the Conformance section. You'll see your newly published rule ready to be configured.

### Rule Configuration Options

![Screenshot of scheduling status](/blog/images/2025-07-16/scheduling-status.avif)

When configuring a rule, you have three status options:

- **Enforced** - Rule runs and fails builds when violations are found
- **Evaluated** - Rule runs and reports violations but won't fail builds (perfect for gradual rollout)
- **Disabled** - Rule is turned off completely

You can start with "evaluated" mode to see current compliance levels, then schedule automatic transition to "enforced" mode with a specific deadline.

### Running Rules with Custom Workflows

![Screenshot of custom workflows](/blog/images/2025-07-16/custom-workflows.avif)

Here's where Conformance really shines. Instead of requiring every team to add conformance checks to their CI pipelines, you can use **[Custom Workflows](/ci/recipes/enterprise/custom-workflows)** to run these checks automatically.

Custom Workflows allow you to:

- **Run conformance checks on any repository** without requiring local configuration changes
- **Schedule recurring checks** (daily, weekly, etc.) to maintain compliance
- **Apply rules to non-Nx repositories** through [metadata-only workspaces](/ci/recipes/enterprise/metadata-only-workspace)
- **Collect compliance data** without impacting individual team workflows

### Supporting Non-Nx Repositories

One of the most powerful aspects of Conformance is that it works with **any repository**, even those that don't use Nx. You can connect legacy repositories as [metadata-only workspaces](/ci/recipes/enterprise/metadata-only-workspace) and apply the same conformance rules.

This means your platform team can enforce standards across your entire organization's codebase, regardless of the underlying technology or build system.

## The Platform Engineering Superpower

![Screenshot of results of conformance rule across multiple workspaces](/blog/images/2025-07-16/rule-results.avif)

Conformance transforms how platform teams operate. Instead of manually tracking compliance across dozens or hundreds of repositories, a single platform engineer can:

1. **Write a rule once** in TypeScript (but apply it to any technology)
2. **Publish it to Nx Cloud** with a single command
3. **Apply it organization-wide** through the dashboard
4. **Get automated compliance reporting** without any work from development teams

No more spreadsheets. No more manual audits. No more begging developers to add something to their backlog.

## Beyond CODEOWNERS: Endless Possibilities

While we've focused on CODEOWNERS files, Conformance can enforce any organizational standard:

- **Security standards** - Ensure all repos run security audits and address vulnerabilities
- **Dependency management** - Keep third-party libraries up to date across your entire tech stack
- **Tool standardization** - Enforce consistent linting rules, formatting, and build configurations
- **Architecture compliance** - Ensure new projects follow established patterns and structures
- **Documentation requirements** - Verify that READMEs, API docs, and other documentation exist

## From Reactive to Proactive

Conformance represents a fundamental shift from reactive to proactive organizational management. Instead of discovering problems when they cause production issues, you can:

- **Prevent issues before they occur** with automated compliance checking
- **Maintain consistency** across all repositories without manual intervention
- **Scale your platform team's impact** exponentially across your organization
- **Reduce the burden on development teams** while improving overall code quality

## Getting Started Today

Conformance is available now for all **Nx Enterprise** customers as part of the Polygraph suite. If you're an existing Enterprise customer, you can start using Conformance immediately in your Nx Cloud dashboard.

The combination of technology-agnostic rules, automated enforcement, and organization-wide visibility makes Conformance a game-changer for platform teams looking to scale their impact.

{% call-to-action size="lg" title="Ready to automate your consistency?" url="/contact/sales" icon="nxcloud" description="Let's talk about how Nx Enterprise and Conformance can transform your development workflow." /%}

## What's Next?

Conformance is just the beginning. As part of the Polygraph suite, it works alongside:

- **Workspace Graph** - Visualize dependencies across all your repositories
- **Custom Workflows** - Run scheduled tasks and automation beyond traditional CI
- **Metadata-Only Workspaces** - Include non-Nx repositories in your organizational tooling

Together, these features bring the power of monorepo-level visibility and efficiency to your entire organization, regardless of how many repositories you have.

Learn more:

- 📄 [Conformance Documentation](/ci/recipes/enterprise/polygraph#conformance)
- 🌩️ [Nx Cloud](/nx-cloud)
- 🌩️ [Nx Cloud Live demo](https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview)
- 👩‍💻 [Nx Enterprise](/enterprise)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
