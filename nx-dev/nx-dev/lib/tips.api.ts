import { TipsApi } from '@nx/nx-dev/data-access-documents/node-only';

export const tipsApi = new TipsApi({
  id: 'your-id',
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
});
