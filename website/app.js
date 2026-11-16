(() => {
  'use strict';

  const RELEASES = 'https://github.com/luoliguang/ClickPulse-Social/releases';
  const translations = {
    'zh-CN': {
      skip: '跳到主要内容',
      'nav.features': '功能', 'nav.privacy': '隐私', 'nav.download': '下载',
      'version.loading': '正在获取最新版本',
      'hero.title': '看见每天的<br>每一次输入',
      'hero.lead': 'ClickPulse 在本地记录键盘和鼠标活动，把重复的按键与点击，变成趋势、热力图和可以回看的工作节奏。',
      'hero.download': '选择下载版本', 'hero.preview': '看看它如何工作',
      'hero.note': '无需账号 · 无遥测 · 数据默认只留在你的电脑',
      'preview.alt': 'ClickPulse 概览页面，显示活动趋势和日历',
      'proof.offline.title': '完全离线', 'proof.offline.text': '日常数据不离开设备',
      'proof.platform.title': '三个平台', 'proof.opensource.title': '开放源码',
      'proof.languages.title': '八种语言', 'proof.languages.text': '界面与时区自由选择',
      'product.title': '不是监控，是一面镜子',
      'product.lead': 'ClickPulse 不记录你输入了什么，也不知道你打开了哪个应用。它只保存聚合后的次数，帮助你理解自己的节奏。',
      'product.heatmap.title': '最常按下的键，一眼看清',
      'product.heatmap.text': '键盘热力图把长期习惯变成直观颜色。查看当天，也可以回到历史中的任意一天。',
      'product.heatmap.alt': 'ClickPulse 键盘热力图',
      'product.history.title': '趋势与历史', 'product.history.text': '从小时曲线到全年日历，找到高强度工作和休息的真实分布。',
      'product.mini.alt': 'ClickPulse Mini 悬浮窗口', 'product.mini.text': '把今天的计数留在桌面一角，需要时看一眼，不打断正在做的事。',
      'features.title': '数据属于你，使用方式也属于你',
      'features.local.title': '本地数据库', 'features.local.text': '统计历史保存在你选择的本地目录，可备份、迁移或合并。',
      'features.views.title': '多种视图', 'features.views.text': '概览、历史、热力图、矩形树图和 Mini 模式，各自回答不同问题。',
      'features.personal.title': '按你的习惯工作', 'features.personal.text': '支持主题、语言、时区、紧凑窗口和开机启动。',
      'download.title': '下载 ClickPulse', 'download.lead': '选择你的系统。官网会在正式 Release 发布后自动切换到最新稳定版。',
      'download.checking': '正在检查最新版本…', 'download.recommended': '适合你的设备', 'download.windows': '下载便携版',
      'release.title': '这个版本有什么变化', 'release.loading': '版本信息加载后会显示更新内容。',
      'release.github': '在 GitHub 查看完整 Release', 'release.checksum': '下载 SHA256 校验文件',
      'warning.title': '首次打开提示：', 'warning.text': 'Windows 和 macOS 版本暂未购买代码签名证书，系统可能显示安全提醒。安装包可以通过 SHA256 和公开源码校验。', 'warning.guide': '查看安装说明',
      'privacy.title': '你的输入，不该成为别人的数据',
      'privacy.lead': 'ClickPulse 的正常统计完全离线。它不会保存按键内容、具体字符、应用名称、鼠标位置或浏览记录。',
      'privacy.noaccount.title': '不需要账号', 'privacy.noaccount.text': '下载后即可使用，不需要邮箱或登录。',
      'privacy.notelemetry.title': '没有遥测', 'privacy.notelemetry.text': '没有广告 SDK，也没有隐藏的行为分析。',
      'privacy.optin.title': '排行榜明确自愿', 'privacy.optin.text': '只有你主动加入时，才上传每日键盘和鼠标总次数。',
      'opensource.title': '开放源码，也保留来路',
      'opensource.text': 'ClickPulse-Social 是 endNone/ClickPulse 的独立二次开发版本，由罗洋洋维护，继续采用 GPL-3.0-or-later 许可证。你可以审查源码、构建自己的版本，也可以参与改进。',
      'opensource.action': '查看 GitHub 源码', 'footer.tagline': '让重复的输入，留下有用的痕迹。', 'footer.changelog': '更新日志', 'footer.issues': '问题反馈',
      'state.ready': '最新稳定版 {version}', 'state.fallback': '版本服务暂不可用，可前往 GitHub 下载',
      'version.ready': '{version} 已发布', 'notes.empty': '查看完整 Release 获取这个版本的更新说明。',
      'smart.windows': '下载 Windows 版', 'smart.linux': '下载 Linux x64 版', 'smart.default': '选择下载版本'
    },
    en: {
      skip: 'Skip to main content',
      'nav.features': 'Features', 'nav.privacy': 'Privacy', 'nav.download': 'Download',
      'version.loading': 'Checking the latest release',
      'hero.title': 'See every input<br>shape your day',
      'hero.lead': 'ClickPulse counts keyboard and mouse activity locally, turning repeated keys and clicks into trends, heatmaps, and a work rhythm you can look back on.',
      'hero.download': 'Choose a download', 'hero.preview': 'See how it works',
      'hero.note': 'No account · No telemetry · Your data stays on your computer',
      'preview.alt': 'ClickPulse overview showing activity trends and calendar',
      'proof.offline.title': 'Fully offline', 'proof.offline.text': 'Daily data stays on your device',
      'proof.platform.title': 'Three platforms', 'proof.opensource.title': 'Open source',
      'proof.languages.title': 'Eight languages', 'proof.languages.text': 'Choose your interface and time zone',
      'product.title': 'Not surveillance. A mirror.',
      'product.lead': 'ClickPulse does not know what you type or which app you use. It stores only aggregate counts to help you understand your own rhythm.',
      'product.heatmap.title': 'Your most-used keys, at a glance',
      'product.heatmap.text': 'The keyboard heatmap turns long-term habits into color. Review today or return to any day in your history.',
      'product.heatmap.alt': 'ClickPulse keyboard heatmap',
      'product.history.title': 'Trends and history', 'product.history.text': 'From hourly curves to a full-year calendar, see where focused work and rest actually happen.',
      'product.mini.alt': 'ClickPulse Mini floating window', 'product.mini.text': 'Keep today’s totals in a corner of the desktop. One glance, without leaving your work.',
      'features.title': 'Your data, used your way',
      'features.local.title': 'Local database', 'features.local.text': 'History lives in a local folder you choose, ready to back up, move, or merge.',
      'features.views.title': 'Views with a purpose', 'features.views.text': 'Overview, history, heatmap, treemap, and Mini mode each answer a different question.',
      'features.personal.title': 'Works around you', 'features.personal.text': 'Choose themes, language, time zone, compact view, and launch at login.',
      'download.title': 'Download ClickPulse', 'download.lead': 'Choose your system. The site switches automatically when a new stable Release is published.',
      'download.checking': 'Checking the latest release…', 'download.recommended': 'Recommended for this device', 'download.windows': 'Download portable app',
      'release.title': 'What changed in this release', 'release.loading': 'Release notes will appear when version data loads.',
      'release.github': 'View the full Release on GitHub', 'release.checksum': 'Download SHA256 checksums',
      'warning.title': 'First launch:', 'warning.text': 'The Windows and macOS builds are not code-signed yet, so your system may show a security prompt. Packages can be checked against SHA256 and the public source.', 'warning.guide': 'Read the install guide',
      'privacy.title': 'Your input should not become someone else’s data',
      'privacy.lead': 'Normal ClickPulse tracking is fully offline. It never saves typed content, individual characters, app names, pointer positions, or browsing history.',
      'privacy.noaccount.title': 'No account', 'privacy.noaccount.text': 'Download and start. No email or sign-in required.',
      'privacy.notelemetry.title': 'No telemetry', 'privacy.notelemetry.text': 'No advertising SDK and no hidden behavior analytics.',
      'privacy.optin.title': 'Leaderboard is opt-in', 'privacy.optin.text': 'Only daily keyboard and mouse totals upload after you explicitly join.',
      'opensource.title': 'Open source, with its history intact',
      'opensource.text': 'ClickPulse-Social is an independent derivative of endNone/ClickPulse, maintained by Luo Yangyang under GPL-3.0-or-later. Review the source, build your own copy, or help improve it.',
      'opensource.action': 'View source on GitHub', 'footer.tagline': 'Make repeated input leave a useful trace.', 'footer.changelog': 'Changelog', 'footer.issues': 'Report an issue',
      'state.ready': 'Latest stable release {version}', 'state.fallback': 'Version service is unavailable. Downloads remain on GitHub.',
      'version.ready': '{version} is available', 'notes.empty': 'Open the full Release to read the notes for this version.',
      'smart.windows': 'Download for Windows', 'smart.linux': 'Download for Linux x64', 'smart.default': 'Choose a download'
    }
  };

  const preferred = localStorage.getItem('clickpulse-site-language');
  let language = preferred === 'en' || preferred === 'zh-CN' ? preferred : (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
  let release = null;
  let detectedPlatform = 'other';

  const text = (key, variables = {}) => {
    let value = translations[language][key] || translations['zh-CN'][key] || key;
    for (const [name, replacement] of Object.entries(variables)) value = value.replace(`{${name}}`, replacement);
    return value;
  };

  function applyLanguage() {
    document.documentElement.lang = language;
    document.title = language === 'zh-CN' ? 'ClickPulse — 离线键盘与鼠标活动统计' : 'ClickPulse — Offline keyboard and mouse activity insights';
    document.querySelector('meta[name="description"]').content = language === 'zh-CN'
      ? 'ClickPulse 是一款隐私优先的离线键盘与鼠标活动统计工具，支持 Windows、macOS 和 Linux。'
      : 'ClickPulse is a privacy-first offline keyboard and mouse activity tracker for Windows, macOS, and Linux.';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.innerHTML = text(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-alt]').forEach(node => { node.alt = text(node.dataset.i18nAlt); });
    const switcher = document.getElementById('language-switch');
    switcher.textContent = language === 'zh-CN' ? 'EN' : '中文';
    switcher.setAttribute('aria-label', language === 'zh-CN' ? 'Switch to English' : '切换到中文');
    renderRelease();
    updateSmartDownload();
  }

  function detectPlatform() {
    const value = `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
    if (/android|iphone|ipad|ipod|mobile/.test(value)) return 'other';
    if (value.includes('win')) return 'windows';
    if (value.includes('mac')) return 'macos';
    if (value.includes('linux') || value.includes('x11')) return 'linux';
    return 'other';
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function safeRelease(data) {
    if (!data || data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name) || !Array.isArray(data.assets)) throw new Error('Invalid release metadata');
    const page = new URL(data.html_url);
    if (page.protocol !== 'https:' || page.hostname !== 'github.com' || !page.pathname.endsWith(`/releases/tag/${data.tag_name}`)) throw new Error('Invalid release URL');
    const version = data.tag_name.slice(1);
    const assets = new Map();
    for (const asset of data.assets) {
      if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') continue;
      const url = new URL(asset.browser_download_url);
      if (url.protocol !== 'https:' || !['clickpulse.fangdutex.cn', 'github.com'].includes(url.hostname)) continue;
      assets.set(asset.name, { url: url.href, size: Number(asset.size) || 0 });
    }
    return { version, tag: data.tag_name, page: page.href, notes: Array.isArray(data.notes) ? data.notes.filter(note => typeof note === 'string').slice(0, 6) : [], assets };
  }

  function asset(name, githubFallback = false) {
    const found = release?.assets.get(name);
    if (found) return found;
    return { url: githubFallback && release ? `${release.page.replace('/tag/', '/download/')}/${name}` : `${RELEASES}/latest`, size: 0 };
  }

  function setDownload(id, sizeId, name, descriptor, githubFallback = false) {
    const item = asset(name, githubFallback);
    const link = document.getElementById(id);
    const size = document.getElementById(sizeId);
    link.href = item.url;
    size.textContent = [descriptor, formatSize(item.size)].filter(Boolean).join(' · ');
  }

  function renderRelease() {
    const state = document.getElementById('release-state');
    const heroVersion = document.getElementById('hero-version');
    if (!release) {
      if (state.dataset.failed === 'true') {
        state.textContent = text('state.fallback');
        heroVersion.textContent = text('state.fallback');
      }
      return;
    }
    const versionLabel = `v${release.version}`;
    state.textContent = text('state.ready', { version: versionLabel });
    state.classList.add('is-ready');
    heroVersion.textContent = text('version.ready', { version: versionLabel });
    document.getElementById('release-page').href = release.page;

    setDownload('download-windows', 'size-windows', `ClickPulse-${release.version}-windows-x64.zip`, 'ZIP · x64');
    setDownload('download-mac-arm', 'size-mac-arm', `ClickPulse-${release.version}-macos-arm64.dmg`, 'DMG · Apple Silicon', true);
    setDownload('download-mac-x64', 'size-mac-x64', `ClickPulse-${release.version}-macos-x64.dmg`, 'DMG · Intel x64', true);
    setDownload('download-linux-x64', 'size-linux-x64', `ClickPulse-${release.version}-linux-x64.zip`, 'ZIP · x64');
    setDownload('download-linux-arm', 'size-linux-arm', `ClickPulse-${release.version}-linux-arm64.zip`, 'ZIP · ARM64');
    document.getElementById('checksums').href = asset('SHA256SUMS.txt').url;

    const notes = document.getElementById('release-notes');
    notes.replaceChildren(...(release.notes.length ? release.notes : [text('notes.empty')]).map(note => {
      const li = document.createElement('li'); li.textContent = note; return li;
    }));
    updateSmartDownload();
  }

  function updateSmartDownload() {
    document.querySelectorAll('.platform-card').forEach(card => card.classList.toggle('is-recommended', card.dataset.platform === detectedPlatform));
    const smart = document.getElementById('smart-download');
    const label = smart.querySelector('span');
    if (release && detectedPlatform === 'windows') {
      smart.href = document.getElementById('download-windows').href;
      label.textContent = text('smart.windows');
    } else if (release && detectedPlatform === 'linux') {
      smart.href = document.getElementById('download-linux-x64').href;
      label.textContent = text('smart.linux');
    } else {
      smart.href = '#download';
      label.textContent = text('smart.default');
    }
  }

  async function loadRelease() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch('/api/v1/updates/latest', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Release metadata returned ${response.status}`);
      release = safeRelease(await response.json());
    } catch (error) {
      console.warn('Unable to load release metadata', error);
      document.getElementById('release-state').dataset.failed = 'true';
    } finally {
      clearTimeout(timeout);
      renderRelease();
    }
  }

  document.getElementById('language-switch').addEventListener('click', () => {
    language = language === 'zh-CN' ? 'en' : 'zh-CN';
    localStorage.setItem('clickpulse-site-language', language);
    applyLanguage();
  });

  detectedPlatform = detectPlatform();
  applyLanguage();
  loadRelease();
})();
