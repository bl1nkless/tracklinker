export interface OdesliLinks {
  pageUrl: string;
  entityUniqueId: string;
  linksByPlatform?: Record<
    string,
    {
      url: string;
      nativeAppUriDesktop?: string;
      nativeAppUriMobile?: string;
    }
  >;
}

export interface OdesliMatch {
  videoId: string | null;
  via: 'youtube' | 'youtubeMusic' | null;
  raw: OdesliLinks;
}

export interface OdesliOptions {
  apiKey?: string;
  userCountry?: string;
  signal?: AbortSignal;
}

const ODESLI_BASE = 'https://api.song.link/v1-alpha.1/links';

export async function mapSpotifyToYouTube(
  spotifyUrl: string,
  options: OdesliOptions = {},
): Promise<OdesliMatch> {
  const url = new URL(ODESLI_BASE);
  url.searchParams.set('url', spotifyUrl);

  if (options.userCountry) {
    url.searchParams.set('userCountry', options.userCountry);
  }

  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(url.toString(), {
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Odesli responded with ${response.status}`);
  }

  const payload = (await response.json()) as OdesliLinks;
  const links = payload.linksByPlatform ?? {};

  const youtube =
    links.youtubeMusic?.url ??
    links.youtube?.url ??
    links.youtubeMusic?.nativeAppUriDesktop ??
    links.youtube?.nativeAppUriDesktop ??
    '';

  return {
    videoId: extractVideoId(youtube),
    via: youtube.includes('music.youtube') ? 'youtubeMusic' : 'youtube',
    raw: payload,
  };
}

const YOUTUBE_VIDEO_REGEX =
  /(?:v=|\/videos\/|embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/;

export function extractVideoId(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const match = input.match(YOUTUBE_VIDEO_REGEX);
  return match?.[1] ?? null;
}
