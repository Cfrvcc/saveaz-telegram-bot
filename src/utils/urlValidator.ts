export type SupportedPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook';

export interface ValidatedMediaUrl {
  isValid: boolean;
  rawUrl: string;
  normalizedUrl: string;
  platform?: SupportedPlatform;
  isShorts?: boolean;
  isPlaylist?: boolean;
  playlistId?: string;
  videoId?: string;
  error?: string;
}

// Disallowed private / internal IPs and hostnames
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP/Azure instance metadata
  'metadata.google.internal',
  'instance-data',
]);

function isPrivateIp(hostname: string): boolean {
  // IPv4 regex check
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [_, o1, o2] = ipv4Match.map(Number);
    // 127.0.0.0/8
    if (o1 === 127) return true;
    // 10.0.0.0/8
    if (o1 === 10) return true;
    // 172.16.0.0/12
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16
    if (o1 === 192 && o2 === 168) return true;
    // 169.254.0.0/16 (Link-local & cloud metadata)
    if (o1 === 169 && o2 === 254) return true;
    // 0.0.0.0
    if (o1 === 0) return true;
  }
  return false;
}

/**
 * Extracts the first valid HTTP/HTTPS URL from arbitrary user text.
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>"'{}|\\^`[\]]+)/i;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
}

/**
 * Validates URL for SSRF protection and identifies platform & type.
 */
export function validateMediaUrl(inputUrl: string): ValidatedMediaUrl {
  if (!inputUrl || inputUrl.length > 2048) {
    return {
      isValid: false,
      rawUrl: inputUrl,
      normalizedUrl: '',
      error: 'URL çox uzundur və ya boşdur.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    return {
      isValid: false,
      rawUrl: inputUrl,
      normalizedUrl: '',
      error: 'Daxil edilən link düzgün formatda deyil.',
    };
  }

  // Enforce HTTP / HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      rawUrl: inputUrl,
      normalizedUrl: '',
      error: 'Yalnız təhlükəsiz HTTP və HTTPS protokolları dəstəklənir.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Protection
  if (BLOCKED_HOSTNAMES.has(hostname) || isPrivateIp(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return {
      isValid: false,
      rawUrl: inputUrl,
      normalizedUrl: '',
      error: 'Təhlükəsizlik səbəbilə daxili şəbəkə ünvanlarına icazə verilmir.',
    };
  }

  // Detect Platform
  let platform: SupportedPlatform | undefined;
  let isShorts = false;
  let isPlaylist = false;
  let playlistId: string | undefined;
  let videoId: string | undefined;

  // TikTok
  if (
    hostname.includes('tiktok.com') ||
    hostname === 'vm.tiktok.com' ||
    hostname === 'vt.tiktok.com'
  ) {
    platform = 'tiktok';
  }
  // YouTube
  else if (
    hostname.includes('youtube.com') ||
    hostname === 'youtu.be'
  ) {
    platform = 'youtube';
    if (parsed.pathname.includes('/shorts/')) {
      isShorts = true;
      videoId = parsed.pathname.split('/shorts/')[1]?.split(/[?#]/)[0];
    } else if (parsed.searchParams.has('v')) {
      videoId = parsed.searchParams.get('v') || undefined;
    } else if (hostname === 'youtu.be') {
      videoId = parsed.pathname.replace('/', '').split(/[?#]/)[0];
    }

    if (parsed.searchParams.has('list')) {
      isPlaylist = true;
      playlistId = parsed.searchParams.get('list') || undefined;
    }
  }
  // Instagram
  else if (hostname.includes('instagram.com') || hostname === 'instagr.am') {
    platform = 'instagram';
    if (parsed.pathname.includes('/reel/')) {
      isShorts = true;
    }
  }
  // Facebook
  else if (
    hostname.includes('facebook.com') ||
    hostname === 'fb.watch' ||
    hostname === 'fb.com'
  ) {
    platform = 'facebook';
    if (parsed.pathname.includes('/reel/')) {
      isShorts = true;
    }
  }

  if (!platform) {
    return {
      isValid: false,
      rawUrl: inputUrl,
      normalizedUrl: parsed.toString(),
      error: '❌ Bu linki hazırda dəstəkləyə bilmirik. (Yalnız TikTok, YouTube, Instagram və Facebook dəstəklənir)',
    };
  }

  return {
    isValid: true,
    rawUrl: inputUrl,
    normalizedUrl: parsed.toString(),
    platform,
    isShorts,
    isPlaylist,
    playlistId,
    videoId,
  };
}
