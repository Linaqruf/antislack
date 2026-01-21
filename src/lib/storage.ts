import {
  Settings,
  BlockedSite,
  UsageStats,
  NuclearMode,
  DEFAULT_SETTINGS,
  DEFAULT_BLOCKED_SITES,
  DEFAULT_NUCLEAR_MODE,
  MathDifficulty,
  AutoRedirectMode,
} from './types';
import { getUsageStats } from './stats';
import { handleStorageError, logError } from './errors';

// ============== Type Validation Helpers ==============

const VALID_MATH_DIFFICULTIES: MathDifficulty[] = ['easy', 'medium', 'hard'];
const VALID_AUTO_REDIRECT_MODES: AutoRedirectMode[] = ['global', 'always', 'never'];

export function isValidMathDifficulty(value: unknown): value is MathDifficulty {
  return typeof value === 'string' && VALID_MATH_DIFFICULTIES.includes(value as MathDifficulty);
}

export function isValidAutoRedirectMode(value: unknown): value is AutoRedirectMode {
  return typeof value === 'string' && VALID_AUTO_REDIRECT_MODES.includes(value as AutoRedirectMode);
}

/**
 * Normalize and validate blocked sites from import data
 */
function normalizeBlockedSites(sites: unknown[]): BlockedSite[] {
  return sites
    .filter((site): site is Record<string, unknown> =>
      site !== null &&
      typeof site === 'object' &&
      'pattern' in site &&
      typeof (site as Record<string, unknown>).pattern === 'string'
    )
    .map((site) => ({
      id: typeof site.id === 'string' ? site.id : crypto.randomUUID(),
      pattern: String(site.pattern).toLowerCase().trim(),
      redirectUrl: typeof site.redirectUrl === 'string' ? site.redirectUrl : undefined,
      autoRedirectMode: isValidAutoRedirectMode(site.autoRedirectMode) ? site.autoRedirectMode : undefined,
      createdAt: typeof site.createdAt === 'number' ? site.createdAt : Date.now(),
      blockCount: typeof site.blockCount === 'number' ? site.blockCount : 0,
      autoRedirectCount: typeof site.autoRedirectCount === 'number' ? site.autoRedirectCount : 0,
    }));
}

// ============== Result Types ==============

export interface PassphraseHashResult {
  hash: string | null;
  error?: string;
}

// ============== Passphrase Storage (chrome.storage.local) ==============

export async function getPassphraseHash(): Promise<PassphraseHashResult> {
  try {
    const result = await chrome.storage.local.get('passphraseHash');
    return { hash: result.passphraseHash ?? null };
  } catch (error) {
    handleStorageError(error, 'getPassphraseHash');
    // Return error state - caller should handle appropriately
    return { hash: null, error: 'Could not read passphrase' };
  }
}

export async function setPassphraseHash(hash: string): Promise<void> {
  try {
    await chrome.storage.local.set({ passphraseHash: hash });
  } catch (error) {
    handleStorageError(error, 'setPassphraseHash');
    throw error;
  }
}

export async function clearPassphraseHash(): Promise<void> {
  try {
    await chrome.storage.local.remove('passphraseHash');
  } catch (error) {
    handleStorageError(error, 'clearPassphraseHash');
    throw error;
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.sync.get('settings');
    if (!result.settings) return DEFAULT_SETTINGS;
    // Merge with defaults to handle backward compatibility
    return {
      ...DEFAULT_SETTINGS,
      ...result.settings,
    };
  } catch (error) {
    handleStorageError(error, 'getSettings');
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.sync.set({ settings });
  } catch (error) {
    handleStorageError(error, 'setSettings');
    throw error;
  }
}

export async function getBlockedSites(): Promise<BlockedSite[]> {
  try {
    const result = await chrome.storage.sync.get('blockedSites');
    return result.blockedSites ?? DEFAULT_BLOCKED_SITES;
  } catch (error) {
    handleStorageError(error, 'getBlockedSites');
    return DEFAULT_BLOCKED_SITES;
  }
}

export async function setBlockedSites(sites: BlockedSite[]): Promise<void> {
  try {
    await chrome.storage.sync.set({ blockedSites: sites });
  } catch (error) {
    handleStorageError(error, 'setBlockedSites');
    throw error;
  }
}

export async function addBlockedSite(pattern: string): Promise<BlockedSite> {
  const sites = await getBlockedSites();
  const newSite: BlockedSite = {
    id: crypto.randomUUID(),
    pattern: pattern.toLowerCase().trim(),
    createdAt: Date.now(),
    blockCount: 0,
    autoRedirectCount: 0,
  };
  sites.push(newSite);
  await setBlockedSites(sites);
  return newSite;
}

export async function removeBlockedSite(id: string): Promise<void> {
  const sites = await getBlockedSites();
  const filtered = sites.filter((site) => site.id !== id);
  await setBlockedSites(filtered);
}

export async function updateBlockedSite(
  id: string,
  updates: Partial<Pick<BlockedSite, 'redirectUrl' | 'autoRedirectMode'>>
): Promise<void> {
  // Validate redirect URL if provided
  if (updates.redirectUrl !== undefined && updates.redirectUrl !== '') {
    try {
      new URL(updates.redirectUrl);
    } catch {
      throw new Error('Invalid redirect URL');
    }
  }

  const sites = await getBlockedSites();
  const index = sites.findIndex((s) => s.id === id);
  if (index === -1) throw new Error(`Site not found: ${id}`);
  sites[index] = { ...sites[index], ...updates };
  await setBlockedSites(sites);
}

