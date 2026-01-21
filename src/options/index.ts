import {
  getSettings,
  setSettings,
  getBlockedSites,
  addBlockedSite,
  removeBlockedSite,
  updateBlockedSite,
  exportBlocklist,
  importBlocklist,
  exportAllData,
  importAllData,
  getPassphraseHash,
  setPassphraseHash,
  clearPassphraseHash,
} from '../lib/storage';
import {
  getUsageStats,
  resetStats,
  getTotalStats,
  getTopBlockedSites,
  getLast7DaysStats,
  calculateStreak,
} from '../lib/stats';
import { calculateProductivityScore } from '../lib/score';
import { updateBlockingRules } from '../lib/rules';
import { Settings, MathDifficulty, AutoRedirectMode } from '../lib/types';
import { hashPassphrase, verifyPassphrase, validatePassphrase } from '../lib/crypto';
import {
  isNuclearModeActive,
  getRemainingTime,
  activateNuclearMode,
  deactivateNuclearMode,
  verifyEmergencyAbort,
  formatRemainingTime,
} from '../lib/nuclear';

// DOM Elements
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

// Blocklist elements
const addSiteInput = document.getElementById('add-site-input') as HTMLInputElement;
const addSiteBtn = document.getElementById('add-site-btn') as HTMLButtonElement;
const addSiteError = document.getElementById('add-site-error') as HTMLElement;
const blocklistContainer = document.getElementById('blocklist-container') as HTMLElement;
const blocklistEmpty = document.getElementById('blocklist-empty') as HTMLElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;

// Settings elements
const enabledToggle = document.getElementById('enabled-toggle') as HTMLButtonElement;
const statusLight = document.getElementById('status-light') as HTMLElement;
const redirectUrlInput = document.getElementById('redirect-url-input') as HTMLInputElement;
const bypassDurationSlider = document.getElementById('bypass-duration-slider') as HTMLInputElement;
const bypassDurationValue = document.getElementById('bypass-duration-value') as HTMLElement;
const showBypassToggle = document.getElementById('show-bypass-toggle') as HTMLButtonElement;
const exportAllBtn = document.getElementById('export-all-btn') as HTMLButtonElement;
const importAllBtn = document.getElementById('import-all-btn') as HTMLButtonElement;
const importAllFileInput = document.getElementById('import-all-file-input') as HTMLInputElement;

// New settings elements - Phase 6
const difficultyBtns = document.querySelectorAll<HTMLButtonElement>('.difficulty-btn');
const autoRedirectToggle = document.getElementById('auto-redirect-toggle') as HTMLButtonElement;
const autoRedirectBadge = document.getElementById('auto-redirect-badge') as HTMLElement;
const passphraseToggle = document.getElementById('passphrase-toggle') as HTMLButtonElement;
const lockStatus = document.getElementById('lock-status') as HTMLElement;
const changePassphraseBtn = document.getElementById('change-passphrase-btn') as HTMLButtonElement;

// Passphrase setup modal elements
const passphraseSetupModal = document.getElementById('passphrase-setup-modal') as HTMLElement;
const passphraseInput = document.getElementById('passphrase-input') as HTMLInputElement;
const passphraseConfirmInput = document.getElementById('passphrase-confirm-input') as HTMLInputElement;
const passphraseSetupError = document.getElementById('passphrase-setup-error') as HTMLElement;
const passphraseSetupCancelBtn = document.getElementById('passphrase-setup-cancel-btn') as HTMLButtonElement;
const passphraseSetupConfirmBtn = document.getElementById('passphrase-setup-confirm-btn') as HTMLButtonElement;

// Passphrase challenge modal elements
const passphraseChallengeModal = document.getElementById('passphrase-challenge-modal') as HTMLElement;
const passphraseChallengeTitle = document.getElementById('passphrase-challenge-title') as HTMLElement;
const passphraseChallengeMessage = document.getElementById('passphrase-challenge-message') as HTMLElement;
const passphraseChallengeInput = document.getElementById('passphrase-challenge-input') as HTMLInputElement;
const passphraseChallengeError = document.getElementById('passphrase-challenge-error') as HTMLElement;
const passphraseChallengeConfirmBtn = document.getElementById('passphrase-challenge-confirm-btn') as HTMLButtonElement;
const passphraseChallengeCancelBtn = document.getElementById('passphrase-challenge-cancel-btn') as HTMLButtonElement;

// Nuclear mode elements
const nuclearStatus = document.getElementById('nuclear-status') as HTMLElement;
const nuclearSetup = document.getElementById('nuclear-setup') as HTMLElement;
const nuclearActive = document.getElementById('nuclear-active') as HTMLElement;
const nuclearEngageBtn = document.getElementById('nuclear-engage-btn') as HTMLButtonElement;
const nuclearAbortBtn = document.getElementById('nuclear-abort-btn') as HTMLButtonElement;
const durationBtns = document.querySelectorAll<HTMLButtonElement>('.duration-btn');
const optionsNuclearHours = document.getElementById('options-nuclear-hours') as HTMLElement;
const optionsNuclearMinutes = document.getElementById('options-nuclear-minutes') as HTMLElement;
const optionsNuclearSeconds = document.getElementById('options-nuclear-seconds') as HTMLElement;

