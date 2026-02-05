import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    ...nxE2EPreset(__filename, { testDir: './tests' }),
    use: {
        baseURL: 'http://localhost:3333',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npx serve dist -p 3333',
        url: 'http://localhost:3333',
        reuseExistingServer: !process.env['CI'],
        cwd: __dirname,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
