---
title: Nx Enterprise - Polygraph
description: 'Scale development practices across multiple repositories with cross-repository visibility, automated standards enforcement, and zero-friction adoption for existing codebases.'
---

# What is Polygraph?

No longer needing to choose between monorepo or poly-repo.
Polygraph is Nx Cloud's suite of enterprise features designed to help organizations scale their development practices across multiple repositories. These features extend the powerful benefits of an Nx workspace to multi-workspace environments and take Nx Cloud beyond CI.

## Features

- **Cross-repository visibility** through the [Workspace Graph](/ci/enterprise/polygraph#workspace-graph)
- **Organizational standards enforcement** via [Conformance](/ci/enterprise/polygraph#conformance) rules
- **Automated compliance checking** across all repositories powered by [Custom Workflows](/ci/enterprise/polygraph#custom-workflows)

All of this can be enabled with **Zero-friction adoption** for existing repositories without requiring teams to adopt Nx or modify their workflows. With these tools, a platform engineering team is able to affect positive change across 100+ repos quickly in automated fashion, instead of being stuck with manual processes taking multiple months.

{% callout type="note" title="Nx Enterprise" %}
Polygraph features require an Nx Enterprise license. [Reach out to the team](/contact/sales?utm-campagin=polygraph) if you're interested in exploring enterprise!
{%/callout %}

## Use Cases

- **🔍 See the Big Picture**: Visualize dependencies across your entire organization, not just within individual repos. Understand organizational structure at a glance and make informed decisions about architecture and team boundaries.

- **📋 Enforce Standards at Scale**: Define and automatically enforce coding standards, tooling requirements, and best practices across 10s or 100s of repositories. Eliminate manual audits and spreadsheet tracking, saving platform teams hundreds of hours per quarter.

- **🛡️ Proactive Auditing and Monitoring**: Run your security tools, or any tool you prefer, on regular intervals to detect and address vulnerabilities quickly, even in repositories that haven't been touched in months.

## Workspace Graph

Visualizes dependencies between all repositories in your organization, providing visibility into what repo depends other repos within the organization.

- **Identify consumers of shared libraries**: Enable confident API changes and deprecations by knowing exactly who will be affected
- **Understand organizational code structure at a glance**: Help leadership make informed decisions about architecture and team boundaries
- **Impact analysis before breaking changes**: See the blast radius of changes across your entire tech stack

![Polygraph Workspace Graph](/nx-cloud/enterprise/images/workspace-graph.avif)

Quickly onboard new workspaces with the [GitHub VCS integration](/ci/features/github-integration#access-control)

![GitHub VCS onboarding](/nx-cloud/enterprise/images/connect-polygraph-to-repos.avif)

## Conformance

Define and enforce consistency, maintainability, reliability and security standards across your organization.

- **Gradual rule rollout**: Give teams time to fix issues, at a schedule time, change a rule from _evaluated_ to _enforced_ automatically.
- **Workspace coverage**: Understand which repositories and teams are subject to which rules
- **Compliance control**: Make sure teams are keeping up with organization wide standards that they can't disable when using Nx Cloud as the registry for rules.

![CIPE conformance table view](/nx-cloud/enterprise/images/cipe-conformance-report.avif)

See an overview of all rules set for the workspace and their current status

![Conformance rules run Table](/nx-cloud/enterprise/images/conformance-rule-results-table.avif)
![Conformance rules meta table](/nx-cloud/enterprise/images/conformance-rules-table-run-meta.avif)

You can setup notifications for teams, so they're always kept in the loop

![Conformance notifications](/nx-cloud/enterprise/images/conformance-notifications.avif)

Ready to write your first conformance rule? [See our conformance rule guide](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud) to start.

## Custom Workflows

Run scheduled tasks for your needs across all or a selection of repositories.

- **Scheduled execution**: Run checks on your schedule, not just when code changes—especially valuable for rarely updated repositories
- **Notifications for failures**: Keeps responsible parties informed without requiring them to constantly check dashboards
- **Regular compliance monitoring**: Keep security audits current even for repositories with infrequent changes
- **Automated data collection**: Ensures your dashboards and reports always reflect current state without manual intervention

Custom workflows enable proactive monitoring and automated compliance checking, ensuring your dashboards always reflect the current state without manual intervention.

![custom workflows page](/nx-cloud/enterprise/images/custom-workflow-repeating-workflows.avif)

## Metadata Only Workspaces

Gain quick visibility across your organizations repositories without needing to migrate each repository as an Nx Workspace.
Easily onboard any repository as a **metadata-only** to immediately start contributing to the [Workspace Graph](/ci/enterprise/polygraph#workspace-graph).
Metadata-only workspaces can still leverage [custom workflows](/ci/enterprise/polygraph#custom-workflows) and [conformance rules](/ci/recipes/enterprise/conformance/configure-conformance-rules-in-nx-cloud).

Read more about [onboarding a metadata only workspace](/ci/enterprise/metadata-only-workspaces).

## FAQ

**Q: Do I need to migrate other teams to Nx to use Polygraph?**

No, Polygraph works with any repository through [metadata-only workspaces](/ci/enterprise/metadata-only-workspaces).

**Q: How does pricing work?**

Existing Nx Cloud Enterprise workspaces include Polygraph at no extra cost. Additional fees apply only for metadata-only workspaces and when consuming compute credits.

**Q: Can I enforce rules gradually?**

Yes, rules can be set to _evaluate_ mode before enforcement, and you can schedule future enforcement dates or outright disable the rule.

**Q: What are the different conformance rule statuses?**

- **Evaluated**: Rule runs and reports violations in dashboards and notifications, but won't fail CI builds; therefore, it's perfect for introducing new standards gradually or giving teams time to prepare for upcoming changes.

- **Enforced**: Rule runs and creates errors that will fail CI builds when violations are found, ensuring immediate compliance. You can schedule rules to automatically transition from evaluated to enforced on a specific date.

- **Disabled**: Rule is turned off and won't run in any workspaces.

**Q: If I have Powerpack, can I use Conformance with Nx Cloud?**

Powerpack enables conformance rules within individual workspaces. Polygraph extends this by publishing rules across your entire organization, configuring them across multiple workspaces, and tracking results at the organizational level. An Nx Cloud Enterprise license is required for Polygraph features.

{% callout type="check" title="Ready to start using Polygraph? " %}
Existing enterprise customer should contact their assigned developer productivity engineer to get setup. Otherwise, reach out to us about [Nx Enterprise](/enterprise) to unlock Polygraph's organizational scaling features.
{%/callout %}