// Nuclear setup modal elements
const nuclearSetupModal = document.getElementById('nuclear-setup-modal') as HTMLElement;
const nuclearDurationDisplay = document.getElementById('nuclear-duration-display') as HTMLElement;
const nuclearPassphraseInput = document.getElementById('nuclear-passphrase-input') as HTMLInputElement;
const nuclearPassphraseConfirm = document.getElementById('nuclear-passphrase-confirm') as HTMLInputElement;
const nuclearSetupError = document.getElementById('nuclear-setup-error') as HTMLElement;
const nuclearSetupCancelBtn = document.getElementById('nuclear-setup-cancel-btn') as HTMLButtonElement;
const nuclearSetupConfirmBtn = document.getElementById('nuclear-setup-confirm-btn') as HTMLButtonElement;

// Nuclear abort modal elements
const nuclearAbortModal = document.getElementById('nuclear-abort-modal') as HTMLElement;
const nuclearAbortPassphrase = document.getElementById('nuclear-abort-passphrase') as HTMLInputElement;
const nuclearAbortError = document.getElementById('nuclear-abort-error') as HTMLElement;
const nuclearAbortCancelBtn = document.getElementById('nuclear-abort-cancel-btn') as HTMLButtonElement;
const nuclearAbortConfirmBtn = document.getElementById('nuclear-abort-confirm-btn') as HTMLButtonElement;

// Site edit modal elements
const siteEditModal = document.getElementById('site-edit-modal') as HTMLElement;
const editSiteDomain = document.getElementById('edit-site-domain') as HTMLElement;
const editRedirectUrl = document.getElementById('edit-redirect-url') as HTMLInputElement;
const editModeBtns = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
const effectiveModeText = document.getElementById('effective-mode-text') as HTMLElement;
const editCancelBtn = document.getElementById('edit-cancel-btn') as HTMLButtonElement;
const editSaveBtn = document.getElementById('edit-save-btn') as HTMLButtonElement;

// Stats elements
const totalBlocksEl = document.getElementById('total-blocks') as HTMLElement;
const totalBypassesEl = document.getElementById('total-bypasses') as HTMLElement;
const currentStreakEl = document.getElementById('current-streak') as HTMLElement;
const bestStreakEl = document.getElementById('best-streak') as HTMLElement;
const trendChartEl = document.getElementById('trend-chart') as HTMLElement;
const topSitesListEl = document.getElementById('top-sites-list') as HTMLElement;
const topSitesEmptyEl = document.getElementById('top-sites-empty') as HTMLElement;
const exportStatsBtn = document.getElementById('export-stats-btn') as HTMLButtonElement;
const resetStatsBtn = document.getElementById('reset-stats-btn') as HTMLButtonElement;

// Gamification elements
const scoreRingFill = document.getElementById('score-ring-fill') as SVGCircleElement | null;
const scoreValue = document.getElementById('score-value') as SVGTextElement | null;
const scoreTrend = document.getElementById('score-trend') as HTMLElement;
const scoreBlocksEl = document.getElementById('score-blocks') as HTMLElement;
const scoreNobypassEl = document.getElementById('score-nobypass') as HTMLElement;
const scoreStreakEl = document.getElementById('score-streak') as HTMLElement;
const heatMapEl = document.getElementById('heat-map') as HTMLElement;

// Modal elements
const confirmModal = document.getElementById('confirm-modal') as HTMLElement;
const confirmTitle = document.getElementById('confirm-title') as HTMLElement;
const confirmMessage = document.getElementById('confirm-message') as HTMLElement;
const confirmCancelBtn = document.getElementById('confirm-cancel-btn') as HTMLButtonElement;
const confirmActionBtn = document.getElementById('confirm-action-btn') as HTMLButtonElement;

// Toast element
const toast = document.getElementById('toast') as HTMLElement;
const toastMessage = document.getElementById('toast-message') as HTMLElement;

let confirmCallback: (() => void) | null = null;
let passphraseChallengeCallback: (() => void) | null = null;
let selectedNuclearDuration = 1; // Default 1 hour
let nuclearCountdownInterval: ReturnType<typeof setInterval> | null = null;
let currentEditSiteId: string | null = null;
let selectedAutoRedirectMode: AutoRedirectMode = 'global';

// ============== Tab Navigation ==============

function switchTab(tabId: string) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabContents.forEach((content) => {
    const contentId = content.id.replace('tab-', '');
    content.classList.toggle('hidden', contentId !== tabId);
  });

  if (tabId === 'stats') {
    renderStats();
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab) switchTab(tab);
  });
});

// ============== Toast Notifications ==============

function showToast(message: string, duration = 3000) {
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// ============== Confirmation Modal ==============

function showConfirmModal(title: string, message: string, callback: () => void) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = callback;
  confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
  confirmModal.classList.add('hidden');
  confirmCallback = null;
}

