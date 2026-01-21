/**
 * Nuclear Mode Module
 * Provides hardcore lockdown functionality with no bypass option
 */

import { NuclearMode, DEFAULT_NUCLEAR_MODE } from './types';
import { hashPassphrase, verifyPassphrase } from './crypto';
import { handleStorageError } from './errors';

const NUCLEAR_ALARM_NAME = 'nuclear-mode-expiration';
const STORAGE_KEY = 'nuclearMode';

// ============== Result Types ==============

export interface NuclearModeResult {
  mode: NuclearMode;
  error?: string;
}

// ============== Storage ==============

export async function getNuclearMode(): Promise<NuclearModeResult> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (!result[STORAGE_KEY]) return { mode: DEFAULT_NUCLEAR_MODE };
    return {
      mode: {
        ...DEFAULT_NUCLEAR_MODE,
        ...result[STORAGE_KEY],
      },
    };
  } catch (error) {
    handleStorageError(error, 'getNuclearMode');
    // SECURITY: On error, assume nuclear mode is active to fail-safe
    // This prevents bypassing nuclear mode due to storage errors
    return {
      mode: { ...DEFAULT_NUCLEAR_MODE, active: true },
      error: 'Could not verify nuclear mode status',
    };
  }
}

export async function setNuclearMode(mode: NuclearMode): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: mode });
  } catch (error) {
    handleStorageError(error, 'setNuclearMode');
    throw error;
  }
}

export async function clearNuclearMode(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (error) {
    handleStorageError(error, 'clearNuclearMode');
    throw error;
  }
}

// ============== State Management ==============

export async function isNuclearModeActive(): Promise<{ active: boolean; error?: string }> {
  const { mode, error } = await getNuclearMode();

  // If there was an error reading, fail-safe to active (blocking continues)
  if (error) {
    return { active: true, error };
  }

  if (!mode.active) return { active: false };
  if (mode.expiresAt <= Date.now()) {
    // Mode expired, clean up
    try {
      await deactivateNuclearMode();
    } catch (e) {
      // Log but don't block - mode is expired
      console.error('AntiSlack: Failed to deactivate expired nuclear mode:', e);
    }
    return { active: false };
  }
  return { active: true };
}

export async function getRemainingTime(): Promise<number> {
  const { mode } = await getNuclearMode();
  if (!mode.active) return 0;
  const remaining = mode.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

// ============== Activation/Deactivation ==============

export async function activateNuclearMode(
  durationHours: number,
  passphrase: string
): Promise<void> {
  // Hash the passphrase
  const passphraseHash = await hashPassphrase(passphrase);

  const now = Date.now();
  const expiresAt = now + durationHours * 60 * 60 * 1000;

  const mode: NuclearMode = {
    active: true,
    expiresAt,
    startedAt: now,
    durationHours,
    passphraseHash,
  };

  // Save to storage
  await setNuclearMode(mode);

  // Create alarm for expiration
  await chrome.alarms.create(NUCLEAR_ALARM_NAME, {
    when: expiresAt,
  });

  console.log(
    `AntiSlack: Nuclear mode activated for ${durationHours} hour(s), expires at ${new Date(expiresAt).toLocaleString()}`
  );
}

export async function deactivateNuclearMode(): Promise<void> {
  // Clear the alarm
  await chrome.alarms.clear(NUCLEAR_ALARM_NAME);

  // Reset to default state
  await setNuclearMode(DEFAULT_NUCLEAR_MODE);

  console.log('AntiSlack: Nuclear mode deactivated');
}

// ============== Emergency Abort ==============

export async function verifyEmergencyAbort(passphrase: string): Promise<{ success: boolean; error?: string }> {
  const { mode, error } = await getNuclearMode();

  if (error) {
    return { success: false, error: 'Cannot verify: storage error' };
  }

  if (!mode.active || !mode.passphraseHash) {
    return { success: false, error: 'Nuclear mode not active' };
  }

  return await verifyPassphrase(passphrase, mode.passphraseHash);
}

// ============== Alarm Handler Export ==============

export const NUCLEAR_ALARM = NUCLEAR_ALARM_NAME;

// ============== Utilities ==============

/**
 * Format remaining time in milliseconds to hours:minutes:seconds display strings
 */
export function formatRemainingTime(ms: number): { hours: string; minutes: string; seconds: string } {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return {
    hours: hours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
  };
}
