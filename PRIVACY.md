# Privacy Policy

**AntiSlack** is a browser extension that helps you block distracting websites.

## Data Collection

AntiSlack collects and stores the following data **locally on your device**:

- List of blocked websites you configure
- Browsing statistics (block counts, bypass usage)
- Extension settings and preferences
- Nuclear mode schedules

## Data Storage

All data is stored using Chrome's built-in storage APIs:

- **chrome.storage.sync** - Settings sync across your Chrome instances via your Google account
- **chrome.storage.local** - Temporary data like active bypass sessions

## Data Sharing

AntiSlack does **not**:

- Send any data to external servers
- Share data with third parties
- Use analytics or tracking services
- Access your browsing history beyond blocked site interactions

## Permissions

The extension requires these permissions:

- **storage** - Save your settings and statistics
- **declarativeNetRequest** - Block configured websites
- **alarms** - Manage bypass expiration timers
- **contextMenus** - Quick-block from right-click menu
- **notifications** - Alert when Nuclear mode ends
- **webRequest** - Track auto-redirect events
- **host_permissions** - Required for site blocking to work

## Your Control

You can:

- Export/delete your data anytime via Chrome's extension settings
- Uninstall the extension to remove all local data
- Disable sync to keep data on a single device

## Contact

For privacy questions, open an issue at: https://github.com/Linaqruf/antislack-dev/issues

---

Last updated: January 2026