confirmCancelBtn.addEventListener('click', hideConfirmModal);

confirmActionBtn.addEventListener('click', () => {
  if (confirmCallback) {
    confirmCallback();
  }
  hideConfirmModal();
});

confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) {
    hideConfirmModal();
  }
});

// ============== Blocklist Management ==============

async function renderBlocklist() {
  const sites = await getBlockedSites();

  if (sites.length === 0) {
    blocklistContainer.classList.add('hidden');
    blocklistEmpty.classList.remove('hidden');
    return;
  }

  blocklistContainer.classList.remove('hidden');
  blocklistEmpty.classList.add('hidden');

  blocklistContainer.innerHTML = sites
    .map(
      (site) => {
        const hasCustomConfig = site.redirectUrl || (site.autoRedirectMode && site.autoRedirectMode !== 'global');
        const modeIndicator = site.autoRedirectMode === 'always' ? '⚡' : site.autoRedirectMode === 'never' ? '🛡️' : '';

        return `
      <div class="target-card" data-id="${site.id}">
        <div class="target-card-actions">
          <button class="edit-btn" aria-label="Edit ${escapeHtml(site.pattern)}" title="Edit site settings">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button class="delete-btn" aria-label="Delete ${escapeHtml(site.pattern)}">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded bg-status-danger/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <span class="target-domain">${escapeHtml(site.pattern)}</span>
            ${hasCustomConfig ? `<span class="text-xs text-accent ml-2">${modeIndicator} custom</span>` : ''}
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="target-badge">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            ${site.blockCount} intercepts
          </span>
          ${site.autoRedirectCount ? `<span class="target-badge text-accent">${site.autoRedirectCount} redirects</span>` : ''}
        </div>
      </div>
    `;
      }
    )
    .join('');

  // Attach delete handlers
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const item = (e.currentTarget as HTMLElement).closest('.target-card');
      const id = item?.getAttribute('data-id');
      if (id) {
        try {
          await removeBlockedSite(id);
          await updateBlockingRules();
          await renderBlocklist();
          showToast('Target removed from blocklist');
        } catch (error) {
          console.error('AntiSlack: Failed to delete site:', error);
          showToast('Failed to remove target. Please try again.');
        }
      }
    });
  });

  // Attach edit handlers
  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const item = (e.currentTarget as HTMLElement).closest('.target-card');
      const id = item?.getAttribute('data-id');
      if (id) {
        await showEditModal(id);
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleAddSite() {
  const pattern = addSiteInput.value.trim().toLowerCase();

  if (!pattern) {
    addSiteError.textContent = 'Please enter a domain';
    addSiteError.classList.remove('hidden');
    return;
  }

  // Basic validation
  const domainRegex = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/;
  if (!domainRegex.test(pattern)) {
    addSiteError.textContent = 'Invalid domain format. Examples: twitter.com, *.reddit.com';
    addSiteError.classList.remove('hidden');
    return;
  }

  // Check for duplicates
  const sites = await getBlockedSites();
  if (sites.some((s) => s.pattern === pattern)) {
    addSiteError.textContent = 'This target is already acquired';
    addSiteError.classList.remove('hidden');
    return;
  }

  try {
    addSiteError.classList.add('hidden');
    await addBlockedSite(pattern);
    await updateBlockingRules();
    addSiteInput.value = '';
    await renderBlocklist();
    showToast('Target acquired');
  } catch (error) {
    console.error('AntiSlack: Failed to add site:', error);
    addSiteError.textContent = 'Failed to add site. Please try again.';
    addSiteError.classList.remove('hidden');
  }
}

addSiteBtn.addEventListener('click', handleAddSite);
addSiteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAddSite();
});

// ============== Import/Export Blocklist ==============

exportBtn.addEventListener('click', async () => {
  const json = await exportBlocklist();
  downloadJson(json, 'antislack-targets.json');
  showToast('Targets exported');
});

importBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (!file) return;

  const text = await file.text();
  const result = await importBlocklist(text);

  if (result.success) {
    await updateBlockingRules();
    await renderBlocklist();
    showToast(`Imported ${result.count} targets`);
  } else {
    showToast(`Import failed: ${result.error}`);
  }

  importFileInput.value = '';
});

// ============== Settings Management ==============

async function loadSettings() {
  const settings = await getSettings();

  // Enabled toggle and status light
  updateToggleState(enabledToggle, settings.enabled);
  updateStatusLight(settings.enabled);

  // Redirect URL
  redirectUrlInput.value = settings.defaultRedirectUrl;

  // Bypass duration
  bypassDurationSlider.value = settings.bypassDurationMinutes.toString();
  bypassDurationValue.textContent = settings.bypassDurationMinutes.toString();

  // Show bypass toggle
  updateToggleState(showBypassToggle, settings.showBypassOption);

  // Math difficulty
  difficultyBtns.forEach((btn) => {
    const difficulty = btn.dataset.difficulty as MathDifficulty;
    btn.classList.toggle('active', difficulty === settings.mathDifficulty);
  });

  // Auto-redirect
  updateToggleState(autoRedirectToggle, settings.autoRedirect);
  if (autoRedirectBadge) {
    autoRedirectBadge.classList.toggle('hidden', !settings.autoRedirect);
  }

  // Passphrase protection
  updateToggleState(passphraseToggle, settings.requirePassphraseToDisable);
  await updateLockStatusUI(settings.requirePassphraseToDisable);
}

