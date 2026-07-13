# Security Policy

Nx/Nrwl takes the security of our software products and services seriously, which includes all source code repositories managed through our GitHub organizations.

If you believe you have found a security vulnerability in any Nx-owned repository or product that meets Nx's definition of a security vulnerability, please report it to us as described below.

## Reporting Security Issues for Nx OSS

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to the OSS Security Team at oss-security@nrwl.io.

### What Should Be Reported

The security email is for **demonstrable, verified vulnerabilities within the Nx codebase itself**.

## Reporting Security Issues for Nx-Cloud

Please report security vulnerabilities related to our commercial Nx-Cloud product (http://cloud.nx.app) to the Cloud Security Team security@nrwl.io.

### What Should Be Reported

The security email is for **demonstrable, verified vulnerabilities within the Nx-Cloud product/platform itself**.

Please note that low level nuisance findings (email aliases, sending invite emails, etc) are known and reports that are not
actually security related will be ignored. Reports sent to this address regarding oss libraries **may not** be replied to
or forwarded to the correct oss-security@nrwl.io address by the cloud security team.

## Submission Notes

### Bounty

Bounty program awards are **only** distributed for **critical** vulnerabilities reported on the commercial product (Nx Cloud)
and only in cases where the data of our users or the core integrity of the platform may be compromised. All other findings
that do not result in anything critical will not be awarded any bounty.

Bounties are not paid out for OSS findings.

### Process

**Important:** All attached reports MUST be in a plaintext format. You can attach text/markdown files (.txt or .md with no embedded images). 
We are no longer accepting PDF or other document formats. If you need to attach images, you can do so to the initial email. We do not guarantee
any response reminding submitters of this requirement and emails sent with these attached files may be rejected without response.

You should receive a response within 24 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Nx follows the principle of Coordinated Vulnerability Disclosure.

Reports leading to a GHSA/CVE publish will be attributed to the first reporters in cases where multiple parties report.

We aim to complete migation and disclosure within **90 days** of acceptance.

In general we will not:

- inform reporters if something has already been submitted by another party with work in progress
- provide granular details of in-progress mitigation efforts
- respond to repeated messages for updates on in-progress efforts
- spend time responding to 1-line messages such as: "I want to report a very serve vulnerability, do you have a bounty program?"

### Important

**Please do not use the security email for:**

- Reports about outdated dependencies (e.g., "package X has a newer version available")
- Reports about dependencies with known CVEs that do not directly affect Nx functionality
- General vulnerability scanner output

If you have a concern about an outdated dependency that you believe impacts Nx users, please open a [GitHub issue](https://github.com/nrwl/nx/issues/new/choose) instead.
