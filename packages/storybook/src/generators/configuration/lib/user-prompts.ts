import { UiFramework7 } from '../../../utils/models';
import { Constants } from '../../../utils/utilities';
import { prompt } from 'enquirer';
import { StorybookConfigureSchema } from '../schema';

export async function getGeneratorConfigurationOptions(
  rawSchema: StorybookConfigureSchema
): Promise<StorybookConfigureSchema> {
  if (!rawSchema.uiFramework) {
    rawSchema.uiFramework = await getStorybook7Framework();
  }

  return rawSchema;
}

export async function getStorybook7Framework(): Promise<UiFramework7> {
  const a = await prompt<{ UiFramework: UiFramework7 }>([
    {
      name: 'UiFramework',
      message: `Choose the Storybook 7 framework that you need to use`,
      type: 'autocomplete',
      choices: [
        ...Constants.uiFrameworks7.map((uiFramework) => ({
          name: uiFramework,
          message: uiFramework,
        })),
      ],
    },
  ]);
  return a.UiFramework;
}