function updateToggleState(toggle: HTMLButtonElement, enabled: boolean) {
  toggle.classList.toggle('enabled', enabled);
  toggle.classList.toggle('disabled', !enabled);
}

function updateStatusLight(enabled: boolean) {
  if (statusLight) {
    statusLight.classList.toggle('online', enabled);
    statusLight.classList.toggle('offline', !enabled);
  }
}

async function saveSettings(partial: Partial<Settings>) {
  const settings = await getSettings();
  const updated = { ...settings, ...partial };
  await setSettings(updated);

  if ('enabled' in partial) {
    await updateBlockingRules();
  }
}

enabledToggle.addEventListener('click', async () => {
  const isEnabled = enabledToggle.classList.contains('enabled');

  // If trying to disable and passphrase protection is enabled
  if (isEnabled) {
    const settings = await getSettings();
    if (settings.requirePassphraseToDisable) {
      showPassphraseChallengeModal(
        'Disable Blocking',
        'Enter your passphrase to disable blocking.',
        async () => {
          updateToggleState(enabledToggle, false);
          updateStatusLight(false);
          await saveSettings({ enabled: false });
          showToast('Mission deactivated');
        }
      );
      return;
    }
  }

  updateToggleState(enabledToggle, !isEnabled);
  updateStatusLight(!isEnabled);
  await saveSettings({ enabled: !isEnabled });
  showToast(`Mission ${!isEnabled ? 'activated' : 'deactivated'}`);
});

showBypassToggle.addEventListener('click', async () => {
  const isEnabled = showBypassToggle.classList.contains('enabled');
  updateToggleState(showBypassToggle, !isEnabled);
  await saveSettings({ showBypassOption: !isEnabled });
  showToast(`Clearance protocol ${!isEnabled ? 'enabled' : 'disabled'}`);
});

let redirectUrlTimeout: ReturnType<typeof setTimeout>;
redirectUrlInput.addEventListener('input', () => {
  clearTimeout(redirectUrlTimeout);
  redirectUrlTimeout = setTimeout(async () => {
    const url = redirectUrlInput.value.trim();
    try {
      new URL(url);
      await saveSettings({ defaultRedirectUrl: url });
      showToast('Redirect coordinates saved');
    } catch {
      showToast('Invalid URL format');
    }
  }, 500);
});

bypassDurationSlider.addEventListener('input', () => {
  const value = parseInt(bypassDurationSlider.value, 10);
  bypassDurationValue.textContent = value.toString();
});

bypassDurationSlider.addEventListener('change', async () => {
  const value = parseInt(bypassDurationSlider.value, 10);
  await saveSettings({ bypassDurationMinutes: value });
  showToast('Clearance duration updated');
});

// ============== Math Difficulty ==============

difficultyBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const difficulty = btn.dataset.difficulty as MathDifficulty;
    if (!difficulty) return;

    // Update UI
    difficultyBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Save setting
    await saveSettings({ mathDifficulty: difficulty });
    showToast(`Difficulty set to ${difficulty.toUpperCase()}`);
  });
});

// ============== Auto-Redirect ==============

autoRedirectToggle.addEventListener('click', async () => {
  const isEnabled = autoRedirectToggle.classList.contains('enabled');

  if (!isEnabled) {
    // Enabling auto-redirect - show confirmation
    showConfirmModal(
      'Enable Auto-Redirect',
      'When enabled, blocked sites will redirect directly to your productive URL. You will NOT be able to bypass blocks.',
      async () => {
        updateToggleState(autoRedirectToggle, true);
        autoRedirectBadge.classList.remove('hidden');
        await saveSettings({ autoRedirect: true });
        await updateBlockingRules();
        showToast('Auto-redirect enabled');
      }
    );
  } else {
    // Disabling
    updateToggleState(autoRedirectToggle, false);
    autoRedirectBadge.classList.add('hidden');
    await saveSettings({ autoRedirect: false });
    await updateBlockingRules();
    showToast('Auto-redirect disabled');
  }
});

// ============== Passphrase Protection ==============

async function updateLockStatusUI(isLocked: boolean) {
  if (lockStatus) {
    lockStatus.textContent = isLocked ? 'LOCKED' : 'UNLOCKED';
    lockStatus.classList.toggle('locked', isLocked);
    lockStatus.classList.toggle('unlocked', !isLocked);
  }
  if (changePassphraseBtn) {
    changePassphraseBtn.classList.toggle('hidden', !isLocked);
  }
}

function showPassphraseSetupModal() {
  passphraseInput.value = '';
  passphraseConfirmInput.value = '';
  passphraseSetupError.classList.add('hidden');
  passphraseSetupModal.classList.remove('hidden');
  passphraseInput.focus();
}

