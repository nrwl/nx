import { execSync } from 'node:child_process';
import { deduceDefaultBase as gitInitDefaultBase } from '../../../utils/default-base';

export function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });
    return 'main';
  } catch {
    try {
      execSync(`git rev-parse --verify dev`, {
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      });
      return 'dev';
    } catch {
      try {
        execSync(`git rev-parse --verify develop`, {
          stdio: ['ignore', 'ignore', 'ignore'],
          windowsHide: true,
        });
        return 'develop';
      } catch {
        try {
          execSync(`git rev-parse --verify next`, {
            stdio: ['ignore', 'ignore', 'ignore'],
            windowsHide: true,
          });
          return 'next';
        } catch {
          try {
            execSync(`git rev-parse --verify master`, {
              stdio: ['ignore', 'ignore', 'ignore'],
              windowsHide: true,
            });
            return 'master';
          } catch {
            return gitInitDefaultBase();
          }
        }
      }
    }
  }
}
