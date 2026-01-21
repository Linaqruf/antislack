import { initializeStorage, getSettings, getBlockedSites, addBlockedSite, removeBlockedSite, incrementSiteAutoRedirectCount } from '../lib/storage';
import { updateBlockingRules, disableBlocking, resolveAutoRedirect } from '../lib/rules';
import { removeBypassSession, cleanExpiredSessions } from '../lib/bypass';
import { getNuclearMode, deactivateNuclearMode, NUCLEAR_ALARM } from '../lib/nuclear';
import { migrateStatsIfNeeded, recordNuclearCompletion, recordAutoRedirect } from '../lib/stats';
import { logError } from '../lib/errors';

// Service worker for AntiSlack
// Handles storage initialization and declarativeNetRequest rules

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      await initializeStorage();
      console.log('AntiSlack installed - storage initialized');
    }

    // Migrate stats on install/update
    await migrateStatsIfNeeded();

    // Always update rules on install/update
    const settings = await getSettings();
    if (settings.enabled) {
      await updateBlockingRules();
    }

    // Create context menu
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'block-this-site',
        title: 'Block this site',
        contexts: ['page', 'frame', 'link'],
      });
    });
  } catch (error) {
    console.error('AntiSlack: Installation error:', error);
  }
});

// On startup, ensure rules are in sync and clean expired sessions
chrome.runtime.onStartup.addListener(async () => {
  try {
    await cleanExpiredSessions();
    await migrateStatsIfNeeded();

    // Check if nuclear mode should have expired while browser was closed
    const { mode: nuclear, error: nuclearError } = await getNuclearMode();
    if (nuclearError) {
      console.warn('AntiSlack: Could not verify nuclear mode on startup:', nuclearError);
    }
    if (nuclear.active && nuclear.expiresAt <= Date.now()) {
      // Record completion BEFORE deactivating (natural expiration = completion)
      await recordNuclearCompletion();
      await deactivateNuclearMode();
      console.log('AntiSlack: Nuclear mode expired during browser closure');
    }

    const settings = await getSettings();
    if (settings.enabled) {
      await updateBlockingRules();
    } else {
      await disableBlocking();
    }
  } catch (error) {
    console.error('AntiSlack: Startup error:', error);
  }
});

// Handle alarm expiration (bypass and nuclear mode)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    // Handle nuclear mode expiration
    if (alarm.name === NUCLEAR_ALARM) {
      // Record completion BEFORE deactivating (natural expiration = completion)
      await recordNuclearCompletion();
      await deactivateNuclearMode();
      console.log('AntiSlack: Nuclear mode expired');
      return;
    }

    // Handle bypass expiration
    if (alarm.name.startsWith('bypass-expire-')) {
      const domain = alarm.name.replace('bypass-expire-', '');
      await removeBypassSession(domain);
      await updateBlockingRules(); // Re-enable blocking for this domain
      console.log(`AntiSlack: Bypass expired for ${domain}`);
    }
  } catch (error) {
    console.error('AntiSlack: Alarm handler error:', error);
  }
});

// Listen for storage changes to update rules
chrome.storage.onChanged.addListener(async (changes, area) => {
  try {
    if (area === 'sync') {
      if (changes.blockedSites || changes.settings) {
        const settings = await getSettings();
        if (settings.enabled) {
          await updateBlockingRules();
        } else {
          await disableBlocking();
        }
      }
    }

    // Update rules when bypass sessions change (local storage)
    if (area === 'local' && changes.bypassSessions) {
      const settings = await getSettings();
      if (settings.enabled) {
        await updateBlockingRules();
      }
    }
  } catch (error) {
    logError('storage.onChanged', error, { area, changeKeys: Object.keys(changes) });
  }
});

// Track pending undo operations for context menu blocking
const pendingUndos = new Map<string, { siteId: string; timeoutId: ReturnType<typeof setTimeout> }>();

// Helper for simple notifications
async function showNotification(title: string, message: string): Promise<void> {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
    title,
    message,
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'block-this-site' || !tab?.url) return;

  try {
    // Extract domain from URL
    const url = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');

    // Check for chrome:// or extension pages
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      await showNotification('Cannot block', 'System pages cannot be blocked');
      return;
    }

    // Check for duplicates
    const sites = await getBlockedSites();
    if (sites.some(s => s.pattern === domain)) {
      await showNotification('Already blocked', `${domain} is already in your blocklist`);
      return;
    }

    // Add to blocklist
    const newSite = await addBlockedSite(domain);

    // Show notification with undo
    const notificationId = `block-${newSite.id}`;

    // Set up pending undo BEFORE showing notification to prevent race condition
    const timeoutId = setTimeout(async () => {
      pendingUndos.delete(notificationId);
      try {
        await chrome.notifications.clear(notificationId);
      } catch (e) {
        // Notification may already be dismissed
      }
    }, 5000);

    pendingUndos.set(notificationId, { siteId: newSite.id, timeoutId });

    // Now create notification
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
      title: 'TARGET ACQUIRED',
      message: `${domain} has been blocked`,
      buttons: [{ title: 'UNDO' }],
      requireInteraction: false,
    });

    console.log(`AntiSlack: Blocked ${domain} via context menu`);
  } catch (error) {
    console.error('AntiSlack: Context menu block failed:', error);
  }
});

// Notification button click handler for undo
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('block-') || buttonIndex !== 0) return;

  const pending = pendingUndos.get(notificationId);
  if (!pending) return;

  // Clear the timeout
  clearTimeout(pending.timeoutId);
  pendingUndos.delete(notificationId);

  try {
    // Remove the site
    await removeBlockedSite(pending.siteId);
    await chrome.notifications.clear(notificationId);

    // Show confirmation
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
      title: 'UNDO COMPLETE',
      message: 'Site removed from blocklist',
    });

    console.log('AntiSlack: Undo - removed site from blocklist');
  } catch (error) {
    logError('notification.undo', error, { siteId: pending.siteId });
    // Show error notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
      title: 'UNDO FAILED',
      message: 'Could not remove site. Please try in settings.',
    });
  }
});

// Clean up pending undos when notification is closed
chrome.notifications.onClosed.addListener((notificationId) => {
  if (pendingUndos.has(notificationId)) {
    const pending = pendingUndos.get(notificationId);
    if (pending) clearTimeout(pending.timeoutId);
    pendingUndos.delete(notificationId);
  }
});

// Track auto-redirects for stats using webRequest API
chrome.webRequest.onBeforeRedirect.addListener(
  async (details) => {
    // Only track main frame redirects
    if (details.type !== 'main_frame') return;

    try {
      const settings = await getSettings();
      const sites = await getBlockedSites();

      // Check if this redirect matches one of our blocked sites with auto-redirect
      for (const site of sites) {
        // Check if the URL contains the site pattern
        if (!details.url.includes(site.pattern)) continue;

        // Check if auto-redirect is enabled for this site
        const effectiveAutoRedirect = resolveAutoRedirect(site, settings);
        if (!effectiveAutoRedirect) continue;

        // Check if redirect URL matches (site-specific or global default)
        const targetUrl = site.redirectUrl || settings.defaultRedirectUrl;
        if (details.redirectUrl === targetUrl) {
          // This is our auto-redirect, record the stat
          await recordAutoRedirect(site.pattern);
          await incrementSiteAutoRedirectCount(site.pattern);
          console.log(`AntiSlack: Auto-redirect tracked for ${site.pattern}`);
          break;
        }
      }
    } catch (error) {
      logError('webRequest.onBeforeRedirect', error);
    }
  },
  { urls: ['<all_urls>'] }
);
