# Nightly Workflow Scripts

This directory contains TypeScript scripts used by the nightly e2e matrix workflow.

## Scripts

### `process-matrix.ts`
Generates the matrix configuration for the e2e tests, determining which projects should run on which OS/Node/package manager combinations.

**Usage:**
```bash
npx tsx .github/workflows/nightly/process-matrix.ts
```

### `process-result.ts`
Processes the results from the e2e matrix workflow and generates reports for Slack notifications.

**Features:**
- Identifies failed projects and their codeowners
- Generates clean, formatted Slack messages for failed tests
- Creates duration reports for projects and package managers
- Provides performance insights with color-coded indicators
- **Smart notifications**: Only triggers Slack alerts when golden (critical) projects fail
- Handles both golden (critical) and regular projects
- **Improved formatting**: Clean tables with proper column alignment and full version information

**Notification Logic:**
- **Golden projects** (`isGolden: true`): Critical tests that trigger Slack notifications when they fail
- **Regular projects** (`isGolden: false`): Standard tests that are reported but don't trigger alerts
- **Codeowners**: Only includes teams responsible for failed golden projects in Slack mentions
- **Smart messaging**: 
  - When golden tests fail: Shows "🔥 **Golden Test Failures (count)**" with formatted table + any regular failures
  - When golden tests pass but regular fail: Shows "✅ **Golden Tests: All Passed!**" + regular failures
  - When all tests pass: Shows "✅ **No test failures detected!**"
- **Visibility**: All failures are shown in reports, but only golden failures trigger notifications

**Slack Message Format:**
The messages are formatted for optimal readability:
- **Clean titles**: Simple notification titles without redundancy
- **Failure counts**: Clear indication of how many tests failed (e.g., "Golden Test Failures (2)")
- **Proper table alignment**: Consistent column spacing for project/PM/OS/Node information
- **Full version info**: Complete Node.js versions (e.g., "v20.19.0" not "v20")
- **Emoji indicators**: 🔥 for golden failures, 📋 for other failures, ✅ for success

**Example Slack Output:**
```
Title: Golden Test Failure

🔥 **Golden Test Failures (1)**
| Failed project                 | PM   | OS    | Node     |
|--------------------------------|------|-------|----------|
| e2e-lerna-smoke-tests          | npm  | MacOS | v20.19.0 |

📋 **Other Project Failures (1)**
| Failed project                 | PM   | OS    | Node     |
|--------------------------------|------|-------|----------|
| e2e-vite                       | npm  | MacOS | v20      |
```

**Workflow Notifications:**
- **`report-failure`**: Triggers when `has_golden_failures == 'true'` - sends failure alerts with codeowner mentions
  - Title: "Golden Test Failure"
  - Message: Clean formatted tables of failed projects
- **`report-success`**: Triggers when `has_golden_failures == 'false'` - sends success notification even if regular projects failed
  - Title: "✅ Golden Tests: All Passed!"
- **`report-pm-time`**: Always runs - sends package manager duration statistics
  - Title: "⌛ Total duration per package manager (ubuntu only)"
- **`report-proj-time`**: Always runs - sends project duration statistics
  - Title: "⌛ E2E Project duration stats"

**Data Structure:**
The script processes `MatrixResult` objects with the following properties:
- `project`: Project name (e.g., 'e2e-nx')
- `codeowners`: Slack group ID for notifications
- `node_version`: Node.js version used (preserved as full version string)
- `package_manager`: Package manager (npm, yarn, pnpm)
- `os`/`os_name`: Operating system information
- `status`: Test result ('success', 'failure', 'cancelled')
- `duration`: Test duration in seconds
- `isGolden`: Boolean indicating if this is a critical/golden project

**Usage:**
```shell
# Via stdin (as used in GitHub Actions)
echo '${{ steps.combine-json.outputs.combined }}' | npx tsx .github/workflows/nightly/process-result.ts

# Via command line argument (for testing)
npx tsx .github/workflows/nightly/process-result.ts '[{"project":"e2e-nx","status":"failure",...}]'
```

**Output:**
The script outputs GitHub Actions variables:
- `codeowners`: Comma-separated list of Slack groups for failed golden projects only
- `slack_message`: Clean formatted report with separate sections for golden and regular project failures
- `slack_proj_duration`: Duration report per project with performance indicators
- `slack_pm_duration`: Duration report per package manager
- `has_golden_failures`: "true"/"false" indicating if any golden projects failed (used to trigger notifications)

## Testing

### Running Tests Locally
```shell
# Test the process-result script with sample data
npx tsx .github/workflows/nightly/process-result.ts '[{"project":"test","codeowners":"@team","node_version":"20.19.0","package_manager":"npm","os":"linux","os_name":"Linux","status":"failure","duration":600,"isGolden":true}]'

# Test the process-matrix script
npx tsx .github/workflows/nightly/process-matrix.ts
```

### Performance Indicators
The duration reports use the following indicators:
- ✅ `< 12 minutes`: Good performance
- ❗ `12-15 minutes`: Warning - needs attention
- ❌ `> 15 minutes`: Poor performance - requires optimization

## Development

### Adding New Projects
To add a new e2e project, update the `matrixData` in `process-matrix.ts`:

1. Add to `coreProjects` for critical tests that run on all combinations (these will have `isGolden: true`)
2. Add to `projects` for regular tests that run only on Node LTS (these will not have `isGolden` set)
3. Specify the appropriate codeowners Slack group

**Golden Projects:**
Golden projects (`isGolden: true`) are critical tests that:
- Run on all OS/Node.js/package manager combinations
- Are considered essential for release readiness
- Include core functionality like workspace creation, basic commands, etc.
- Have higher priority for failure notifications

### Modifying Result Processing
The `process-result.ts` script can be extended to:
- Add new report formats
- Modify performance thresholds
- Include additional metrics
- Change Slack message formatting

### Recent Improvements (Latest Updates)
- **Simplified notification titles**: Removed redundant title text for cleaner notifications
- **Improved table formatting**: Fixed column alignment issues and padding
- **Full version preservation**: Node.js versions now display complete version strings
- **Cleaner message structure**: Eliminated redundant emoji/text combinations
- **Slack-compatible bold formatting**: Ensured markdown bold text renders correctly in Slack

### Benefits of Node.js Scripts

Moving from inline GitHub Actions JavaScript to dedicated TypeScript files provides:

1. **Better Readability**: Proper syntax highlighting and formatting
2. **Type Safety**: TypeScript interfaces and type checking
3. **Testability**: Easy to unit test with mock data
4. **Maintainability**: Easier to review and modify logic
5. **Reusability**: Can be imported and used in other scripts
6. **Debugging**: Better error messages and stack traces 