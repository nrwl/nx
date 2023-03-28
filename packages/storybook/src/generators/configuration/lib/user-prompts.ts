import { UiFramework, UiFramework7 } from '@nrwl/storybook/src/utils/models';
import { Constants } from '@nrwl/storybook/src/utils/utilities';
import { prompt } from 'enquirer';
import { StorybookConfigureSchema } from '../schema';

export async function getGeneratorConfigurationOptions(
  rawSchema: StorybookConfigureSchema
): Promise<StorybookConfigureSchema> {
  if (rawSchema.storybook7Configuration) {
    if (!rawSchema.storybook7UiFramework) {
      rawSchema.storybook7UiFramework = await getStorybook7Framework();
    }
  } else {
    if (!rawSchema.uiFramework) {
      rawSchema.uiFramework = await getStorybook6Framework();
    }
  }
  if (
    rawSchema?.uiFramework === '@storybook/react' ||
    rawSchema?.uiFramework === '@storybook/web-components'
  ) {
    if (!rawSchema?.bundler) {
      rawSchema.bundler = await getBundler();
    }
  }

  return rawSchema;
}

export async function getBundler(): Promise<'vite' | 'webpack'> {
  const a = await prompt<{ bundler: 'vite' | 'webpack' }>([
    {
      name: 'bundler',
      message: `Choose the builder you want to use for Storybook`,
      type: 'autocomplete',
      choices: [
        {
          name: 'vite',
          message: 'Use Vite.js with the @storybook/builder-vite package',
        },
        {
          name: 'webpack',
          message: 'Use Webpack 5 with the @storybook/builder-webpack5 package',
        },
      ],
    },
  ]);
  return a.bundler;
}

export async function getStorybook7Framework(): Promise<UiFramework7> {
  const a = await prompt<{ UiFramework7: UiFramework7 }>([
    {
      name: 'UiFramework7',
      message: `Choose the Storybook 7 framework that you need to use`,
      type: 'autocomplete',
      choices: [
        ...Constants.uiFrameworks7.map((uiFramework7) => ({
          name: uiFramework7,
          message: uiFramework7,
        })),
      ],
    },
  ]);
  return a.UiFramework7;
}

export async function getStorybook6Framework(): Promise<UiFramework> {
  const a = await prompt<{ UiFramework: UiFramework }>([
    {
      name: 'UiFramework',
      message: `Choose the Storybook framework that you need to use`,
      type: 'autocomplete',
      choices: [
        ...Object.entries(Constants.uiFrameworks).map(
          ([_key, uiFramework]) => ({
            name: uiFramework,
            message: uiFramework,
          })
        ),
      ],
    },
  ]);
  return a.UiFramework;
}