function hidePassphraseSetupModal() {
  passphraseSetupModal.classList.add('hidden');
  passphraseInput.value = '';
  passphraseConfirmInput.value = '';
}

function showPassphraseChallengeModal(
  title: string,
  message: string,
  callback: () => void
) {
  passphraseChallengeTitle.textContent = title;
  passphraseChallengeMessage.textContent = message;
  passphraseChallengeInput.value = '';
  passphraseChallengeError.classList.add('hidden');
  passphraseChallengeCallback = callback;
  passphraseChallengeModal.classList.remove('hidden');
  passphraseChallengeInput.focus();
}

function hidePassphraseChallengeModal() {
  passphraseChallengeModal.classList.add('hidden');
  passphraseChallengeInput.value = '';
  passphraseChallengeCallback = null;
}

passphraseToggle.addEventListener('click', async () => {
  const isEnabled = passphraseToggle.classList.contains('enabled');

  if (!isEnabled) {
    // Enabling - show setup modal
    showPassphraseSetupModal();
  } else {
    // Disabling - require passphrase challenge
    showPassphraseChallengeModal(
      'Disable Lock',
      'Enter your passphrase to disable the lock.',
      async () => {
        await clearPassphraseHash();
        await saveSettings({ requirePassphraseToDisable: false });
        updateToggleState(passphraseToggle, false);
        await updateLockStatusUI(false);
        showToast('Disable lock removed');
      }
    );
  }
});

changePassphraseBtn.addEventListener('click', () => {
  showPassphraseChallengeModal(
    'Change Passphrase',
    'Enter your current passphrase to change it.',
    () => {
      hidePassphraseChallengeModal();
      showPassphraseSetupModal();
    }
  );
});

passphraseSetupCancelBtn.addEventListener('click', hidePassphraseSetupModal);

passphraseSetupModal.addEventListener('click', (e) => {
  if (e.target === passphraseSetupModal) {
    hidePassphraseSetupModal();
  }
});

passphraseSetupConfirmBtn.addEventListener('click', async () => {
  const passphrase = passphraseInput.value;
  const confirm = passphraseConfirmInput.value;

  // Validate passphrase
  const validation = validatePassphrase(passphrase);
  if (!validation.valid) {
    passphraseSetupError.textContent = validation.error || 'Invalid passphrase';
    passphraseSetupError.classList.remove('hidden');
    return;
  }

  // Check confirmation matches
  if (passphrase !== confirm) {
    passphraseSetupError.textContent = 'Passphrases do not match';
    passphraseSetupError.classList.remove('hidden');
    return;
  }

  // Hash and store
  const hash = await hashPassphrase(passphrase);
  await setPassphraseHash(hash);
  await saveSettings({ requirePassphraseToDisable: true });

  hidePassphraseSetupModal();
  updateToggleState(passphraseToggle, true);
  await updateLockStatusUI(true);
  showToast('Disable lock enabled');
});

passphraseChallengeCancelBtn.addEventListener('click', hidePassphraseChallengeModal);

passphraseChallengeModal.addEventListener('click', (e) => {
  if (e.target === passphraseChallengeModal) {
    hidePassphraseChallengeModal();
  }
});

passphraseChallengeConfirmBtn.addEventListener('click', async () => {
  const enteredPassphrase = passphraseChallengeInput.value;
  const { hash: storedHash, error: hashError } = await getPassphraseHash();

  if (hashError) {
    passphraseChallengeError.textContent = 'Error reading passphrase. Please try again.';
    passphraseChallengeError.classList.remove('hidden');
    return;
  }

  if (!storedHash) {
    passphraseChallengeError.textContent = 'No passphrase set';
    passphraseChallengeError.classList.remove('hidden');
    return;
  }

  const result = await verifyPassphrase(enteredPassphrase, storedHash);

  if (result.success) {
    passphraseChallengeError.classList.add('hidden');
    if (passphraseChallengeCallback) {
      passphraseChallengeCallback();
    }
    hidePassphraseChallengeModal();
  } else {
    // Show system error differently from wrong password
    passphraseChallengeError.textContent = result.error || 'Incorrect passphrase';
    passphraseChallengeError.classList.remove('hidden');
    // Shake animation
    passphraseChallengeInput.classList.add('animate-shake');
    setTimeout(() => passphraseChallengeInput.classList.remove('animate-shake'), 500);
  }
});

passphraseChallengeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    passphraseChallengeConfirmBtn.click();
  }
});

passphraseInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    passphraseConfirmInput.focus();
  }
});

passphraseConfirmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    passphraseSetupConfirmBtn.click();
  }
});

// ============== Nuclear Mode ==============

let nuclearStateInitialized = false;

