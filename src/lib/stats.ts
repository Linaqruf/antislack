import { UsageStats, DailyStats, MathDifficulty } from './types';
import { handleStorageError, logError } from './errors';

const STATS_KEY = 'usageStats';
const MAX_DAYS = 90;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getEmptyDailyStats(): DailyStats {
  return {
    blocks: 0,
    autoRedirects: 0,
    bypassAttempts: 0,
    bypassSuccesses: 0,
    siteBreakdown: {},
    hourlyBlocks: new Array(24).fill(0),
    hourlyAutoRedirects: new Array(24).fill(0),
  };
}

/**
 * Ensures daily stats exist for the given date and hourly arrays are valid
 * Returns the daily stats object for the date
 */
function ensureDailyStats(stats: UsageStats, date: string): DailyStats {
  if (!stats.daily[date]) {
    stats.daily[date] = getEmptyDailyStats();
  }
  // Ensure hourlyBlocks array exists and has 24 elements
  if (!stats.daily[date].hourlyBlocks || stats.daily[date].hourlyBlocks.length !== 24) {
    stats.daily[date].hourlyBlocks = new Array(24).fill(0);
  }
  // Ensure hourlyAutoRedirects array exists and has 24 elements
  if (!stats.daily[date].hourlyAutoRedirects || stats.daily[date].hourlyAutoRedirects.length !== 24) {
    stats.daily[date].hourlyAutoRedirects = new Array(24).fill(0);
  }
  // Ensure autoRedirects counter exists
  if (stats.daily[date].autoRedirects === undefined) {
    stats.daily[date].autoRedirects = 0;
  }
  return stats.daily[date];
}

function getDefaultStats(): UsageStats {
  return {
    daily: {},
    streak: 0,
    lastBypassDate: null,
    bestStreak: 0,
    totalBlocks: 0,
    totalBypasses: 0,
    totalAutoRedirects: 0,
    nuclearCompletions: 0,
    hardDifficultyBypasses: 0,
  };
}

export async function getUsageStats(): Promise<UsageStats> {
  try {
    const result = await chrome.storage.local.get(STATS_KEY);
    return result[STATS_KEY] ?? getDefaultStats();
  } catch (error) {
    handleStorageError(error, 'getUsageStats');
    return getDefaultStats();
  }
}

async function saveUsageStats(stats: UsageStats): Promise<void> {
  try {
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  } catch (error) {
    handleStorageError(error, 'saveUsageStats');
    throw error;
  }
}

export async function migrateStatsIfNeeded(): Promise<void> {
  try {
    const stats = await getUsageStats();
    let needsSave = false;

    // Calculate missing fields from existing data
    let totalBlocks = 0;
    let totalBypasses = 0;
    let totalAutoRedirects = 0;

    for (const dayStats of Object.values(stats.daily)) {
      totalBlocks += dayStats.blocks || 0;
      totalBypasses += dayStats.bypassSuccesses || 0;
      totalAutoRedirects += dayStats.autoRedirects || 0;

      // Add hourlyBlocks to existing daily stats if missing
      if (!dayStats.hourlyBlocks) {
        dayStats.hourlyBlocks = new Array(24).fill(0);
        needsSave = true;
      }

      // Add hourlyAutoRedirects to existing daily stats if missing
      if (!dayStats.hourlyAutoRedirects) {
        dayStats.hourlyAutoRedirects = new Array(24).fill(0);
        needsSave = true;
      }

      // Add autoRedirects counter if missing
      if (dayStats.autoRedirects === undefined) {
        dayStats.autoRedirects = 0;
        needsSave = true;
      }

      // Migrate siteBreakdown entries to include autoRedirects
      for (const domain of Object.keys(dayStats.siteBreakdown)) {
        if ((dayStats.siteBreakdown[domain] as { autoRedirects?: number }).autoRedirects === undefined) {
          (dayStats.siteBreakdown[domain] as { autoRedirects: number }).autoRedirects = 0;
          needsSave = true;
        }
      }
    }

    // Migrate lifetime counters
    if (stats.bestStreak === undefined) {
      stats.bestStreak = stats.streak || 0;
      needsSave = true;
    }
    if (stats.totalBlocks === undefined) {
      stats.totalBlocks = totalBlocks;
      needsSave = true;
    }
    if (stats.totalBypasses === undefined) {
      stats.totalBypasses = totalBypasses;
      needsSave = true;
    }
    if (stats.totalAutoRedirects === undefined) {
      stats.totalAutoRedirects = totalAutoRedirects;
      needsSave = true;
    }
    if (stats.nuclearCompletions === undefined) {
      stats.nuclearCompletions = 0;
      needsSave = true;
    }
    if (stats.hardDifficultyBypasses === undefined) {
      stats.hardDifficultyBypasses = 0;
      needsSave = true;
    }

    if (needsSave) {
      await saveUsageStats(stats);
    }
  } catch (error) {
    logError('migrateStatsIfNeeded', error);
  }
}

function pruneOldStats(stats: UsageStats): UsageStats {
  const dates = Object.keys(stats.daily).sort();
  if (dates.length > MAX_DAYS) {
    const toRemove = dates.slice(0, dates.length - MAX_DAYS);
    for (const date of toRemove) {
      delete stats.daily[date];
    }
  }
  return stats;
}

