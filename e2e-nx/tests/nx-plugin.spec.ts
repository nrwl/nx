import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_WORKSPACE_DIR = join(tmpdir(), 'fluff-nx-e2e-test');
const FLUFF_ROOT = join(__dirname, '../..');
const TEST_PORT = 30000 + Math.floor(Math.random() * 10000);

let serveProcess: ChildProcess | null = null;

test.describe('@fluffjs/nx plugin e2e', () =>
{
    test.beforeAll(() =>
    {
        if (existsSync(TEST_WORKSPACE_DIR))
        {
            rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true });
        }
        mkdirSync(TEST_WORKSPACE_DIR, { recursive: true });
    });

    test.afterAll(() =>
    {
        if (serveProcess)
        {
            serveProcess.kill();
            serveProcess = null;
        }

        if (existsSync(TEST_WORKSPACE_DIR))
        {
            rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true });
        }
    });

    test('should create workspace and generate app', async () =>
    {
        execSync(
            'npx create-nx-workspace@latest test-workspace --preset=apps --nxCloud=skip --skipGit',
            { cwd: TEST_WORKSPACE_DIR, stdio: 'inherit' }
        );

        const workspaceDir = join(TEST_WORKSPACE_DIR, 'test-workspace');

        execSync(
            `npm install ${join(FLUFF_ROOT, 'packages/nx/dist')} ${join(FLUFF_ROOT, 'packages/cli/dist')} ${join(FLUFF_ROOT, 'packages/fluff/dist')}`,
            { cwd: workspaceDir, stdio: 'inherit' }
        );

        execSync('npx nx g @fluffjs/nx:app test-app', { cwd: workspaceDir, stdio: 'inherit' });

        const projectJsonPath = join(workspaceDir, 'apps/test-app/project.json');
        expect(existsSync(projectJsonPath)).toBe(true);

        const fluffJsonPath = join(workspaceDir, 'apps/test-app/fluff.json');
        expect(existsSync(fluffJsonPath)).toBe(true);

        const fluffJson = JSON.parse(readFileSync(fluffJsonPath, 'utf-8'));
        fluffJson.targets.app.serve.port = TEST_PORT;
        writeFileSync(fluffJsonPath, JSON.stringify(fluffJson, null, 2));
    });

    test('should build the generated app', async () =>
    {
        const workspaceDir = join(TEST_WORKSPACE_DIR, 'test-workspace');

        execSync('npx nx build test-app', { cwd: workspaceDir, stdio: 'inherit' });

        const distPath = join(workspaceDir, 'apps/test-app/dist');
        expect(existsSync(distPath)).toBe(true);
    });

    test('should serve and render the app correctly', async ({ page }) =>
    {
        const workspaceDir = join(TEST_WORKSPACE_DIR, 'test-workspace');

        serveProcess = spawn(
            'npx',
            ['nx', 'serve', 'test-app'],
            { cwd: workspaceDir, stdio: 'pipe', shell: true }
        );

        await new Promise(resolve => setTimeout(resolve, 5000));

        await page.goto(`http://localhost:${TEST_PORT}`);

        await expect(page.locator('test-app')).toBeVisible();

        const heading = page.locator('h1');
        await expect(heading).toContainText('Hello, World!');

        const counterText = page.locator('.counter-section strong');
        await expect(counterText).toHaveText('0');

        const button = page.locator('button.btn');
        await button.click();
        await expect(counterText).toHaveText('1');

        await button.click();
        await expect(counterText).toHaveText('2');
    });
});
