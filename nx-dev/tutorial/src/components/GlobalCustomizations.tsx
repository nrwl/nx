'use client';
import { useEffect } from 'react';
import { webcontainer } from 'tutorialkit:core';
import tutorialStore from 'tutorialkit:store';

export function GlobalCustomizations() {
  useEffect(() => {
    // These actions run on every page load

    // Disable previous and next buttons if this is the first or last lesson of a tutorial
    function waitForTopBar() {
      if (!document.querySelector('#top-bar')) {
        setTimeout(waitForTopBar, 100);
      } else {
        if (document.querySelector('#top-bar.first-lesson')) {
          const [topPrevButton, bottomPrevButton] = document
            .querySelectorAll('[class*=i-ph-arrow-left]')
            .values()
            .map((el) => el.parentElement);
          topPrevButton.classList.add('opacity-32', 'pointer-events-none');
          topPrevButton.setAttribute('aria-disabled', 'true');
          topPrevButton.removeAttribute('href');
          bottomPrevButton?.remove();
        }
        if (document.querySelector('#top-bar.last-lesson')) {
          const [topNextButton, bottomNextButton] = document
            .querySelectorAll('[class*=i-ph-arrow-right]')
            .values()
            .map((el) => el.parentElement);
          topNextButton.classList.add('opacity-32', 'pointer-events-none');
          topNextButton.setAttribute('aria-disabled', 'true');
          topNextButton.removeAttribute('href');
          bottomNextButton?.remove();
        }
      }
    }
    waitForTopBar();

    webcontainer.then(async (wc) => {
      // Stub out git command
      await wc.fs.writeFile(
        'git',
        'echo "Git is not available in a WebContainer"'
      );
      const terminal = tutorialStore.terminalConfig.get().panels[0]?.terminal;
      if (!terminal) {
        return;
      }
      terminal?.input('echo "hi"\n');
      function callOnce(fn: Function) {
        let called = false;
        return function () {
          if (!called) {
            called = true;
            fn();
          }
        };
      }
      (terminal as any).onLineFeed(
        callOnce(() => {
          setTimeout(() => {
            terminal.input('export PATH="$PATH:/home/tutorial"\n');
            setTimeout(() => {
              terminal.input('clear\n');
            }, 10);
          }, 10);
        })
      );
    });

    // Run these actions only once
    const tempData: any = window;
    if (tempData.globalCustomizationsInitialized) {
      return;
    }
    tempData.globalCustomizationsInitialized = true;

    // Apply file changes
    async function applyFileChanges(e: any) {
      const { filepath } = e.detail;
      if (!filepath) {
        return;
      }
      tutorialStore.updateFile(
        filepath,
        (tutorialStore as any)._lessonSolution[filepath]
      );
      tutorialStore.setSelectedFile(filepath);
    }
    document.addEventListener('tutorialkit:applyFileChanges', applyFileChanges);

    // Run code in terminal when tutorialkit:runInTerminal event is triggered
    function runInTerminal(e: any) {
      if (tutorialStore.hasTerminalPanel()) {
        tutorialStore.terminalConfig
          .get()
          .panels[0].terminal?.input(e.detail.code + '\n');
      }
    }
    document.addEventListener('tutorialkit:runInTerminal', runInTerminal);
  }, []);
  return null;
}
