---
title: 'S1ngularity - What Happened, How We Responded, What We Learned'
slug: s1ngularity-postmortem
authors: ['Juri Strumpflohner']
tags: []
cover_image: /blog/images/articles/s1ngularity-postmortem-bg.avif
description: 'Malicious Nx packages were published to npm via GitHub Actions exploit. Learn what happened and how we enhanced security measures.'
pinned: false
---

On August 26, 2025, malicious versions of several Nx packages were published to npm. Attackers exploited a GitHub Actions injection vulnerability to steal our NPM publishing token and publish malicious packages for 4 hours. The packages scanned users' systems for sensitive data and uploaded it to public GitHub repositories. We've since implemented NPM Trusted Publishers, a manual approval process for all releases, and enhanced security measures.

We want to provide full transparency about what happened, how we responded, and the steps we've taken to prevent it from happening again.

> For a fully detailed breakdown of the entire timeline, please refer to our GHSA on GitHub.

## What Happened

Attackers extracted our NPM token and used it to publish malicious versions of Nx packages to the NPM registry.

Our publishing process itself wasn’t breached, but the token let attackers bypass release pipelines. We detected this because the malicious packages lacked NPM provenance signing. Unfortunately, provenance doesn’t block unsigned packages from being installed, which is what happened.

The malicious packages ran a post-install script that scanned user systems for sensitive data, attempted to use local AI tools (like Claude and Gemini), and uploaded the results to a public GitHub repo via the GitHub CLI.

**Nx Cloud was not affected** by this incident at any point and remained fully operational and secure. The attack targeted the OSS packages of Nx.

## Our Response

This is how we responded to the security incident.

**Immediate Containment:** We reached out to NPM, removed the affected token, and started to manually unpublish the malicious packages. NPM stepped in to remove all packages and revoke all our NPM tokens. The malicious packages were active for 4 hours before being completely removed from the registry.

**Communication and Damage Mitigation:** We published a [security advisory](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c) that we constantly updated and added a security policy for Nx OSS to call out the existing [security@nrwl.io](mailto:security@nrwl.io) email for reporting vulnerabilities. We started identifying and reaching out to our point of contacts: our Nx Enterprise customers, social media and Discord communities, and actively monitored GitHub for leaked repositories, opening issues to alert their respective owners. We collaborated closely with GitHub, who stepped in to take leaked repositories offline.

**Investigation and Access Hardening:** Since the packages lacked NPM provenance signing, we knew they didn't originate from our CI pipeline. We disabled all publishing workflows and external contributor access until we understood the attack vector, then worked backwards from the leaked NPM token to uncover the technical details.

Here's our detailed chronological [timeline on our GHSA](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c).

## Technical Details: How The Attack Worked

The attack exploited a GitHub Actions injection vulnerability to steal our NPM token. Here's the simplified attack chain:

### The Vulnerability

Three conditions aligned to make this attack possible:

