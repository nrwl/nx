'use client';
import { useEffect, useRef } from 'react';
import { webcontainer } from 'tutorialkit:core';
import tutorialStore from 'tutorialkit:store';
import { getCollection } from 'astro:content';

export function GlobalCustomizations() {
  useEffect(() => {
    // These actions run on every page load

    // Disable previous and next buttons if this is the first or last lesson of a tutorial
    getCollection('tutorial', ({ id }) => {
      return id.startsWith(
        document.location.pathname.replace('/tutorials/', '')
      );
    }).then((collection) => {
      const entry = collection[0];
      if (entry.data?.custom?.first) {
        const [topPrevButton, bottomPrevButton] = document
          .querySelectorAll('[class*=i-ph-arrow-left]')
          .values()
          .map((el) => el.parentElement);
        topPrevButton.classList.add('opacity-32', 'pointer-events-none');
        topPrevButton.setAttribute('aria-disabled', 'true');
        topPrevButton.removeAttribute('href');
        bottomPrevButton.remove();
      }
      if (entry.data?.custom?.last) {
        const [topNextButton, bottomNextButton] = document
          .querySelectorAll('[class*=i-ph-arrow-right]')
          .values()
          .map((el) => el.parentElement);
        topNextButton.classList.add('opacity-32', 'pointer-events-none');
        topNextButton.setAttribute('aria-disabled', 'true');
        topNextButton.removeAttribute('href');
        bottomNextButton.remove();
      }
    });

    webcontainer.then(async (wc) => {
      // Stub out git command
      await wc.fs.writeFile(
        'git',
        'echo "Git is not available in a WebContainer"'
      );
      wc.spawn('export PATH="$PATH:/home/tutorial"');
      wc.spawn('chmod +x git');
    });

    // Run these actions only once
    const tempData: any = window;
    if (tempData.globalCustomizationsInitialized) {
      return;
    }
    tempData.globalCustomizationsInitialized = true;

    // Apply file changes
    async function applyFileChanges(e: any) {
      const { code, filepath } = e.detail;
      if (!filepath) {
        return;
      }
      const path = filepath.replace('solution:', '');
      console.log(
        tutorialStore.lesson.solution,
        tutorialStore.steps.get(),
        tutorialStore.lesson.files
      );
      tutorialStore.updateFile(path, code);
      tutorialStore.setSelectedFile(path);
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
