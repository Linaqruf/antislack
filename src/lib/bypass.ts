import { BypassSession } from './types';
import { handleStorageError, logError } from './errors';

const BYPASS_SESSIONS_KEY = 'bypassSessions';

export async function getBypassSessions(): Promise<BypassSession[]> {
  try {
    const result = await chrome.storage.local.get(BYPASS_SESSIONS_KEY);
    return result[BYPASS_SESSIONS_KEY] ?? [];
  } catch (error) {
    handleStorageError(error, 'getBypassSessions');
    return [];
  }
}

async function setBypassSessions(sessions: BypassSession[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [BYPASS_SESSIONS_KEY]: sessions });
  } catch (error) {
    handleStorageError(error, 'setBypassSessions');
    throw error;
  }
}

export async function addBypassSession(
  domain: string,
  durationMinutes: number
): Promise<BypassSession> {
  try {
    const sessions = await getBypassSessions();
    const now = Date.now();
    const expiresAt = now + durationMinutes * 60 * 1000;

    // Remove any existing session for this domain
    const filtered = sessions.filter((s) => s.domain !== domain);

    const newSession: BypassSession = {
      domain,
      expiresAt,
      grantedAt: now,
    };

    filtered.push(newSession);
    await setBypassSessions(filtered);

    // Create alarm for expiration
    await createBypassAlarm(domain, expiresAt);

    return newSession;
  } catch (error) {
    logError('addBypassSession', error, { domain, durationMinutes });
    throw error;
  }
}

export async function removeBypassSession(domain: string): Promise<void> {
  try {
    const sessions = await getBypassSessions();
    const filtered = sessions.filter((s) => s.domain !== domain);
    await setBypassSessions(filtered);

    // Clear the alarm
    await chrome.alarms.clear(`bypass-expire-${domain}`);
  } catch (error) {
    logError('removeBypassSession', error, { domain });
    throw error;
  }
}

export async function isDomainBypassed(domain: string): Promise<boolean> {
  try {
    const sessions = await getBypassSessions();
    const now = Date.now();

    return sessions.some(
      (s) =>
        (s.domain === domain || domain.endsWith('.' + s.domain)) &&
        s.expiresAt > now
    );
  } catch (error) {
    logError('isDomainBypassed', error, { domain });
    return false;
  }
}

export async function cleanExpiredSessions(): Promise<void> {
  try {
    const sessions = await getBypassSessions();
    const now = Date.now();
    const activeSessions = sessions.filter((s) => s.expiresAt > now);

    if (activeSessions.length !== sessions.length) {
      await setBypassSessions(activeSessions);
      console.log(
        `AntiSlack: Cleaned ${sessions.length - activeSessions.length} expired bypass sessions`
      );
    }
  } catch (error) {
    logError('cleanExpiredSessions', error);
  }
}

export async function createBypassAlarm(
  domain: string,
  expiresAt: number
): Promise<void> {
  try {
    await chrome.alarms.create(`bypass-expire-${domain}`, {
      when: expiresAt,
    });
  } catch (error) {
    logError('createBypassAlarm', error, { domain, expiresAt });
    throw error;
  }
}

export async function getActiveBypassedDomains(): Promise<string[]> {
  try {
    const sessions = await getBypassSessions();
    const now = Date.now();

    return sessions.filter((s) => s.expiresAt > now).map((s) => s.domain);
  } catch (error) {
    logError('getActiveBypassedDomains', error);
    return [];
  }
}