async function loadNuclearState() {
  const { active, error } = await isNuclearModeActive();

  if (error) {
    console.warn('AntiSlack: Could not verify nuclear mode:', error);
    showToast('Warning: Could not verify nuclear mode status');
  }

  if (active) {
    nuclearSetup.classList.add('hidden');
    nuclearActive.classList.remove('hidden');
    nuclearStatus.textContent = 'ACTIVE';
    nuclearStatus.classList.remove('inactive');
    nuclearStatus.classList.add('active');
    startOptionsNuclearCountdown();
  } else {
    nuclearSetup.classList.remove('hidden');
    nuclearActive.classList.add('hidden');
    nuclearStatus.textContent = 'INACTIVE';
    nuclearStatus.classList.remove('active');
    nuclearStatus.classList.add('inactive');
    if (nuclearCountdownInterval) {
      clearInterval(nuclearCountdownInterval);
      nuclearCountdownInterval = null;
    }
  }

  nuclearStateInitialized = true;
}

function startOptionsNuclearCountdown() {
  // Clear existing interval first to prevent memory leak
  if (nuclearCountdownInterval) {
    clearInterval(nuclearCountdownInterval);
  }
  updateOptionsNuclearDisplay();
  nuclearCountdownInterval = setInterval(updateOptionsNuclearDisplay, 1000);
}

async function updateOptionsNuclearDisplay() {
  const remaining = await getRemainingTime();

  if (remaining <= 0) {
    // Nuclear mode expired, refresh state
    if (nuclearCountdownInterval) {
      clearInterval(nuclearCountdownInterval);
      nuclearCountdownInterval = null;
    }
    await loadNuclearState();
    showToast('Nuclear mode expired');
    return;
  }

  const { hours, minutes, seconds } = formatRemainingTime(remaining);

  if (optionsNuclearHours) optionsNuclearHours.textContent = hours;
  if (optionsNuclearMinutes) optionsNuclearMinutes.textContent = minutes;
  if (optionsNuclearSeconds) optionsNuclearSeconds.textContent = seconds;
}

function getDurationText(hours: number): string {
  if (hours === 1) return '1 HOUR';
  return `${hours} HOURS`;
}

function showNuclearSetupModal() {
  nuclearDurationDisplay.textContent = getDurationText(selectedNuclearDuration);
  nuclearPassphraseInput.value = '';
  nuclearPassphraseConfirm.value = '';
  nuclearSetupError.classList.add('hidden');
  nuclearSetupModal.classList.remove('hidden');
  nuclearPassphraseInput.focus();
}

function hideNuclearSetupModal() {
  nuclearSetupModal.classList.add('hidden');
  nuclearPassphraseInput.value = '';
  nuclearPassphraseConfirm.value = '';
}

function showNuclearAbortModal() {
  nuclearAbortPassphrase.value = '';
  nuclearAbortError.classList.add('hidden');
  nuclearAbortModal.classList.remove('hidden');
  nuclearAbortPassphrase.focus();
}

function hideNuclearAbortModal() {
  nuclearAbortModal.classList.add('hidden');
  nuclearAbortPassphrase.value = '';
}

// Duration selector buttons
durationBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const hours = parseInt(btn.dataset.hours || '1', 10);
    selectedNuclearDuration = hours;

    // Update UI
    durationBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Engage button - show setup modal
nuclearEngageBtn.addEventListener('click', () => {
  showNuclearSetupModal();
});

// Abort button - show abort modal
nuclearAbortBtn.addEventListener('click', () => {
  showNuclearAbortModal();
});

// Setup modal - cancel
nuclearSetupCancelBtn.addEventListener('click', hideNuclearSetupModal);

nuclearSetupModal.addEventListener('click', (e) => {
  if (e.target === nuclearSetupModal) {
    hideNuclearSetupModal();
  }
});

// Setup modal - confirm
nuclearSetupConfirmBtn.addEventListener('click', async () => {
  const passphrase = nuclearPassphraseInput.value;
  const confirm = nuclearPassphraseConfirm.value;

  // Validate passphrase using shared validator
  const validation = validatePassphrase(passphrase);
  if (!validation.valid) {
    nuclearSetupError.textContent = validation.error || 'Invalid passphrase';
    nuclearSetupError.classList.remove('hidden');
    return;
  }

  // Check confirmation matches
  if (passphrase !== confirm) {
    nuclearSetupError.textContent = 'Passphrases do not match';
    nuclearSetupError.classList.remove('hidden');
    return;
  }

  try {
    // Activate nuclear mode
    await activateNuclearMode(selectedNuclearDuration, passphrase);

    hideNuclearSetupModal();
    await loadNuclearState();
    showToast(`Nuclear mode engaged for ${getDurationText(selectedNuclearDuration)}`);
  } catch (error) {
    nuclearSetupError.textContent = 'Failed to activate nuclear mode';
    nuclearSetupError.classList.remove('hidden');
  }
});

// Abort modal - cancel
nuclearAbortCancelBtn.addEventListener('click', hideNuclearAbortModal);

nuclearAbortModal.addEventListener('click', (e) => {
  if (e.target === nuclearAbortModal) {
    hideNuclearAbortModal();
  }
});

