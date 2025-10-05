# Claude Issue Workflow Usage Guide

## Quick Start

## Expected Outputs

### Planning Phase

- Detailed analysis comment posted to issue
- Implementation plan with steps and file changes
- Testing strategy and validation steps
- Risk assessment

### Implementation Phase

- Code changes made according to plan
- Tests run and validated
- Feature branch created: `fix/issue-{number}`
- PR suggestion with proper title format

## Manual Override

If you need to work on an issue manually, use the `/gh-issue-plan` command for structured guidance following the same workflow patterns.

## Troubleshooting

- Ensure you're on the authorized users list
- Check that the issue has sufficient detail for analysis
- For implementation, ensure a plan comment exists from the planning phase
- If workflows fail, check the Actions tab for detailed logs
