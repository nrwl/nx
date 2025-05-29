# Claude Issue Workflow Usage Guide

## Quick Start

### For Planning Phase

1. Comment `@claude plan` on any issue, OR
2. Add the label `claude:plan` to trigger automatic planning

### For Implementation Phase

1. Comment `@claude implement` on an issue with a plan, OR
2. Add the label `claude:implement` to trigger automatic implementation

## Workflow Labels

- `claude:plan` - Triggers the planning workflow
- `claude:planned` - Added after planning is complete
- `claude:implement` - Triggers the implementation workflow
- `claude:implemented` - Added after implementation is complete

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
