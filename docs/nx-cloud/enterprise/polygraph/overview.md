---
title: Nx Enterprise - Polygraph
description: 'Scale development practices across multiple repositories with cross-repository visibility, automated standards enforcement, and zero-friction adoption for existing codebases.'
---

# Nx Enterprise - Polygraph

Polygraph is Nx Cloud's suite of enterprise features designed to help organizations scale their development practices across multiple repositories. These features extend the powerful benefits of an Nx workspace to multi-workspace environments and take Nx Cloud beyond CI.

Polygraph brings the power of monorepo-level visibility and efficiency to your entire organization, regardless of how many repositories you have.

## What is Polygraph?

Polygraph is a collection of features within Nx Cloud that enables:

- **Cross-repository visibility** through the Workspace Graph
- **Organizational standards enforcement** via Conformance rules
- **Automated compliance checking** across all repositories
- **Zero-friction adoption** for existing repositories without requiring teams to adopt Nx or modify their workflows

## Key Value Propositions

### 🔍 See the Big Picture
Visualize dependencies across your entire organization, not just within individual repos. Understand organizational code structure at a glance and make informed decisions about architecture and team boundaries.

### 📋 Enforce Standards at Scale
Define and automatically enforce coding standards, tooling requirements, and best practices across 10s or 100s of repositories. Eliminate manual audits and spreadsheet tracking, saving platform teams hundreds of hours per quarter.

### 🛡️ Proactive Security Monitoring
Run npm audit or third-party auditing tools on regular intervals to detect and address vulnerabilities quickly, even in repositories that haven't been touched in months.

### ⚡ Zero-friction Adoption
Onboard existing repositories without requiring teams to adopt Nx or modify their workflows. Include legacy repositories in organizational standards immediately.

### 🚀 Platform Engineering Leverage
Enable a single platform engineer to affect positive change across 100+ repositories in hours, not months. Transform from manual repo-by-repo management to automated organization-wide governance.

## Core Features

### Workspace Graph

The Polygraph workspace graph visualizes dependencies between all workspaces and repositories in your organization.

**Key benefits:**
- **Identify consumers of shared libraries**: Enable confident API changes and deprecations by knowing exactly who will be affected
- **Understand organizational code structure at a glance**: Help leadership make informed decisions about architecture and team boundaries
- **Impact analysis before breaking changes**: See the blast radius of changes across your entire tech stack

![Polygraph Workspace Graph](/docs/nx-cloud/enterprise/polygraph/screenshots/workspace-graph-overview.png)

**Use cases:**
- Impact analysis before making breaking changes
- Identifying which apps consume a shared library
- Understanding organizational technical architecture

### Conformance

Define and enforce consistency, maintainability, reliability and security standards across all repositories.

#### Conformance Rules Overview

The conformance overview table provides a comprehensive dashboard showing all active rules across your organization. This centralized view allows platform teams to track rule adoption, identify compliance gaps, and manage the rollout of new standards across multiple workspaces.

![Conformance Rules Overview Table](/docs/nx-cloud/enterprise/polygraph/screenshots/conformance-overview-table.png)

**Key features:**
- **Rule status tracking**: See which rules are evaluated, enforced, or disabled across different workspaces
- **Compliance metrics**: Monitor adoption rates and violation counts organization-wide
- **Workspace coverage**: Understand which repositories and teams are subject to which rules
- **Violation trending**: Track improvement or degradation in compliance over time

#### CI Pipeline Integration

Conformance rules are seamlessly integrated into your CI pipeline executions, providing real-time feedback on compliance during the development process.

![CIPE Conformance Overview](/docs/nx-cloud/enterprise/polygraph/screenshots/cipe-conformance-overview.png)

**Key benefits:**
- **Automated compliance checking**: Eliminates manual audits and spreadsheet tracking
- **Gradual rollout with "evaluate" before "enforce" statuses**: Allows teams to see impact and prepare for changes, reducing friction and preventing broken builds
- **Scheduled enforcement for planned migrations**: Provides clear deadlines and accountability, ensuring organization-wide initiatives actually complete on time
- **Cross-repository consistency**: Apply the same standards across Nx and non-Nx repositories

**Use cases:**
- Ensuring all repos use specific linting rules
- Tracking Angular/React version migrations
- Enforcing security standards (npm audit compliance)

### Metadata-Only Workspaces

Include non-Nx repositories in Polygraph features without requiring full Nx adoption across teams.

**Key benefits:**
- **Zero changes required to existing repos**: Removes adoption barriers and political friction, allowing immediate value without requiring team buy-in
- **Immediate visibility and compliance checking**: Provides instant insights into previously dark areas of your codebase

**Use cases:**
- Including legacy repositories in organizational standards
- Gradual Nx adoption strategy
- Works with mixed technology stack organizations

### Custom Workflows

Run scheduled tasks to gather data and run checks automatically.

**Key benefits:**
- **Automated data collection**: Ensures your dashboards and reports always reflect current state without manual intervention
- **Email notifications for failures**: Keeps responsible parties informed without requiring them to constantly check dashboards
- **Regular compliance monitoring**: Keep security audits current even for repositories with infrequent changes

**Use cases:**
- Set up daily conformance checks to identify problem areas
- Reduce time and hassle of following up manually with teams to update a new library
- Running security audits daily for peace of mind in repositories you haven't touched in months

## Requirements

- **Nx Cloud** subscription
- **Enterprise plan**

**Recommended for bulk onboarding:**
- GitHub integration

## Pricing & Availability

