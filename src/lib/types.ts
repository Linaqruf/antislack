export type MathDifficulty = 'easy' | 'medium' | 'hard';
export type AutoRedirectMode = 'global' | 'always' | 'never';

export interface Settings {
  enabled: boolean;
  defaultRedirectUrl: string;
  bypassDurationMinutes: number;
  showBypassOption: boolean;
  mathDifficulty: MathDifficulty;
  autoRedirect: boolean;
  requirePassphraseToDisable: boolean;
}

export interface BlockedSite {
  id: string;
  pattern: string;
  redirectUrl?: string;              // Per-site custom redirect URL
  autoRedirectMode?: AutoRedirectMode;  // Per-site override: 'global' | 'always' | 'never'
  createdAt: number;
  blockCount: number;
  autoRedirectCount?: number;        // Per-site auto-redirect counter
}

export interface BypassSession {
  domain: string;      // Domain that's bypassed
  expiresAt: number;   // Timestamp when bypass expires
  grantedAt: number;   // When bypass was granted
}

export interface DailyStats {
  blocks: number;                    // Block page shown
  autoRedirects: number;             // Instant redirects (no block page)
  bypassAttempts: number;
  bypassSuccesses: number;
  siteBreakdown: Record<string, { blocks: number; bypasses: number; autoRedirects: number }>;
  /** Must be exactly 24 elements (one per hour 0-23) for heat map display */
  hourlyBlocks: number[];
  /** Must be exactly 24 elements (one per hour 0-23) for auto-redirect heat map */
  hourlyAutoRedirects: number[];
}

export interface UsageStats {
  daily: Record<string, DailyStats>;  // Key: ISO date (YYYY-MM-DD)
  streak: number;                      // Days without bypass
  lastBypassDate: string | null;       // ISO date of last bypass
  bestStreak: number;                  // All-time record
  totalBlocks: number;                 // Lifetime counter
  totalBypasses: number;               // Lifetime counter
  totalAutoRedirects: number;          // Lifetime auto-redirect counter
  nuclearCompletions: number;          // Completed lockdowns
  hardDifficultyBypasses: number;      // For achievement
}

export interface StorageData {
  settings: Settings;
  blockedSites: BlockedSite[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  defaultRedirectUrl: 'https://notion.so',
  bypassDurationMinutes: 15,
  showBypassOption: true,
  mathDifficulty: 'medium',
  autoRedirect: false,
  requirePassphraseToDisable: false,
};

// Use unique default IDs to prevent collision with user-added sites
export const DEFAULT_BLOCKED_SITES: BlockedSite[] = [
  { id: 'default-twitter', pattern: 'twitter.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-x', pattern: 'x.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-reddit', pattern: 'reddit.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-facebook', pattern: 'facebook.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-instagram', pattern: 'instagram.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-tiktok', pattern: 'tiktok.com', createdAt: Date.now(), blockCount: 0 },
  { id: 'default-youtube', pattern: 'youtube.com', createdAt: Date.now(), blockCount: 0 },
];

export interface NuclearMode {
  active: boolean;           // Whether nuclear mode is currently active
  expiresAt: number;         // Timestamp when lockdown ends
  startedAt: number;         // When lockdown began
  durationHours: 1 | 4 | 8 | 24;  // Selected duration in hours
  passphraseHash: string;    // Hashed emergency passphrase
}

export const DEFAULT_NUCLEAR_MODE: NuclearMode = {
  active: false,
  expiresAt: 0,
  startedAt: 0,
  durationHours: 1,
  passphraseHash: '',
};

export interface ProductivityScore {
  score: number;
  breakdown: {
    blocksToday: number;
    noBypass: number;
    streakBonus: number;
  };
  trend: -1 | 0 | 1;  // Down, stable, or up trend indicator
}
