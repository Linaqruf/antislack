import { getSettings, getBlockedSites, addBlockedSite } from '../lib/storage';
import { getUsageStats, calculateStreak, getTotalStats, getLast7DaysStats } from '../lib/stats';
import { calculateProductivityScore } from '../lib/score';
import { updateBlockingRules } from '../lib/rules';
import { getBypassSessions } from '../lib/bypass';
import { isNuclearModeActive, getRemainingTime, formatRemainingTime } from '../lib/nuclear';

// DOM Elements
const statusTextEl = document.getElementById('status-text') as HTMLElement;
const statusDotEl = document.getElementById('status-dot') as HTMLElement;
const sitesBlockedEl = document.getElementById('sites-blocked') as HTMLElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const openSettingsBtn = document.getElementById('open-settings-btn') as HTMLButtonElement;

// Score elements
const popupScoreRingFill = document.getElementById('popup-score-ring-fill') as SVGCircleElement | null;
const popupScoreValue = document.getElementById('popup-score-value') as SVGTextElement | null;
const scoreTrend = document.getElementById('score-trend') as HTMLElement;

// Nuclear elements (may be null)
const nuclearBar = document.getElementById('nuclear-bar') as HTMLElement | null;
const nuclearCountdown = document.getElementById('nuclear-countdown') as HTMLElement | null;

// Bypass elements
const bypassesContainer = document.getElementById('bypasses-container') as HTMLElement;
const bypassesList = document.getElementById('bypasses-list') as HTMLElement;

// Quick add elements
const quickAddInput = document.getElementById('quick-add-input') as HTMLInputElement;
const quickAddBtn = document.getElementById('quick-add-btn') as HTMLButtonElement;
const quickAddError = document.getElementById('quick-add-error') as HTMLElement;

// Stats elements
const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-sm');
const statBlocks = document.getElementById('stat-blocks') as HTMLElement;
const statRedirects = document.getElementById('stat-redirects') as HTMLElement;
const statBypasses = document.getElementById('stat-bypasses') as HTMLElement;
const statStreak = document.getElementById('stat-streak') as HTMLElement;

// State
let currentPeriod: 'today' | 'week' | 'all' = 'today';
let nuclearInterval: ReturnType<typeof setInterval> | null = null;
let bypassIntervals: ReturnType<typeof setInterval>[] = [];

function updateStatusUI(enabled: boolean) {
  if (enabled) {
    document.body.classList.remove('disabled');
    statusTextEl.textContent = 'ACTIVE';
    statusTextEl.classList.remove('text-fg-muted');
    statusTextEl.classList.add('text-accent');
    statusDotEl.classList.remove('bg-fg-muted');
    statusDotEl.classList.add('bg-accent', 'animate-pulse');
  } else {
    document.body.classList.add('disabled');
    statusTextEl.textContent = 'STANDBY';
    statusTextEl.classList.remove('text-accent');
    statusTextEl.classList.add('text-fg-muted');
    statusDotEl.classList.remove('bg-accent', 'animate-pulse');
    statusDotEl.classList.add('bg-fg-muted');
  }
}

async function loadProductivityScore() {
  try {
    const stats = await getUsageStats();
    const score = calculateProductivityScore(stats);

    // Update ring - circumference = 2 * PI * 32 = ~201
    const circumference = 201;
    const offset = circumference - (score.score / 100) * circumference;

    if (popupScoreRingFill) {
      popupScoreRingFill.setAttribute('stroke-dashoffset', offset.toString());
    }
    if (popupScoreValue) {
      popupScoreValue.textContent = score.score.toString();
    }

    // Update trend
    if (scoreTrend) {
      if (score.trend > 0) {
        scoreTrend.textContent = '↑';
        scoreTrend.className = 'text-xs text-success';
      } else if (score.trend < 0) {
        scoreTrend.textContent = '↓';
        scoreTrend.className = 'text-xs text-danger';
      } else {
        scoreTrend.textContent = '→';
        scoreTrend.className = 'text-xs text-fg-muted';
      }
    }
  } catch (error) {
    console.error('AntiSlack: Failed to load productivity score:', error);
    // Show default state
    if (popupScoreValue) {
      popupScoreValue.textContent = '0';
    }
  }
}

async function loadNuclearStatus() {
  try {
    const { active, error } = await isNuclearModeActive();

    if (error) {
      console.warn('AntiSlack: Could not verify nuclear mode:', error);
    }

    if (!nuclearBar) return;

    if (active) {
      nuclearBar.classList.remove('hidden');
      startNuclearCountdown();
    } else {
      nuclearBar.classList.add('hidden');
      if (nuclearInterval) {
        clearInterval(nuclearInterval);
        nuclearInterval = null;
      }
    }
  } catch (error) {
    console.error('AntiSlack: Failed to load nuclear status:', error);
  }
}

function startNuclearCountdown() {
  if (nuclearInterval) clearInterval(nuclearInterval);

  updateNuclearDisplay();
  nuclearInterval = setInterval(updateNuclearDisplay, 1000);
}