1. **PR title validation workflow with injection vulnerability** - Our workflow used `pull_request_target` which runs with the permissions of the target branch (not the fork) and can access repository secrets. This bypasses normal restrictions that prevent external contributors from running workflows, as [GitHub's documentation warns](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target). Combined with unsanitized PR title echoing, this created a dangerous injection point.
2. **Workflow permissions set to read/write** - Our repository still had GitHub's original default setting of "Read and write permissions" for Actions. GitHub changed this default to "Read permissions" for new repositories in February 2023, but existing repositories weren't automatically updated. This meant any workflow token had full repository access instead of the safer read-only default (check yours at `/settings/actions`).
3. **Manual workflow dispatch enabled** - Our `publish.yml` workflow included `workflow_dispatch` to allow manual triggering for PR publishing workflows. Crucially, this also enabled triggering the workflow programmatically via GitHub's API, which became essential for the attacker's strategy.

### The Attack Chain

1. **Initial exploit**: Attacker created a PR with a malicious title containing shell commands. Due to our PR title validation workflow's injection vulnerability and `pull_request_target` setup, these commands executed with repository permissions.
2. **Token extraction and escalation**: The malicious script ran with elevated permissions, extracted a read/write GitHub token (due to our workflow permissions setting), and used it to:
   - Create a branch with a malicious script replacing our legitimate CI script
   - Trigger our publish workflow against that branch via the GitHub API (enabled by `workflow_dispatch`)
   - Clean up traces by deleting branches and workflow runs
3. **NPM token theft**: When the publish workflow ran the malicious script, it had access to our `NPM_TOKEN` and exfiltrated it
4. **Malicious packages**: Using the stolen token, they published infected Nx packages with postinstall hooks that scanned users' systems and leaked data to public GitHub repositories

We're grateful to the community members who alerted us to the attack and assisted during our investigation. Some of the contributions were instrumental in helping us understand how the attack unfolded and piece together this technical timeline.

## Are You Affected?

If you installed any of these malicious versions, check if your system was compromised.

**Affected versions:**

- **nx:** 21.5.0, 20.9.0, 20.10.0, 21.6.0, 20.11.0, 21.7.0, 21.8.0, 20.12.0
- **@nx/devkit, @nx/js, @nx/workspace, @nx/node:** 21.5.0, 20.9.0
- **@nx/eslint:** 21.5.0
- **@nx/key, @nx/enterprise-cloud:** 3.2.0

**Check for data exfiltration:**

- Review your [GitHub security log](https://github.com/settings/security-log?q=action%3Arepo.create) for suspicious repositories that were created unexpectedly
- Check your `~/.bashrc` or `~/.zshrc` for suspicious additions like `sudo shutdown -h 0`

**If you find evidence of compromise:**

1. **Secure your accounts:** Delete or make suspicious GitHub repositories private, then [revoke GitHub CLI access](https://github.com/settings/applications) and [refresh your tokens](https://github.com/settings/tokens)
2. **Clean package caches:** Run `npm cache clean --force`, `yarn cache clean --all`, or `pnpm store prune --force` and remove npx cache folders
3. **Update Nx:** Install the latest version if you were using affected packages

## Lessons Learned and Actions Taken

First off, we take security extremely seriously:

- We undergo frequent security audits for our SOC 2 certification.
- We have set up extensive ownership and all our PRs require explicit reviews and approvals from one or multiple of these owners.

Retrospectively, we made one critical mistake: if you gained access to our trusted environment (the Nx OSS repository), you were able to publish to NPM, leading to a huge impact given our ~6 million weekly installs.

Regardless of how much caution and attention you put in, security breaches might happen, PR reviews might miss important parts, and vulnerabilities might slip through (even with automated checks in place). But the impact must be limited even in those cases.

We learned this the hard way and **immediately put measures in place**:

- We no longer use NPM tokens for our publishing process but rather switched to the recently released [Trusted Publisher](https://docs.npmjs.com/trusted-publishers/) using OIDC authentication. This effectively connects our GitHub repo, our CI pipeline, and the NPM registry.
- Enforce all publishing workflows to happen via our CI pipeline, which now requires manual 2FA for publishing all Nx-related packages to NPM
  ![Screenshot of manual approval process during the CI release pipeline](/blog/images/articles/nx-publish-approval.avif)
- Disable pipeline runs for all external contributors, not just first-time contributors. An approval is required in all instances.
- Add extra provenance checks in Nx and Nx Console whenever we run the latest version of Nx to make sure they actually originate from a trusted environment.
- We created a [`SECURITY.md`](https://github.com/nrwl/nx/blob/master/SECURITY.md) for responsible disclosure.

In addition to these direct measures, we also took action to make sure our own engineers are not subject to such attacks by verifying how tokens are being managed, securing invocations of the GitHub CLI, etc.

## Conclusion

By sharing our experience with complete transparency we hope to raise awareness about potential security vulnerabilities in GitHub automation workflows.

This incident also highlights the importance of being mindful about what sensitive data is stored locally on your development machine. Consider using secure credential management tools, avoiding plaintext tokens and API keys in configuration files, and regularly auditing what sensitive information might be accessible on your system. Even in the case of a compromise, minimizing the exposure of credentials and sensitive data can significantly reduce the potential impact.

We remain committed to maintaining a secure setup for all Nx users.

For complete details, see our [GitHub Security Advisory](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c). For questions or assistance, reach out to [security@nrwl.io](mailto:security@nrwl.io).
