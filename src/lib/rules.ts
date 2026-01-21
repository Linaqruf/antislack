import { BlockedSite, Settings, AutoRedirectMode } from './types';
import { getBlockedSites, getSettings } from './storage';
import { getActiveBypassedDomains } from './bypass';
import { handleRuleError, logError } from './errors';

const RULE_ID_OFFSET = 1;

/**
 * Resolve whether auto-redirect should be used for a site
 * based on per-site mode and global setting
 */
export function resolveAutoRedirect(site: BlockedSite, settings: Settings): boolean {
  const mode: AutoRedirectMode = site.autoRedirectMode ?? 'global';
  switch (mode) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'global':
    default:
      return settings.autoRedirect;
  }
}

export function createRuleFromSite(
  site: BlockedSite,
  ruleId: number,
  settings: Settings
): chrome.declarativeNetRequest.Rule {
  // Determine effective auto-redirect based on per-site and global settings
  const effectiveAutoRedirect = resolveAutoRedirect(site, settings);

  // Cascade: site.redirectUrl → settings.defaultRedirectUrl
  const targetUrl = site.redirectUrl || settings.defaultRedirectUrl;

  // When auto-redirect is enabled, redirect directly to the configured URL
  // instead of showing the block page
  const redirect = effectiveAutoRedirect
    ? { url: targetUrl }
    : { extensionPath: `/src/redirect/index.html?blocked=${encodeURIComponent(site.pattern)}` };

  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect,
    },
    condition: {
      urlFilter: `||${site.pattern}`,
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  };
}

export async function updateBlockingRules(): Promise<void> {
  try {
    const sites = await getBlockedSites();
    const settings = await getSettings();

    if (!settings.enabled) {
      await clearAllRules();
      return;
    }

    // Get active bypass sessions and filter them out
    const bypassedDomains = await getActiveBypassedDomains();

    // Filter out sites that are currently bypassed
    const activeSites = sites.filter(
      (site) =>
        !bypassedDomains.some(
          (domain) =>
            site.pattern === domain || domain.endsWith('.' + site.pattern)
        )
    );

    const newRules = activeSites.map((site, index) =>
      createRuleFromSite(site, RULE_ID_OFFSET + index, settings)
    );

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map((rule) => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: newRules,
    });

    console.log(
      `AntiSlack: Updated ${newRules.length} blocking rules (${bypassedDomains.length} bypassed)`
    );
  } catch (error) {
    handleRuleError(error, 'updateBlockingRules');
    logError('updateBlockingRules', error);
  }
}

export async function clearAllRules(): Promise<void> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map((rule) => rule.id);

    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
      });
    }

    console.log('AntiSlack: Cleared all blocking rules');
  } catch (error) {
    handleRuleError(error, 'clearAllRules');
    logError('clearAllRules', error);
  }
}

export async function enableBlocking(): Promise<void> {
  await updateBlockingRules();
}

export async function disableBlocking(): Promise<void> {
  await clearAllRules();
}