// Abort modal - confirm
nuclearAbortConfirmBtn.addEventListener('click', async () => {
  const passphrase = nuclearAbortPassphrase.value;

  if (!passphrase) {
    nuclearAbortError.textContent = 'Please enter your passphrase';
    nuclearAbortError.classList.remove('hidden');
    return;
  }

  const result = await verifyEmergencyAbort(passphrase);

  if (result.success) {
    await deactivateNuclearMode();
    hideNuclearAbortModal();
    await loadNuclearState();
    showToast('Nuclear mode aborted');
  } else {
    // Show system error differently from wrong password
    nuclearAbortError.textContent = result.error || 'Incorrect passphrase';
    nuclearAbortError.classList.remove('hidden');
    // Shake animation
    nuclearAbortPassphrase.classList.add('animate-shake');
    setTimeout(() => nuclearAbortPassphrase.classList.remove('animate-shake'), 500);
  }
});

// Enter key handlers for nuclear modals
nuclearPassphraseInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    nuclearPassphraseConfirm.focus();
  }
});

nuclearPassphraseConfirm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    nuclearSetupConfirmBtn.click();
  }
});

nuclearAbortPassphrase.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    nuclearAbortConfirmBtn.click();
  }
});

// ============== Site Edit Modal ==============

async function showEditModal(siteId: string) {
  const sites = await getBlockedSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) {
    showToast('Site not found. List may have changed.');
    await renderBlocklist();
    return;
  }

  currentEditSiteId = siteId;

  // Populate modal fields
  editSiteDomain.textContent = site.pattern;
  editRedirectUrl.value = site.redirectUrl || '';
  selectedAutoRedirectMode = site.autoRedirectMode || 'global';

  // Update mode button states
  updateModeBtnStates();
  await updateEffectiveModeText();

  siteEditModal.classList.remove('hidden');
  editRedirectUrl.focus();
}

function hideEditModal() {
  siteEditModal.classList.add('hidden');
  currentEditSiteId = null;
  editRedirectUrl.value = '';
  selectedAutoRedirectMode = 'global';
}

function updateModeBtnStates() {
  editModeBtns.forEach((btn) => {
    const mode = btn.dataset.mode as AutoRedirectMode;
    btn.classList.toggle('active', mode === selectedAutoRedirectMode);
  });
}

async function updateEffectiveModeText() {
  const settings = await getSettings();
  let text = '';

  switch (selectedAutoRedirectMode) {
    case 'global':
      text = settings.autoRedirect
        ? 'Using global setting: Auto-redirect ON'
        : 'Using global setting: Auto-redirect OFF';
      break;
    case 'always':
      text = 'Always redirect directly (no block page)';
      break;
    case 'never':
      text = 'Always show block page (allows bypass)';
      break;
  }

  effectiveModeText.textContent = text;
}

// Mode button click handlers
editModeBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    selectedAutoRedirectMode = btn.dataset.mode as AutoRedirectMode;
    updateModeBtnStates();
    await updateEffectiveModeText();
  });
});

editCancelBtn.addEventListener('click', hideEditModal);

siteEditModal.addEventListener('click', (e) => {
  if (e.target === siteEditModal) {
    hideEditModal();
  }
});

editSaveBtn.addEventListener('click', async () => {
  if (!currentEditSiteId) return;

  const redirectUrl = editRedirectUrl.value.trim();

  // Validate URL if provided
  if (redirectUrl) {
    try {
      new URL(redirectUrl);
    } catch {
      showToast('Invalid redirect URL');
      return;
    }
  }

  try {
    await updateBlockedSite(currentEditSiteId, {
      redirectUrl: redirectUrl || undefined,
      autoRedirectMode: selectedAutoRedirectMode === 'global' ? undefined : selectedAutoRedirectMode,
    });
    await updateBlockingRules();
    await renderBlocklist();
    hideEditModal();
    showToast('Target configuration saved');
  } catch (error) {
    console.error('AntiSlack: Failed to save site changes:', error);
    showToast('Failed to save changes');
  }
});

// ============== Export/Import All Data ==============

exportAllBtn.addEventListener('click', async () => {
  const json = await exportAllData();
  downloadJson(json, 'antislack-backup.json');
  showToast('Full backup exported');
});

importAllBtn.addEventListener('click', () => {
  importAllFileInput.click();
});

importAllFileInput.addEventListener('change', async () => {
  const file = importAllFileInput.files?.[0];
  if (!file) return;

  showConfirmModal(
    'Import All Data',
    'This will replace your current targets, config, and intel. Continue?',
    async () => {
      const text = await file.text();
      const result = await importAllData(text);

      if (result.success) {
        await updateBlockingRules();
        await loadSettings();
        await renderBlocklist();
        await renderStats();
        showToast('All data restored successfully');
      } else {
        showToast(`Import failed: ${result.error}`);
      }
    }
  );

  importAllFileInput.value = '';
});

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============== Stats Display ==============