### Included Features
All Polygraph features are included for Nx Cloud Enterprise workspaces at no additional cost. Some number of initial metadata-only workspaces are included per contract.

### Additional Costs
- Additional metadata-only workspaces (per workspace)
- Custom workflow credit consumption (minimal)

## Coming Soon

- AI-powered refactoring capabilities
- Self-healing CI integration
- Enhanced workspace graph navigation
- Additional VCS provider support

## FAQ

**Q: Do I need to migrate other teams to Nx to use Polygraph?**
A: No, Polygraph works with any repository through metadata-only workspaces.

**Q: How does pricing work?**
A: Existing Nx Cloud Enterprise workspaces include Polygraph at no extra cost. Additional fees apply only for metadata-only workspaces and when consuming compute credits.

**Q: Can I enforce rules gradually?**
A: Yes, rules can be set to "evaluate" mode before enforcement, and you can schedule future enforcement dates.

**Q: What are the different conformance rule statuses?**
A: **Evaluated**: Rule runs and reports violations in dashboards and notifications, but won't fail CI builds—perfect for introducing new standards gradually or giving teams time to prepare for upcoming changes.

**Enforced**: Rule runs and creates errors that will fail CI builds when violations are found, ensuring immediate compliance. You can schedule rules to automatically transition from evaluated to enforced on a specific date.

**Disabled**: Rule is turned off and won't run in any workspaces.

**Q: If I have Powerpack, can I use Conformance with Nx Cloud?**
A: Powerpack enables conformance rules within individual workspaces. Polygraph extends this by publishing rules across your entire organization, configuring them across multiple workspaces, and tracking results at the organizational level. An Nx Cloud Enterprise license is required for Polygraph features.

## Get Started

Ready to start using Polygraph? Contact your Nx representative or [upgrade to Enterprise](/enterprise) to unlock Polygraph's organizational scaling features.

## Feature Overview

### Workspace Graph

The Polygraph workspace graph provides a unified view of dependencies, relationships, and architectural patterns across all your connected repositories and workspaces. Unlike traditional project graphs that show only a single workspace, the Polygraph workspace graph extends visibility across your entire organization's codebase ecosystem.

Key capabilities include:

- **Cross-repository dependency tracking**: Visualize how projects in different repositories depend on each other
- **Impact analysis**: Understand the blast radius of changes before they're made
- **Architectural insights**: Identify patterns, bottlenecks, and opportunities for improvement across your entire tech stack
- **Team and ownership visualization**: See which teams own which parts of the architecture and how they interconnect

![Polygraph Workspace Graph](/docs/nx-cloud/enterprise/polygraph/screenshots/workspace-graph-overview.png)

The interactive graph allows you to filter by teams, technologies, or specific repositories, making it easy to focus on the areas most relevant to your current work or decision-making process.

### Conformance

Polygraph's conformance features enable organizations to define, enforce, and monitor adherence to coding standards and architectural guidelines across all connected repositories. This goes beyond traditional linting by providing organizational-level visibility and control over code quality and consistency.


The conformance overview table provides a comprehensive dashboard showing all active rules across your organization. This centralized view allows platform teams to track rule adoption, identify compliance gaps, and manage the rollout of new standards across multiple workspaces.

![Conformance Rules Overview Table](/docs/nx-cloud/enterprise/polygraph/screenshots/conformance-overview-table.png)

Key features of the overview include:
- **Rule status tracking**: See which rules are evaluated, enforced, or disabled across different workspaces
- **Compliance metrics**: Monitor adoption rates and violation counts organization-wide
- **Workspace coverage**: Understand which repositories and teams are subject to which rules
- **Violation trending**: Track improvement or degradation in compliance over time


Conformance rules are seamlessly integrated into your CI pipeline executions, providing real-time feedback on compliance during the development process. The CIPE overview shows how conformance checks are performing across all your builds and deployments.

![CIPE Conformance Overview](/docs/nx-cloud/enterprise/polygraph/screenshots/cipe-conformance-overview.png)

This integration enables:
- **Automated enforcement**: Rules can automatically fail builds when violations are detected
- **Gradual rollout**: Use "evaluate" mode to gather data before enforcement
- **Scheduled transitions**: Automatically move from evaluation to enforcement on specified dates
- **Cross-repository consistency**: Apply the same standards across Nx and non-Nx repositories



## FAQ

**Q: Do I need to migrate other teams to Nx to use Polygraph?**
A: No, Polygraph works with any repository through [metadata-only workspaces](/ci/enterprise/metadata-only-workspace).

**Q: How does pricing work?**
A: Existing Nx Cloud Enterprise workspaces include Polygraph and at no extra cost. Additional fees apply only for metadata-only workspaces and when consuming compute credits.

**Q: Can I enforce rules gradually?**
A: Yes, rules can be set to "evaluate" mode before enforcement, and you can schedule future enforcement dates.

**Q: What are the difference conformance rule statuses?**
A: **Evaluated**: Rule runs and reports violations in dashboards and notifications, but won't fail CI builds—perfect for introducing new standards gradually or giving teams time to prepare for upcoming changes.

**Enforced**: Rule runs and creates errors that will fail CI builds when violations are found, ensuring immediate compliance. You can schedule rules to automatically transition from evaluated to enforced on a specific date.

**Disabled**: Rule is turned off and won't run in any workspaces.

**Q: If I have Powerpack, can I use Conformance with Nx Cloud?**

A: Powerpack enables conformance rules within individual workspaces. Polygraph extends this by publishing rules across your entire organization, configuring them across multiple workspaces, and tracking results at the organizational level. An Nx Cloud Enterprise license is required for Polygraph features.