async function updateNuclearDisplay() {
  const remaining = await getRemainingTime();

  if (remaining <= 0) {
    nuclearBar?.classList.add('hidden');
    if (nuclearInterval) {
      clearInterval(nuclearInterval);
      nuclearInterval = null;
    }
    return;
  }

  const { hours, minutes, seconds } = formatRemainingTime(remaining);
  if (nuclearCountdown) {
    nuclearCountdown.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

async function loadActiveBypasses() {
  // Clear existing intervals
  bypassIntervals.forEach((interval) => clearInterval(interval));
  bypassIntervals = [];

  try {
    const sessions = await getBypassSessions();
    const now = Date.now();
    const activeSessions = sessions.filter((s) => s.expiresAt > now);

    if (activeSessions.length === 0) {
      bypassesContainer.classList.add('hidden');
      return;
    }

    bypassesContainer.classList.remove('hidden');

    bypassesList.innerHTML = activeSessions
      .map(
        (session) => `
      <div class="bypass-item" data-domain="${escapeHtml(session.domain)}">
        <span class="text-xs text-fg-primary font-mono">${escapeHtml(session.domain)}</span>
        <span class="text-xs text-warning tabular-nums bypass-timer" data-expires="${session.expiresAt}">--:--</span>
      </div>
    `
      )
      .join('');

    // Update timers
    const updateTimers = () => {
      const now = Date.now();
      document.querySelectorAll<HTMLElement>('.bypass-timer').forEach((timer) => {
        const expires = parseInt(timer.dataset.expires || '0', 10);
        const remaining = expires - now;

        if (remaining <= 0) {
          timer.textContent = 'EXPIRED';
          return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      });
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    bypassIntervals.push(interval);
  } catch (error) {
    console.error('AntiSlack: Failed to load active bypasses:', error);
    bypassesContainer.classList.add('hidden');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleQuickAdd() {
  const pattern = quickAddInput.value.trim().toLowerCase();

  if (!pattern) {
    quickAddError.textContent = 'Enter a domain';
    quickAddError.classList.remove('hidden');
    return;
  }

  // Basic validation
  const domainRegex = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/;
  if (!domainRegex.test(pattern)) {
    quickAddError.textContent = 'Invalid domain';
    quickAddError.classList.remove('hidden');
    return;
  }

  // Check for duplicates
  const sites = await getBlockedSites();
  if (sites.some((s) => s.pattern === pattern)) {
    quickAddError.textContent = 'Already blocked';
    quickAddError.classList.remove('hidden');
    return;
  }

  try {
    quickAddError.classList.add('hidden');
    await addBlockedSite(pattern);
    await updateBlockingRules();
    quickAddInput.value = '';

    // Refresh site count
    const updatedSites = await getBlockedSites();
    sitesBlockedEl.textContent = updatedSites.length.toString();
  } catch (error) {
    console.error('AntiSlack: Failed to quick-add site:', error);
    quickAddError.textContent = 'Failed to add';
    quickAddError.classList.remove('hidden');
  }
}

async function loadStats(period: 'today' | 'week' | 'all') {
  try {
    const stats = await getUsageStats();
    const streak = calculateStreak(stats);

    let blocks = 0;
    let autoRedirects = 0;
    let bypasses = 0;

    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      const todayStats = stats.daily[today];
      blocks = todayStats?.blocks || 0;
      autoRedirects = todayStats?.autoRedirects || 0;
      bypasses = todayStats?.bypassSuccesses || 0;
    } else if (period === 'week') {
      const last7Days = getLast7DaysStats(stats);
      for (const day of last7Days) {
        const dateStr = day.date;
        const dayStats = stats.daily[dateStr];
        blocks += dayStats?.blocks || 0;
        autoRedirects += dayStats?.autoRedirects || 0;
        bypasses += dayStats?.bypassSuccesses || 0;
      }
    } else {
      // All time
      const totals = getTotalStats(stats);
      blocks = stats.totalBlocks || totals.totalBlocks;
      autoRedirects = stats.totalAutoRedirects || 0;
      bypasses = stats.totalBypasses || totals.totalBypassSuccesses;
    }

    statBlocks.textContent = blocks.toString();
    statRedirects.textContent = autoRedirects.toString();
    statBypasses.textContent = bypasses.toString();
    statStreak.textContent = streak.toString();
  } catch (error) {
    console.error('AntiSlack: Failed to load stats:', error);
    // Show zeros as fallback
    statBlocks.textContent = '0';
    statRedirects.textContent = '0';
    statBypasses.textContent = '0';
    statStreak.textContent = '0';
  }
}

async function init() {
  try {
    const settings = await getSettings();
    const blockedSites = await getBlockedSites();

    updateStatusUI(settings.enabled);
    sitesBlockedEl.textContent = blockedSites.length.toString();

    await loadProductivityScore();
    await loadNuclearStatus();
    await loadActiveBypasses();
    await loadStats(currentPeriod);
  } catch (error) {
    console.error('AntiSlack: Popup initialization error:', error);
    statusTextEl.textContent = 'ERROR';
    statusDotEl.classList.remove('bg-accent', 'animate-pulse');
    statusDotEl.classList.add('bg-danger');
  }
}

// Event listeners
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

openSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

quickAddBtn.addEventListener('click', handleQuickAdd);

quickAddInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleQuickAdd();
  quickAddError.classList.add('hidden');
});

quickAddInput.addEventListener('input', () => {
  quickAddError.classList.add('hidden');
});

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const period = btn.dataset.period as 'today' | 'week' | 'all';
    if (!period) return;

    currentPeriod = period;

    // Update active state
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    loadStats(period);
  });
});

// Clean up on unload
window.addEventListener('unload', () => {
  if (nuclearInterval) clearInterval(nuclearInterval);
  bypassIntervals.forEach((interval) => clearInterval(interval));
});

init();
