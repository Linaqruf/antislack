# AntiSlack

Block distracting sites. Solve math to bypass. Build better habits.

<img width="2559" height="1394" alt="image" src="https://github.com/user-attachments/assets/0eebc2e7-e0c1-459d-8ffe-ac889aca7b7c" />

## What it does

You add sites to block. When you try to visit them, you get redirected to a challenge page. Solve the math problem to get 15 minutes of access. The friction is the point.

**Nuclear Mode** locks everything down for a set duration—no bypasses, no excuses.

## Features

- Block sites with wildcard patterns (`*.reddit.com`, `twitter.com/*`)
- Math-challenge bypass (Easy/Medium/Hard difficulty)
- Nuclear mode for hardcore focus sessions
- Per-site custom redirects
- Productivity score tracking
- Activity heat map
- Context menu quick-block
- Syncs across Chrome instances

## Install

### Chrome Web Store

Coming soon™

### Manual Install

```bash
git clone https://github.com/Linaqruf/antislack.git
cd antislack
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `dist/` folder

## Tech

- Manifest V3
- TypeScript + Vite
- Tailwind CSS
- chrome.storage.sync
- declarativeNetRequest API

## Privacy

All data stays local or in your Chrome sync storage. Nothing is sent to external servers. See [PRIVACY.md](PRIVACY.md).

## License

MIT