async function renderStats() {
  const stats = await getUsageStats();
  const totals = getTotalStats(stats);
  const streak = calculateStreak(stats);
  const topSites = getTopBlockedSites(stats, 5);
  const last7Days = getLast7DaysStats(stats);

  // Summary cards
  totalBlocksEl.textContent = (stats.totalBlocks || totals.totalBlocks).toString();
  totalBypassesEl.textContent = (stats.totalBypasses || totals.totalBypassSuccesses).toString();
  currentStreakEl.textContent = streak.toString();
  if (bestStreakEl) {
    bestStreakEl.textContent = (stats.bestStreak || streak).toString();
  }

  // Render gamification components
  await renderProductivityScore(stats);
  await renderHeatMap(stats);

  // 7-day trend bar chart
  const maxBlocks = Math.max(...last7Days.map((d) => d.blocks), 1);
  trendChartEl.innerHTML = last7Days
    .map(
      (day) => `
      <div class="bar-row">
        <span class="bar-label">${day.dayName}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${(day.blocks / maxBlocks) * 100}%"></div>
        </div>
        <span class="bar-value">${day.blocks}</span>
      </div>
    `
    )
    .join('');

  // Top blocked sites
  if (topSites.length === 0) {
    topSitesListEl.classList.add('hidden');
    topSitesEmptyEl.classList.remove('hidden');
  } else {
    topSitesListEl.classList.remove('hidden');
    topSitesEmptyEl.classList.add('hidden');

    topSitesListEl.innerHTML = topSites
      .map(
        (site, index) => `
        <div class="top-site-item">
          <div class="flex items-center gap-4">
            <span class="top-site-rank">${index + 1}</span>
            <span class="font-mono text-sm text-white">${escapeHtml(site.domain)}</span>
          </div>
          <div class="flex items-center gap-6 text-sm font-mono">
            <span class="text-white/50">${site.blocks} <span class="text-white/30">intercepts</span></span>
            <span class="text-status-warning">${site.bypasses} <span class="text-white/30">clearances</span></span>
          </div>
        </div>
      `
      )
      .join('');
  }
}

// ============== Productivity Score ==============

async function renderProductivityScore(stats: Awaited<ReturnType<typeof getUsageStats>>) {
  const score = calculateProductivityScore(stats);
  const circumference = 314; // 2 * PI * 50
  const offset = circumference - (score.score / 100) * circumference;

  if (scoreRingFill) {
    scoreRingFill.setAttribute('stroke-dashoffset', offset.toString());
  }
  if (scoreValue) {
    scoreValue.textContent = score.score.toString();
  }

  // Update breakdown
  if (scoreBlocksEl) scoreBlocksEl.textContent = `+${score.breakdown.blocksToday}`;
  if (scoreNobypassEl) scoreNobypassEl.textContent = `+${score.breakdown.noBypass}`;
  if (scoreStreakEl) scoreStreakEl.textContent = `+${score.breakdown.streakBonus}`;

  // Update trend indicator
  if (scoreTrend) {
    if (score.trend > 0) {
      scoreTrend.textContent = '↑ UP';
      scoreTrend.className = 'text-xs trend-up';
    } else if (score.trend < 0) {
      scoreTrend.textContent = '↓ DOWN';
      scoreTrend.className = 'text-xs trend-down';
    } else {
      scoreTrend.textContent = '→ STABLE';
      scoreTrend.className = 'text-xs trend-neutral';
    }
  }
}

// ============== Heat Map ==============

async function renderHeatMap(stats: Awaited<ReturnType<typeof getUsageStats>>) {
  if (!heatMapEl) return;

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let html = '<div class="heat-map-label"></div>'; // Empty corner

  // Hour labels (every 4 hours)
  for (let h = 0; h < 24; h++) {
    if (h % 4 === 0) {
      html += `<div class="heat-map-hour-label">${h}</div>`;
    } else {
      html += '<div></div>';
    }
  }

  // 7 days of data
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const dayStats = stats.daily[dateStr];
    const hourly = dayStats?.hourlyBlocks || new Array(24).fill(0);

    html += `<div class="heat-map-label">${days[date.getDay()]}</div>`;
    for (let h = 0; h < 24; h++) {
      const count = hourly[h] || 0;
      const intensity = count === 0 ? 0 : Math.min(Math.ceil(count / 2), 5);
      html += `<div class="heat-map-cell" data-intensity="${intensity}" title="${count} blocks at ${h}:00"></div>`;
    }
  }

  heatMapEl.innerHTML = html;
}

exportStatsBtn.addEventListener('click', async () => {
  const stats = await getUsageStats();
  const json = JSON.stringify(stats, null, 2);
  downloadJson(json, 'antislack-intel.json');
  showToast('Intel exported');
});

resetStatsBtn.addEventListener('click', () => {
  showConfirmModal(
    'Purge Intel Data',
    'This will permanently delete all usage statistics. This action cannot be undone.',
    async () => {
      await resetStats();
      await renderStats();
      showToast('Intel data purged');
    }
  );
});

// ============== Initialize ==============

async function init() {
  try {
    await loadSettings();
    await renderBlocklist();
    await loadNuclearState();
  } catch (error) {
    console.error('AntiSlack: Options page initialization error:', error);
    showToast('Error loading settings. Please try reloading.');
  }
}

init();
