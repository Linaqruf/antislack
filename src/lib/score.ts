import { UsageStats, ProductivityScore } from './types';

// Scoring weights
const BLOCK_POINTS_MAX = 40;   // Up to 40 points (10 blocks = max)
const NO_BYPASS_POINTS = 30;   // 30 points if no bypasses today
const STREAK_POINTS_MAX = 30;  // Up to 30 points (7-day streak = max)

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export function calculateProductivityScore(stats: UsageStats): ProductivityScore {
  const today = getTodayDate();
  const todayStats = stats.daily[today];

  // Blocks today: up to 40 points (10 blocks = max)
  const blocksToday = Math.min((todayStats?.blocks || 0) / 10, 1) * BLOCK_POINTS_MAX;

  // No bypass bonus: 30 points if no bypasses today
  const noBypass = (todayStats?.bypassSuccesses || 0) === 0 ? NO_BYPASS_POINTS : 0;

  // Streak bonus: up to 30 points (7-day streak = max)
  const streakBonus = Math.min((stats.streak || 0) / 7, 1) * STREAK_POINTS_MAX;

  const score = Math.round(blocksToday + noBypass + streakBonus);

  return {
    score,
    breakdown: {
      blocksToday: Math.round(blocksToday),
      noBypass: Math.round(noBypass),
      streakBonus: Math.round(streakBonus),
    },
    trend: calculateTrend(stats),
  };
}

export function calculateTrend(stats: UsageStats): -1 | 0 | 1 {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  const todayStats = stats.daily[today];
  const yesterdayStats = stats.daily[yesterday];

  const todayBlocks = todayStats?.blocks || 0;
  const yesterdayBlocks = yesterdayStats?.blocks || 0;

  // Simple comparison: positive if more blocks today (more productive)
  // negative if fewer blocks today
  if (yesterdayBlocks === 0) {
    return todayBlocks > 0 ? 1 : 0;
  }

  const diff = todayBlocks - yesterdayBlocks;
  if (diff > 0) return 1;  // Improved
  if (diff < 0) return -1; // Declined
  return 0;                 // Same
}
