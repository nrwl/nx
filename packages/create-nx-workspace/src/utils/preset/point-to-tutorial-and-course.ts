import { output } from '../output';
import { Preset } from './preset';

export function pointToTutorialAndCourse(preset: Preset) {
  const title = `First time using Nx? Check out this interactive Nx tutorial.`;
  switch (preset) {
    case Preset.Empty:
    case Preset.NPM:
    case Preset.Apps:
    case Preset.Core:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/tutorials/package-based-repo-tutorial`],
      });
      break;

    case Preset.TS:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/tutorials/integrated-repo-tutorial`],
      });
      break;
    case Preset.ReactStandalone:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/tutorials/react-standalone-tutorial`],
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
        bodyLines: [`https://nx.dev/tutorials/angular-standalone-tutorial`],
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
        bodyLines: [`https://nx.dev/tutorials/node-server-tutorial`],
      });
      break;
  }
}