export async function recordBlockAttempt(domain: string): Promise<void> {
  try {
    const stats = await getUsageStats();
    const today = getTodayDate();
    const hour = new Date().getHours();
    const dailyStats = ensureDailyStats(stats, today);

    dailyStats.blocks++;
    dailyStats.hourlyBlocks[hour]++;

    // Increment lifetime counter
    stats.totalBlocks = (stats.totalBlocks || 0) + 1;

    if (!dailyStats.siteBreakdown[domain]) {
      dailyStats.siteBreakdown[domain] = { blocks: 0, bypasses: 0, autoRedirects: 0 };
    }
    dailyStats.siteBreakdown[domain].blocks++;

    await saveUsageStats(pruneOldStats(stats));
  } catch (error) {
    logError('recordBlockAttempt', error, { domain });
  }
}

export async function recordAutoRedirect(domain: string): Promise<void> {
  try {
    const stats = await getUsageStats();
    const today = getTodayDate();
    const hour = new Date().getHours();
    const dailyStats = ensureDailyStats(stats, today);

    dailyStats.autoRedirects = (dailyStats.autoRedirects || 0) + 1;
    dailyStats.hourlyAutoRedirects[hour]++;

    // Increment lifetime counter
    stats.totalAutoRedirects = (stats.totalAutoRedirects || 0) + 1;

    if (!dailyStats.siteBreakdown[domain]) {
      dailyStats.siteBreakdown[domain] = { blocks: 0, bypasses: 0, autoRedirects: 0 };
    }
    dailyStats.siteBreakdown[domain].autoRedirects =
      (dailyStats.siteBreakdown[domain].autoRedirects || 0) + 1;

    await saveUsageStats(pruneOldStats(stats));
  } catch (error) {
    logError('recordAutoRedirect', error, { domain });
  }
}

export async function recordBypassAttempt(
  domain: string,
  success: boolean,
  difficulty?: MathDifficulty
): Promise<void> {
  try {
    const stats = await getUsageStats();
    const today = getTodayDate();
    const dailyStats = ensureDailyStats(stats, today);

    dailyStats.bypassAttempts++;

    if (success) {
      dailyStats.bypassSuccesses++;

      if (!dailyStats.siteBreakdown[domain]) {
        dailyStats.siteBreakdown[domain] = { blocks: 0, bypasses: 0, autoRedirects: 0 };
      }
      dailyStats.siteBreakdown[domain].bypasses++;

      stats.lastBypassDate = today;
      stats.streak = 0;

      // Increment lifetime bypass counter
      stats.totalBypasses = (stats.totalBypasses || 0) + 1;

      // Track hard difficulty bypasses for achievement
      if (difficulty === 'hard') {
        stats.hardDifficultyBypasses = (stats.hardDifficultyBypasses || 0) + 1;
      }
    }

    await saveUsageStats(pruneOldStats(stats));
  } catch (error) {
    logError('recordBypassAttempt', error, { domain, success, difficulty });
  }
}

export function calculateStreak(stats: UsageStats): number {
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < MAX_DAYS; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const dayStats = stats.daily[dateStr];

    if (dayStats && dayStats.bypassSuccesses > 0) {
      break;
    }

    if (dayStats && dayStats.blocks > 0) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  return streak;
}

export async function updateStreak(): Promise<void> {
  try {
    const stats = await getUsageStats();
    stats.streak = calculateStreak(stats);

    // Track best streak
    if (stats.streak > (stats.bestStreak || 0)) {
      stats.bestStreak = stats.streak;
    }

    await saveUsageStats(stats);
  } catch (error) {
    logError('updateStreak', error);
  }
}

export async function resetStats(): Promise<void> {
  try {
    await saveUsageStats(getDefaultStats());
  } catch (error) {
    logError('resetStats', error);
    throw error;
  }
}

export function getTotalStats(stats: UsageStats): {
  totalBlocks: number;
  totalBypassAttempts: number;
  totalBypassSuccesses: number;
} {
  let totalBlocks = 0;
  let totalBypassAttempts = 0;
  let totalBypassSuccesses = 0;

  for (const dayStats of Object.values(stats.daily)) {
    totalBlocks += dayStats.blocks;
    totalBypassAttempts += dayStats.bypassAttempts;
    totalBypassSuccesses += dayStats.bypassSuccesses;
  }

  return { totalBlocks, totalBypassAttempts, totalBypassSuccesses };
}

export function getTopBlockedSites(stats: UsageStats, limit = 5): Array<{
  domain: string;
  blocks: number;
  bypasses: number;
  autoRedirects: number;
}> {
  const aggregated: Record<string, { blocks: number; bypasses: number; autoRedirects: number }> = {};

  for (const dayStats of Object.values(stats.daily)) {
    for (const [domain, siteStats] of Object.entries(dayStats.siteBreakdown)) {
      if (!aggregated[domain]) {
        aggregated[domain] = { blocks: 0, bypasses: 0, autoRedirects: 0 };
      }
      aggregated[domain].blocks += siteStats.blocks || 0;
      aggregated[domain].bypasses += siteStats.bypasses || 0;
      aggregated[domain].autoRedirects += siteStats.autoRedirects || 0;
    }
  }

  return Object.entries(aggregated)
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, limit);
}

export function getLast7DaysStats(stats: UsageStats): Array<{
  date: string;
  dayName: string;
  blocks: number;
}> {
  const result: Array<{ date: string; dayName: string; blocks: number }> = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = dayNames[date.getDay()];
    const blocks = stats.daily[dateStr]?.blocks ?? 0;

    result.push({ date: dateStr, dayName, blocks });
  }

  return result;
}

export async function recordNuclearCompletion(): Promise<void> {
  try {
    const stats = await getUsageStats();
    stats.nuclearCompletions = (stats.nuclearCompletions || 0) + 1;
    await saveUsageStats(stats);
  } catch (error) {
    logError('recordNuclearCompletion', error);
  }
}
