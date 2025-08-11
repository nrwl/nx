# GitHub Issue Planning and Resolution

This command provides guidance for both automated and manual GitHub issue workflows.

## Automated Workflow (GitHub Actions)

The automated workflow consists of two phases:

### Phase 1: Planning (`@claude plan` or `claude:plan` label)

- Claude analyzes the issue and creates a detailed implementation plan
- Plan is posted as a comment on the issue
- Issue is labeled with `claude:planned`

### Phase 2: Implementation (`@claude implement` or `claude:implement` label)

- Claude implements the solution based on the plan
- Runs validation tests and creates a feature branch
- Suggests opening a PR with proper formatting

## Planning Phase Template

When creating a plan (either automated or manual), include these sections:

### Problem Analysis

- Root cause identification
- Impact assessment
- Related components or systems affected

### Proposed Solution

- High-level approach
- Alternative solutions considered
- Trade-offs and rationale

### Implementation Details

- Files that need to be modified
- Key changes required
- Dependencies or prerequisites

### Testing Strategy

- Unit tests to add/modify
- Integration tests needed
- E2E test considerations

### Validation Steps

```bash
# Test specific affected projects
nx run-many -t test,build,lint -p PROJECT_NAME

# Test all affected projects
nx affected -t build,test,lint

# Run affected e2e tests
nx affected -t e2e-local

# Format code
npx nx prettier -- FILES

# Final validation
pnpm nx prepush
```

### Risks and Considerations

- Breaking changes
- Performance implications
- Migration requirements

## Manual Workflow

When working on a GitHub issue manually, follow this systematic approach:

## 1. Get Issue Details

```bash
# Get issue details using GitHub CLI (replace ISSUE_NUMBER with actual number)
gh issue view ISSUE_NUMBER
```

When cloning reproduction repos, please clone within `./tmp/claude/repro-ISSUE_NUMBER`

## 2. Analyze the Plan

- Look for a plan or implementation details in the issue description
- Check comments for additional context or clarification
- Identify affected projects and components

## 3. Implement the Solution

- Follow the plan outlined in the issue
- Make focused changes that address the specific problem
- Ensure code follows existing patterns and conventions

## 4. Run Full Validation

```bash
# Test specific affected projects first
nx run-many -t test,build,lint -p PROJECT_NAME

# Test all affected projects
nx affected -t build,test,lint

# Run affected e2e tests
nx affected -t e2e-local

# Final pre-push validation
pnpm nx prepush
```

## 5. Submit Pull Request

- Create a descriptive PR title that references the issue
- Include "Fixes #ISSUE_NUMBER" in the PR description
- Provide a clear summary of changes made
- Request appropriate reviewers

## Pull Request Template

When creating a pull request, follow the template found in `.github/PULL_REQUEST_TEMPLATE.md`. The template includes:

### Required Sections

1. **Current Behavior**: Describe the behavior we have today
2. **Expected Behavior**: Describe the behavior we should expect with the changes in this PR
3. **Related Issue(s)**: Link the issue being fixed so it gets closed when the PR is merged

### Template Format

```markdown
## Current Behavior

<!-- This is the behavior we have today -->

## Expected Behavior

<!-- This is the behavior we should expect with the changes in this PR -->

## Related Issue(s)

<!-- Please link the issue being fixed so it gets closed when this is merged. -->

Fixes #ISSUE_NUMBER
```

### Guidelines

- Ensure your commit message follows the conventional commit format (use `pnpm commit`)
- Read the submission guidelines in CONTRIBUTING.md before posting
- For complex changes, you can request a dedicated Nx release by mentioning the Nx team
- Always link the related issue using "Fixes #ISSUE_NUMBER" to automatically close it when merged