export async function incrementSiteAutoRedirectCount(pattern: string): Promise<void> {
  try {
    const sites = await getBlockedSites();
    const site = sites.find((s) => s.pattern === pattern);
    if (!site) {
      logError('incrementSiteAutoRedirectCount', new Error('Site not found'), { pattern });
      return;
    }
    site.autoRedirectCount = (site.autoRedirectCount || 0) + 1;
    await setBlockedSites(sites);
  } catch (error) {
    handleStorageError(error, 'incrementSiteAutoRedirectCount');
  }
}

export async function toggleEnabled(): Promise<boolean> {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  await setSettings(settings);
  return settings.enabled;
}

export async function initializeStorage(): Promise<void> {
  const result = await chrome.storage.sync.get(['settings', 'blockedSites']);

  if (!result.settings) {
    await setSettings(DEFAULT_SETTINGS);
  }

  if (!result.blockedSites) {
    await setBlockedSites(DEFAULT_BLOCKED_SITES);
  }
}

interface ExportData {
  version: number;
  exportedAt: string;
  blockedSites: BlockedSite[];
  settings?: Settings;
  stats?: UsageStats;
  nuclearMode?: NuclearMode;
}

/**
 * Runtime type guard for export data validation
 * Validates structure more deeply to catch malformed imports
 */
function isValidExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.version !== 'number') return false;
  if (obj.version !== 1) return false; // Only support version 1

  if (!Array.isArray(obj.blockedSites)) return false;

  // Validate blocked sites have required structure
  for (const site of obj.blockedSites) {
    if (!site || typeof site !== 'object') return false;
    const s = site as Record<string, unknown>;
    if (typeof s.pattern !== 'string' || s.pattern.trim() === '') return false;
  }

  // Validate optional settings if present
  if (obj.settings !== undefined) {
    if (typeof obj.settings !== 'object' || obj.settings === null) return false;
    const settings = obj.settings as Record<string, unknown>;
    // Check that mathDifficulty is valid if present
    if (settings.mathDifficulty !== undefined && !isValidMathDifficulty(settings.mathDifficulty)) {
      return false;
    }
  }

  return true;
}

export async function exportBlocklist(): Promise<string> {
  const blockedSites = await getBlockedSites();
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    blockedSites,
  };
  return JSON.stringify(data, null, 2);
}

export async function importBlocklist(json: string): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const parsed = JSON.parse(json);

    // Runtime validation of parsed data
    if (!isValidExportData(parsed)) {
      return { success: false, count: 0, error: 'Invalid export data format' };
    }

    const validSites = normalizeBlockedSites(parsed.blockedSites);

    if (validSites.length === 0) {
      return { success: false, count: 0, error: 'No valid sites found in import data' };
    }

    await setBlockedSites(validSites);
    return { success: true, count: validSites.length };
  } catch (e) {
    return { success: false, count: 0, error: 'Invalid JSON format' };
  }
}

export async function exportAllData(): Promise<string> {
  const [blockedSites, settings, stats] = await Promise.all([
    getBlockedSites(),
    getSettings(),
    getUsageStats(),
  ]);

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    blockedSites,
    settings,
    stats,
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const parsed = JSON.parse(json);

    // Runtime validation of parsed data (includes version check)
    if (!isValidExportData(parsed)) {
      return { success: false, error: 'Invalid export data format' };
    }

    const data = parsed;

    // Import blocked sites using shared normalizer
    const validSites = normalizeBlockedSites(data.blockedSites);
    if (validSites.length > 0) {
      await setBlockedSites(validSites);
    }

    // Import settings with validated mathDifficulty
    if (data.settings) {
      const importedSettings = data.settings as Record<string, unknown>;
      const settings: Settings = {
        enabled: typeof importedSettings.enabled === 'boolean'
          ? importedSettings.enabled
          : DEFAULT_SETTINGS.enabled,
        defaultRedirectUrl: typeof importedSettings.defaultRedirectUrl === 'string'
          ? importedSettings.defaultRedirectUrl
          : DEFAULT_SETTINGS.defaultRedirectUrl,
        bypassDurationMinutes: typeof importedSettings.bypassDurationMinutes === 'number'
          ? importedSettings.bypassDurationMinutes
          : DEFAULT_SETTINGS.bypassDurationMinutes,
        showBypassOption: typeof importedSettings.showBypassOption === 'boolean'
          ? importedSettings.showBypassOption
          : DEFAULT_SETTINGS.showBypassOption,
        mathDifficulty: isValidMathDifficulty(importedSettings.mathDifficulty)
          ? importedSettings.mathDifficulty
          : DEFAULT_SETTINGS.mathDifficulty,
        autoRedirect: typeof importedSettings.autoRedirect === 'boolean'
          ? importedSettings.autoRedirect
          : DEFAULT_SETTINGS.autoRedirect,
        requirePassphraseToDisable: typeof importedSettings.requirePassphraseToDisable === 'boolean'
          ? importedSettings.requirePassphraseToDisable
          : DEFAULT_SETTINGS.requirePassphraseToDisable,
      };
      await setSettings(settings);
    }

    if (data.stats) {
      await chrome.storage.local.set({ usageStats: data.stats });
    }

    // SECURITY: Nuclear mode is deliberately NOT imported from backups.
    // Importing nuclear mode as active would be a security risk, as users could
    // accidentally import an old backup with active nuclear mode and different passphrase.
    // Nuclear mode must always be activated manually with a fresh passphrase.

    return { success: true };
  } catch (e) {
    return { success: false, error: 'Invalid JSON format' };
  }
}
