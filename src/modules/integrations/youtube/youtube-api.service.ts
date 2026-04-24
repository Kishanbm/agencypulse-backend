import { Injectable, BadRequestException } from '@nestjs/common';
import { fetchWithTimeout } from '../../../common/http/fetch-with-timeout';

// YouTube Data API v3 — channel listing
const YOUTUBE_DATA_BASE = 'https://www.googleapis.com/youtube/v3';
// YouTube Analytics API v2 — performance data
const YOUTUBE_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';

export interface YoutubeChannel {
  id: string;          // e.g. "UCxxxxxxxxxxxxxxxxxxxxxx"
  title: string;       // Channel display name
  subscriberCount: number;
  viewCount: number;
}

export interface YoutubeMetricRow {
  date: string;                         // YYYY-MM-DD
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;          // seconds
  likes: number;
  comments: number;
  subscribersGained: number;
  subscribersLost: number;
}

@Injectable()
export class YoutubeApiService {
  // ─── List channels ────────────────────────────────────────────────────────
  // Returns YouTube channels the authenticated user owns.
  // Used after OAuth to let the user pick their channel.

  async listChannels(accessToken: string): Promise<YoutubeChannel[]> {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      mine: 'true',
      maxResults: '50',
    });

    const response = await fetchWithTimeout(
      `${YOUTUBE_DATA_BASE}/channels?${params.toString()}`,
      { headers: this.authHeader(accessToken) },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch YouTube channels. Check connection status.');
    }

    const data = await response.json() as {
      items?: Array<{
        id: string;
        snippet: { title: string };
        statistics: { viewCount?: string; subscriberCount?: string };
      }>;
    };

    return (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet.title,
      subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
      viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    }));
  }

  // ─── Fetch core metrics ────────────────────────────────────────────────────
  // Returns daily YouTube Analytics for a channel over a date range.
  // channelId: YouTube channel ID (e.g. "UCxxxxxx"), stored as externalAccountId.
  //
  // YouTube Analytics API response format:
  //   { columnHeaders: [{name, dataType}], rows: [[day, views, ...], ...] }
  //   rows is a 2D array — mapped using columnHeaders indices.

  async fetchCoreMetrics(
    accessToken: string,
    channelId: string,
    from: string,
    to: string,
  ): Promise<YoutubeMetricRow[]> {
    const params = new URLSearchParams({
      ids: `channel==${channelId}`,
      startDate: from,
      endDate: to,
      metrics: [
        'views',
        'estimatedMinutesWatched',
        'averageViewDuration',
        'likes',
        'comments',
        'subscribersGained',
        'subscribersLost',
      ].join(','),
      dimensions: 'day',
      sort: 'day',
    });

    const response = await fetchWithTimeout(
      `${YOUTUBE_ANALYTICS_BASE}/reports?${params.toString()}`,
      { headers: this.authHeader(accessToken) },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'YouTube Analytics report request failed. Check the channel ID and permissions.',
      );
    }

    const data = await response.json() as {
      columnHeaders?: Array<{ name: string; dataType: string }>;
      rows?: Array<Array<string | number>>;
    };

    if (!data.rows || data.rows.length === 0) return [];

    // Build column name → index map from headers
    const headers = data.columnHeaders ?? [];
    const colIndex = Object.fromEntries(headers.map((h, i) => [h.name, i]));

    const get = (row: Array<string | number>, col: string): number => {
      const val = row[colIndex[col]];
      return typeof val === 'number' ? val : parseFloat(String(val ?? '0'));
    };

    return data.rows.map((row) => ({
      date: String(row[colIndex['day']]),     // YYYY-MM-DD
      views: get(row, 'views'),
      estimatedMinutesWatched: get(row, 'estimatedMinutesWatched'),
      averageViewDuration: get(row, 'averageViewDuration'),
      likes: get(row, 'likes'),
      comments: get(row, 'comments'),
      subscribersGained: get(row, 'subscribersGained'),
      subscribersLost: get(row, 'subscribersLost'),
    }));
  }

  private authHeader(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` };
  }
}
