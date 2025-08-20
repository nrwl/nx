import { prompt } from 'enquirer';
import { homedir } from 'os';
import { output } from './output';
import {
  installNxConsole,
  canInstallNxConsole,
  NxConsolePreferences,
} from '../native';

export async function ensureNxConsoleInstalled() {
  const preferences = new NxConsolePreferences(homedir());
  let setting = preferences.getAutoInstallPreference();

  const canInstallConsole = canInstallNxConsole();

  // Noop
  if (!canInstallConsole) {
    return;
  }

  if (process.stdout.isTTY && typeof setting !== 'boolean') {
    setting = await promptForNxConsoleInstallation();
    preferences.setAutoInstallPreference(setting);
  }

  if (setting) {
    installNxConsole();
  }
}

/**
 * Prompts the user whether they want to automatically install the Nx Console extension
 * and persists their preference using the NxConsolePreferences struct
 */
async function promptForNxConsoleInstallation(): Promise<boolean> {
  try {
    output.log({
      title: "Install Nx's official editor extension to:",
      bodyLines: [
        '- Enable your AI assistant to do more by understanding your workspace',
        '- Add IntelliSense for Nx configuration files',
        '- Explore your workspace visually',
      ],
    });

    const { shouldInstallNxConsole } = await prompt<{
      shouldInstallNxConsole: boolean;
    }>({
      type: 'confirm',
      name: 'shouldInstallNxConsole',
      message: 'Install Nx Console? (you can uninstall anytime)',
      initial: true,
    });

    return shouldInstallNxConsole;
  } catch (error) {
    return false;
  }
}
