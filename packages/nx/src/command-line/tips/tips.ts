import * as pc from 'picocolors';
import { output } from '../../utils/output';
import {
  buildTipContext,
  disableTips,
  enableTips,
  formatTip,
  selectTip,
} from '../../utils/tips/tips';

export type TipsSubcommand = 'enable' | 'disable' | 'show';

export async function handleTipsCommand(
  subcommand: TipsSubcommand
): Promise<number> {
  switch (subcommand) {
    case 'enable': {
      enableTips();
      output.success({
        title: 'Nx tips enabled',
        bodyLines: [
          'A tip will appear in the run summary footer after successful runs.',
          pc.dim('Disable at any time with: nx tips disable'),
        ],
      });
      return 0;
    }

    case 'disable': {
      disableTips();
      output.success({
        title: 'Nx tips disabled',
        bodyLines: [
          'No tips will appear in run summaries.',
          pc.dim('Re-enable at any time with: nx tips enable'),
        ],
      });
      return 0;
    }

    case 'show': {
      const ctx = buildTipContext();
      const tip = selectTip(ctx);
      if (!tip) {
        output.warn({ title: 'No tips available for current context.' });
        return 0;
      }
      process.stdout.write(formatTip(tip, ctx));
      return 0;
    }

    default: {
      output.error({ title: `Unknown subcommand: ${subcommand}` });
      return 1;
    }
  }
}
