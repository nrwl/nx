import { output } from '../output';
import { Preset } from './preset';

export function pointToTutorialAndCourse(preset: Preset) {
  const title = `First time using Nx? Check out this interactive Nx tutorial.`;
  switch (preset) {
    case Preset.NPM:
    case Preset.Apps:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/getting-started/tutorials/npm-workspaces-tutorial`,
        ],
      });
      break;

    case Preset.TS:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/getting-started/tutorials/integrated-repo-tutorial`,
        ],
      });
      break;
    case Preset.ReactStandalone:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/getting-started/tutorials/react-standalone-tutorial`,
        ],
      });
      break;
    case Preset.ReactMonorepo:
    case Preset.NextJs:
    case Preset.NextJsStandalone:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/react-tutorial/1-code-generation`],
      });
      break;
    case Preset.AngularStandalone:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/getting-started/tutorials/angular-standalone-tutorial`,
        ],
      });
      break;
    case Preset.AngularMonorepo:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/angular-tutorial/1-code-generation`],
      });
      break;
    case Preset.Express:
    case Preset.NodeStandalone:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/getting-started/tutorials/node-server-tutorial`,
        ],
      });
      break;
  }
}
