import {
  newProject,
  runCLI,
  tmpProjPath,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { spawnCommand, test } from './fixture';

const KEY_SEQUENCES = {
  DOWN_ARROW: '\x1B[B',
  UP_ARROW: '\x1B[A',
  TAB: '\t',
  SHIFT_TAB: '\x1B[Z',
  CTRL_Z: '\x1A',
};

test.describe('Nx TUI', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);

    // Create an Nx workspace with two npm packages (that will have simple test scripts already)
    newProject({
      packages: ['@nx/js'],
    });
    runCLI(`generate @nx/workspace:npm-package my-pkg-1`);
    runCLI(`generate @nx/workspace:npm-package my-pkg-2`);

    // Make pkg2 depend on pkg1 so that we have a deterministic order of task completions when combined with --parallel=1
    updateJson(`my-pkg-2/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies['@proj/my-pkg-1'] = 'file:../my-pkg-1';
      return json;
    });
  });

  test.describe('Task list navigation and terminal output pane toggling and pinning', () => {
    test('each task should be navigable with both the arrow keys and home row', async ({
      terminal,
      page,
    }) => {
      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=test --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      /**
       * Hide non-deterministic timing values from the screenshots.
       * Using exact coordinates which are slightly larger than we expect the largest value to be
       * is the most robust way to avoid to do this in order to avoid issues with the difference
       * in length between task results in different environments e.g. 10ms locally and 125ms in CI.
       */
      const regionsToMask = [
        { left: 249, top: 57, width: 50, height: 19 },
        { left: 1223, top: 95, width: 50, height: 19 },
        { left: 1223, top: 114, width: 50, height: 19 },
      ];

      // Navigate down with arrow key
      await terminal.captureSnapshotWithMasking('1-before-down-arrow-nav', {
        regions: regionsToMask,
      });
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.captureSnapshotWithMasking(
        '2-after-down-arrow-before-up-arrow-nav',
        {
          regions: regionsToMask,
        }
      );

      // Navigate up with arrow key
      await terminal.sendInput(KEY_SEQUENCES.UP_ARROW);
      await terminal.captureSnapshotWithMasking(
        '3-after-up-arrow-nav-before-down-j-nav',
        {
          regions: regionsToMask,
        }
      );

      // Navigate down with j key
      await terminal.sendInput('j');
      await terminal.captureSnapshotWithMasking(
        '4-after-down-j-nav-before-up-k-nav',
        {
          regions: regionsToMask,
        }
      );

      // Navigate up with k key
      await terminal.sendInput('k');
      await terminal.captureSnapshotWithMasking(
        '5-after-up-k-nav-before-down-j-nav',
        {
          regions: regionsToMask,
        }
      );
    });

    test('pressing spacebar should toggle a single terminal output pane that dynamically changes its contents as the tasks list is navigated', async ({
      terminal,
      page,
    }) => {
      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=test --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      const regionsToMask = [
        { left: 249, top: 57, width: 50, height: 19 },
        { left: 1223, top: 95, width: 50, height: 19 },
        { left: 1223, top: 114, width: 50, height: 19 },
      ];

      // Toggle the terminal output pane open with the spacebar
      await terminal.captureSnapshotWithMasking(
        'spacebar-terminal-output-1-before-spacebar-toggle',
        {
          regions: regionsToMask,
        }
      );
      await terminal.sendInput(' ');
      await terminal.captureSnapshotWithMasking(
        'spacebar-terminal-output-2-after-spacebar-toggle',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Navigate down with arrow key to switch the terminal output pane contents to the second task
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.captureSnapshotWithMasking(
        'spacebar-terminal-output-3-after-down-arrow-nav',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Toggle the terminal output pane closed again with the spacebar
      await terminal.sendInput(' ');
      await terminal.captureSnapshotWithMasking(
        'spacebar-terminal-output-4-after-spacebar-toggle',
        {
          regions: regionsToMask,
        }
      );
    });

    test('pressing 1 should pin a single terminal output pane, the contents of which should not change as the tasks list is navigated', async ({
      terminal,
      page,
    }) => {
      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=test --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      const regionsToMask = [
        { left: 249, top: 57, width: 50, height: 19 },
        { left: 1223, top: 95, width: 50, height: 19 },
        { left: 1223, top: 114, width: 50, height: 19 },
      ];

      // Pin one terminal output pane open with the 1 key
      await terminal.captureSnapshotWithMasking(
        'pin-1-terminal-output-1-before-1-key-press',
        {
          regions: regionsToMask,
        }
      );
      await terminal.sendInput('1');
      await terminal.captureSnapshotWithMasking(
        'pin-1-terminal-output-2-after-1-key-press',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Navigate down with arrow key to switch to the second task WITHOUT changing the pinned terminal output pane contents
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.captureSnapshotWithMasking(
        'pin-1-terminal-output-3-after-down-arrow-nav',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Pin the second task to the terminal output pane with the 1 key
      await terminal.sendInput('1');
      await terminal.captureSnapshotWithMasking(
        'pin-1-terminal-output-4-after-1-key-press-on-second-task',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Unpin the selected (second) task from the terminal output pane by pressing the 1 key again while it is still selected
      await terminal.sendInput('1');
      await terminal.captureSnapshotWithMasking(
        'pin-1-terminal-output-5-after-1-key-press-again-on-second-task',
        {
          regions: regionsToMask,
        }
      );
    });

    test('pressing 2 should pin two output panes, the contents of which should not change as the tasks list is navigated', async ({
      terminal,
      page,
    }) => {
      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=test --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      const regionsToMask = [
        { left: 249, top: 57, width: 50, height: 19 },
        { left: 1223, top: 95, width: 50, height: 19 },
        { left: 1223, top: 114, width: 50, height: 19 },
      ];

      // Pin two terminal output panes open with the 2 key
      await terminal.captureSnapshotWithMasking(
        'pin-2-terminal-outputs-1-before-2-key-press',
        {
          regions: regionsToMask,
        }
      );
      await terminal.sendInput('2');
      await terminal.captureSnapshotWithMasking(
        'pin-2-terminal-outputs-2-after-2-key-press',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Navigate down with arrow key to switch to the second task WITHOUT changing the pinned terminal output pane contents
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.captureSnapshotWithMasking(
        'pin-2-terminal-outputs-3-after-down-arrow-nav',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Pin the second task to the first terminal output pane with the 1 key
      await terminal.sendInput('1');
      await terminal.captureSnapshotWithMasking(
        'pin-2-terminal-outputs-4-after-1-key-press-on-second-task',
        {
          regions: [regionsToMask[0]], // only the task list dynamic data should need to be masked
        }
      );

      // Press the spacebar to toggle both panes closed at once
      await terminal.sendInput(' ');
      await terminal.captureSnapshotWithMasking(
        'pin-2-terminal-outputs-5-after-spacebar-toggle',
        {
          regions: regionsToMask,
        }
      );
    });
  });

  test.describe('Terminal output pane focus and scrolling', () => {
    test('pressing tab and shift+tab should cycle the focus between the task list and terminal output panes', async ({
      terminal,
      page,
    }) => {
      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=test --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      // Define regions to mask, but don't mask the entire UI elements
      // We want to see the focus changes (brightness differences)
      const regionsToMask = [
        { left: 249, top: 57, width: 50, height: 19 }, // Only mask dynamic data, not the entire task list
      ];

      // Toggle the first terminal output pane open with the spacebar
      await terminal.sendInput(' ');

      // Take a baseline screenshot before any focus changes
      await terminal.captureSnapshotWithMasking(
        'tab-focus-1-baseline-before-focus-changes',
        {
          regions: regionsToMask,
        }
      );

      // Press the tab key to cycle focus from the tasks list to the first terminal output pane
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-2-after-tab-key-press',
        {
          regions: regionsToMask,
        }
      );

      // Press tab again to cycle focus from the first terminal output pane to the tasks list
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-3-after-tab-key-press',
        {
          regions: regionsToMask,
        }
      );

      // Press tab again to cycle focus from the tasks list to the first terminal output pane, and then shift+tab to
      // cycle focus back to the tasks list to show that that also works in reverse
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.sendInput(KEY_SEQUENCES.SHIFT_TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-4-after-tab-and-shift-tab-key-presses',
        {
          regions: regionsToMask,
        }
      );

      // Press the 2 key to pin two terminal output panes open
      await terminal.sendInput('2');

      // Press the tab key to cycle focus from the tasks list to the first terminal output pane
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-5-after-tab-key-press-on-tasks-list',
        {
          regions: regionsToMask,
        }
      );

      // Press tab again to cycle focus from the first terminal output pane to the second terminal output pane
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-6-after-tab-key-press-on-first-terminal-output-pane',
        {
          regions: regionsToMask,
        }
      );

      // Press shift+tab again to cycle focus from the second terminal output pane to the first terminal output pane
      await terminal.sendInput(KEY_SEQUENCES.SHIFT_TAB);
      await terminal.captureSnapshotWithMasking(
        'tab-focus-7-after-shift-tab-key-press-on-second-terminal-output-pane',
        {
          regions: regionsToMask,
        }
      );
    });

    test('each terminal output pane should be scrollable when there is more content than fits in the pane, and scroll independently of the other panes', async ({
      terminal,
      page,
    }) => {
      // Add a new "scrollable" target to each project with a variable amount of lines of output
      const scriptWith100Lines =
        'const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`); console.log(lines.join("\\n"));';
      const scriptWith40Lines =
        'const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`); console.log(lines.join("\\n"));';

      updateFile(`my-pkg-1/script-with-100-lines.js`, scriptWith100Lines);
      updateJson(`my-pkg-1/package.json`, (json) => {
        json.scripts['scrollable'] = 'node script-with-100-lines.js';
        return json;
      });

      updateFile(`my-pkg-2/script-with-40-lines.js`, scriptWith40Lines);
      updateJson(`my-pkg-2/package.json`, (json) => {
        json.scripts['scrollable'] = 'node script-with-40-lines.js';
        return json;
      });

      updateJson(`nx.json`, (json) => {
        json.targetDefaults = {
          ...json.targetDefaults,
          scrollable: {
            dependsOn: ['^scrollable'],
          },
        };
        return json;
      });

      // Spawn the Nx TUI process
      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=scrollable --parallel=1',
        tmpProjPath()
      );

      // Wait for the tasks to have completed
      await terminal.waitForText('Completed 2 tasks in', 15000);

      // Only the task list dynamic data should need to be masked
      const regionsToMask = [{ left: 249, top: 57, width: 50, height: 19 }];

      // Pin each task to its own terminal output pane
      await terminal.sendInput('1');
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.sendInput('2');

      // Take a baseline screenshot before any scrolling
      await terminal.captureSnapshotWithMasking(
        'scrollable-1-baseline-before-scrolling',
        {
          regions: regionsToMask,
        }
      );

      // Focus on the first terminal output pane, which will have the cursor at the bottom of the output, and scroll it up by 10 lines
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.sendInput(KEY_SEQUENCES.UP_ARROW.repeat(10));
      await terminal.captureSnapshotWithMasking(
        'scrollable-2-after-first-terminal-output-pane-scroll-10-lines-up',
        {
          regions: regionsToMask,
        }
      );

      // Scroll it back down by 15 lines to show it can't go past the bottom
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW.repeat(15));
      await terminal.captureSnapshotWithMasking(
        'scrollable-3-after-first-terminal-output-pane-scroll-back-down-15-lines',
        {
          regions: regionsToMask,
        }
      );

      // Focus on the second terminal output pane and attempt to scroll it up past the start by scrolling up 50 lines, and it should finish at the start
      // Terminal output pane 1 should be unaffected by this
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.sendInput(KEY_SEQUENCES.UP_ARROW.repeat(50));
      await terminal.captureSnapshotWithMasking(
        'scrollable-4-after-second-terminal-output-pane-scroll-up-past-start',
        {
          regions: regionsToMask,
        }
      );
    });
  });

  test.describe('Interactive tasks', () => {
    test('should allow the user to interact with a running task', async ({
      terminal,
      page,
    }) => {
      const interactiveScript = `
// Script which will print whatever it gets via stdin after an initial log, and does not clear the screen

setTimeout(() => {
    console.log("Initial log...\\n");

    const readline = require("readline");
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.on("line", (line) => {
      console.log(\`Received: \${line}\`);
    });
    
  rl.on("close", () => {
    process.exit(0);
  });
}, 100);
`;

      const target: any = {
        // Mark as continuous
        continuous: true,
        executor: 'nx:run-commands',
        options: {
          commands: ['node interactive-script.js'],
        },
      };

      updateFile(`my-pkg-1/interactive-script.js`, interactiveScript);
      updateJson(`my-pkg-1/package.json`, (json) => {
        target.options.cwd = 'my-pkg-1';
        json.nx = {
          targets: {
            interactive: target,
          },
        };
        return json;
      });

      updateFile(`my-pkg-2/interactive-script.js`, interactiveScript);
      updateJson(`my-pkg-2/package.json`, (json) => {
        target.options.cwd = 'my-pkg-2';
        json.nx = {
          targets: {
            interactive: target,
          },
        };
        return json;
      });

      await spawnCommand(
        terminal,
        page,
        'npx nx run-many --target=interactive',
        tmpProjPath()
      );

      // Wait for the tasks to have rendered (they will not complete)
      await terminal.waitForText('Executing 2/2 remaining tasks...', 15000);

      // We need to cover the task spinners
      const regionsToMask = [
        { left: 20, top: 95, width: 40, height: 19 },
        { left: 20, top: 114, width: 40, height: 19 },
      ];

      // Pin the two tasks to their own terminal output panes
      await terminal.sendInput('1');
      await terminal.sendInput(KEY_SEQUENCES.DOWN_ARROW);
      await terminal.sendInput('2');

      await terminal.captureSnapshotWithMasking(
        'interactive-1-baseline-before-interaction',
        {
          regions: regionsToMask,
        }
      );

      // Tab to the first terminal output pane, make it interactive and type abc123
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.sendInput('i');
      await terminal.sendInput('abc123');

      await terminal.captureSnapshotWithMasking(
        'interactive-2-after-interaction-on-first-terminal-output-pane',
        {
          regions: regionsToMask,
        }
      );

      // Exit interactive mode on the first terminal output pane and tab to the second, make it interactive and type def456
      await terminal.sendInput(KEY_SEQUENCES.CTRL_Z);
      await terminal.sendInput(KEY_SEQUENCES.TAB);
      await terminal.sendInput('i');
      await terminal.sendInput('def456');

      await terminal.captureSnapshotWithMasking(
        'interactive-3-after-interaction-on-second-terminal-output-pane',
        {
          regions: regionsToMask,
        }
      );
    });
  });
});
