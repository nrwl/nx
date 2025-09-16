---
title: Custom Workflows
description: 'Run scheduled tasks to gather data and run checks automatically across your organization with automated data collection and proactive monitoring.'
---

## What are Custom Workflows?

Custom Workflows enable you to run scheduled tasks and automated checks across all or a selection of repositories in your organization. This powerful feature extends beyond traditional CI/CD by creating an avenue to proactively monitor and automate compliance checking, ensuring your organization's standards are maintained consistently.

Custom Workflows are scheduled automation that run independently of your CI/CD pipelines. Unlike traditional workflows that only trigger when code changes, Custom Workflows run on your schedule—whether that's daily, weekly, or at any interval you define. This is especially valuable for repositories that are rarely updated but still need regular monitoring for security vulnerabilities, compliance checks, or organizational standards.

### Real-World Value

Some companies have repositories that don't have CI pipelines, or changes are so infrequent that security data would be seriously out of date. For example, running a security audit daily gives you peace of mind in a repository you haven't touched in 6 months—just because you didn't make a code change doesn't mean it's not vulnerable to newly discovered threats.

## Key Use Cases

- **Security monitoring**: Run `npm audit` or third-party security tools on regular intervals to detect vulnerabilities
- **Compliance tracking**: Ensure all repositories meet organizational standards for linting, testing, or documentation
- **Dependency management**: Track library versions and identify outdated dependencies across your organization
- **Data collection**: Gather metrics and insights from repositories that rarely see code changes
- **Proactive maintenance**: Identify technical debt and maintenance issues before they become critical

{% callout type="note" title="Nx Enterprise Required" %}
Custom Workflows are available as part of Nx Enterprise and [consume compute credits](/pricing#resource-classes). [Reach out to learn more about Nx Enterprise](/enterprise)
{%/callout %}

## Access Custom Workflows

Navigate to your organization's Custom Workflows page in Nx Cloud. You'll see an overview of all the current workflows. Polygraph and Conformance based workflows are currently available. In a future release of Nx Cloud, custom workflow creation will be released.

![Org Overview](/nx-cloud/enterprise/images/org-overview.avif)

## Apply a workflow

{% tabs %}
{% tab label="Polygraph workflows" %}
Polygraph workflows are designed to grab the latest graph information from Nx to keep the Workspace graph up to date for your organization.
{% /tab %}
{% tab label="Conformance workflows" %}
Conformance based workflows allow running the pre-defined conformance rules for a given workspace. Once setup you can also force a rerun of these conformance rules as desired.
{% /tab %}
{% /tabs %}

1. Click **Polygraph** or **Conformance** for your repeating workflows provided by Nx Cloud

- if using **Conformance** action, then make sure you've already configured and [published a conformance rule](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud)
  ![Polygraph overview](/nx-cloud/enterprise/images/org-polygraph-overview.avif)

2. Click **Apply workflow** and select the workspace you wish to use for the custom workflow.
   ![Apply Workflow](/nx-cloud/enterprise/images/apply-workflow.avif)

## Configure Workflow Settings

In the custom workflows overview, select the **Launch Templates** tab, and assign the launch template you wish to use for the given workspace.

![Custom Workflow Template Assignment](/nx-cloud/enterprise/images/custom-workflow-assign-template.avif)

You can also upload your own custom launch template by clicking **Configure templates**. Read more about [custom launch templates](/ci/reference/launch-templates)

![Configure custom launch template](/nx-cloud/enterprise/images/custom-workflow-configure-launch-template.avif)

## Perform First run

Back in the custom workflow action page, you can manually trigger a run via clicking **Force**
![Polygraph overview](/nx-cloud/enterprise/images/org-polygraph-overview.avif)

Once your workflow has run, you can view its most recent execution via clicking **View Latest Execution**. If you've used with [Nx Agents](/ci/features/distribute-task-execution), then this interface will be familiar. The execution shows each step taken by the workflow and the logs associated with each step.

![Custom Workflow Conformance Run](/nx-cloud/enterprise/images/custom-workflow-conformance-run.avif)
