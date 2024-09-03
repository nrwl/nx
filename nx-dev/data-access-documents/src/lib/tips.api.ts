import { google } from 'googleapis';

export class TipsApi {
  private youtube;

  constructor(
    private readonly options: {
      id: string;
      youtubeApiKey: string;
    }
  ) {
    if (!options.id) {
      throw new Error('id cannot be undefined');
    }
    if (!options.youtubeApiKey) {
      throw new Error('youtubeApiKey cannot be undefined');
    }
    this.youtube = google.youtube({
      version: 'v3',
      auth: options.youtubeApiKey,
    });
  }

  async getTips() {
    try {
      const channelId = 'UCF8luR7ORJTCwSNA9yZksCw'; // Nx YouTube channel ID

      // Fetch the recent videos from the channel
      const videosResponse = await this.youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        order: 'date',
        type: 'video',
        maxResults: 50, // Adjust this number as needed
      });

      // console.log('API Response:', JSON.stringify(videosResponse.data, null, 2));

      if (
        !videosResponse.data.items ||
        videosResponse.data.items.length === 0
      ) {
        console.warn('No videos found for the specified channel');
        return [];
      }

      // Filter out live streams and transform the data
      return videosResponse.data.items
        .filter((item) => item.snippet.liveBroadcastContent !== 'live')
        .map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnailUrl: item.snippet.thumbnails.medium.url,
          publishedAt: item.snippet.publishedAt,
        }));
    } catch (error) {
      console.error('Error fetching YouTube videos:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      return [];
    }
  }
}
