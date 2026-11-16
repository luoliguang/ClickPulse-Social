(() => {
  'use strict';

  const RELEASES = 'https://github.com/luoliguang/ClickPulse-Social/releases';
  const translations = {
    'zh-CN': {
      skip: '跳到主要内容',
      'nav.label': '主导航', 'nav.features': '它能做什么', 'nav.privacy': '隐私', 'nav.download': '下载',
      'version.loading': '正在获取最新版本',
      'hero.title': '<span>给今天的输入，</span><span>留一个数字。</span>',
      'hero.lead': 'ClickPulse 在本地统计键盘和鼠标次数。看看今天有多忙，自己的节奏怎样变化，偶尔也和别人比一比。',
      'hero.caveat': '次数不代表效率，但它能让普通的一天变得可见。',
      'hero.download': '选择下载版本', 'hero.preview': '看看它记下了什么',
      'hero.note': '无需账号　不含遥测　支持 Windows、macOS 和 Linux',
      'overview.alt': 'ClickPulse 总览页面，显示今日、近七天和累计输入次数',
      'overview.caption': '一天的输入，从一个数字开始。',
      'milestone.kicker': '今日输入量级', 'milestone.title': '数字没有标准，只有参照。',
      'milestone.lead': '每个岗位的输入方式不同。把今天和过去的自己放在一起看，比用次数评价谁更努力更有意义。',
      'milestone.example': '示例：61,246 次', 'milestone.exampleLevel': '高频输入日',
      'level.start': '刚刚启动', 'level.warm': '热身完成', 'level.flow': '正在状态', 'level.busy': '高频输入日', 'level.fire': '键盘冒烟',
      'milestone.note': '这是一套趣味里程碑，不是生产力评分。',
      'story.kicker': '一份电脑输入日记', 'story.title': '不解释你的一天，<br>只把它如实留下。',
      'heatmap.title': '哪些键，成了你的肌肉记忆？',
      'heatmap.text': '热力图把每一次按键叠成颜色。写代码、做表格、剪视频，每种工作都会留下不同的形状。',
      'heatmap.alt': 'ClickPulse 键盘热力图，按键颜色随使用次数加深',
      'leaderboard.title': '偶尔，和同路的人比一比。',
      'leaderboard.text': '排行榜按日或按周汇总键盘和鼠标次数。加入完全自愿，昵称、身份和头像都由你决定。',
      'leaderboard.alt': 'ClickPulse 社区排行榜，显示成员的键盘、鼠标和总次数',
      'mini.title': '忙起来时，只看一眼。',
      'mini.text': '小窗口留在桌面一角，显示今天的键盘、鼠标和实时速度。它不催促你，也不打断正在做的事。',
      'mini.alt': 'ClickPulse 小窗口，显示今日输入总数和实时速度',
      'privacy.kicker': '隐私边界', 'privacy.title': '我们记录次数，<br>不记录你输入了什么。',
      'privacy.lead': '正常统计完全离线。只有你主动加入排行榜时，每日键盘和鼠标总次数才会上传。',
      'privacy.keep.title': '会保存', 'privacy.keep.counts': '键盘和鼠标次数', 'privacy.keep.time': '日期与小时分布', 'privacy.keep.keys': '按键使用频率',
      'privacy.never.title': '不会保存', 'privacy.never.content': '输入内容和具体字符', 'privacy.never.apps': '应用名称和浏览记录', 'privacy.never.pointer': '鼠标位置和屏幕内容',
      'download.kicker': '带走你自己的输入日记', 'download.title': '下载 ClickPulse',
      'download.lead': '选择你的系统。官网只跟随正式稳定版更新。',
      'download.checking': '正在检查最新版本…', 'download.recommended': '适合你的设备', 'download.windows': '下载便携版',
      'release.title': '这个版本有什么变化', 'release.loading': '版本信息加载后会显示更新内容。',
      'release.github': '在 GitHub 查看完整 Release', 'release.checksum': '下载 SHA256 校验文件',
      'warning.title': '首次打开提示：', 'warning.text': 'Windows 和 macOS 版本暂未购买代码签名证书，系统可能显示安全提醒。安装包可以通过 SHA256 和公开源码校验。', 'warning.guide': '查看安装说明',
      'opensource.kicker': '开放源码', 'opensource.title': '数据留在电脑，代码留在阳光下。',
      'opensource.text': 'ClickPulse-Social 是 endNone/ClickPulse 的独立二次开发版本，由罗洋洋维护，继续采用 GPL-3.0-or-later 许可证。',
      'opensource.action': '查看 GitHub 源码', 'footer.tagline': '给今天的输入，留一个数字。', 'footer.changelog': '更新日志', 'footer.issues': '问题反馈',
      'state.ready': '最新稳定版 {version}', 'state.fallback': '版本服务暂不可用，可前往 GitHub 下载',
      'version.ready': '{version} 已发布', 'notes.empty': '查看完整 Release 获取这个版本的更新说明。',
      'smart.windows': '下载 Windows 版', 'smart.linux': '下载 Linux x64 版', 'smart.default': '选择下载版本'
    },
    en: {
      skip: 'Skip to main content',
      'nav.label': 'Primary navigation', 'nav.features': 'What it shows', 'nav.privacy': 'Privacy', 'nav.download': 'Download',
      'version.loading': 'Checking the latest release',
      'hero.title': '<span>Give today’s input</span><span>a number.</span>',
      'hero.lead': 'ClickPulse counts keyboard and mouse activity locally. See how busy today was, how your rhythm changes, and—occasionally—how you compare.',
      'hero.caveat': 'Counts are not productivity, but they can make an ordinary day visible.',
      'hero.download': 'Choose a download', 'hero.preview': 'See what it keeps',
      'hero.note': 'No account　No telemetry　Windows, macOS, and Linux',
      'overview.alt': 'ClickPulse overview showing today, the last seven days, and all-time input counts',
      'overview.caption': 'A day of input begins with one number.',
      'milestone.kicker': 'Today’s input range', 'milestone.title': 'There is no standard. Only context.',
      'milestone.lead': 'Every role uses a computer differently. Comparing today with your own past says more than using a count to judge who worked harder.',
      'milestone.example': 'Example: 61,246 inputs', 'milestone.exampleLevel': 'High-input day',
      'level.start': 'Getting started', 'level.warm': 'Warmed up', 'level.flow': 'In the flow', 'level.busy': 'High-input day', 'level.fire': 'Keyboard on fire',
      'milestone.note': 'These are playful milestones, not a productivity score.',
      'story.kicker': 'A computer input journal', 'story.title': 'It does not explain your day.<br>It simply keeps the trace.',
      'heatmap.title': 'Which keys became muscle memory?',
      'heatmap.text': 'The heatmap layers every keypress into color. Code, spreadsheets, and video edits each leave a different shape.',
      'heatmap.alt': 'ClickPulse keyboard heatmap with deeper colors for more frequently used keys',
      'leaderboard.title': 'Sometimes, compare with people on the same road.',
      'leaderboard.text': 'The leaderboard totals keyboard and mouse activity by day or week. Joining is entirely optional; your name, role, and avatar are yours to choose.',
      'leaderboard.alt': 'ClickPulse community leaderboard showing members and their keyboard, mouse, and total counts',
      'mini.title': 'When work gets busy, take one glance.',
      'mini.text': 'Mini stays in a corner of your desktop with today’s keyboard, mouse, and live speed. It does not hurry you or interrupt the work.',
      'mini.alt': 'ClickPulse Mini showing today’s total input and live speed',
      'privacy.kicker': 'The privacy boundary', 'privacy.title': 'We count the inputs.<br>We never record what you type.',
      'privacy.lead': 'Normal tracking is fully offline. Daily keyboard and mouse totals upload only if you explicitly join the leaderboard.',
      'privacy.keep.title': 'Stored locally', 'privacy.keep.counts': 'Keyboard and mouse counts', 'privacy.keep.time': 'Date and hourly distribution', 'privacy.keep.keys': 'Key usage frequency',
      'privacy.never.title': 'Never stored', 'privacy.never.content': 'Typed content or characters', 'privacy.never.apps': 'App names or browsing history', 'privacy.never.pointer': 'Pointer position or screen content',
      'download.kicker': 'Take your input journal with you', 'download.title': 'Download ClickPulse',
      'download.lead': 'Choose your system. This site follows stable releases only.',
      'download.checking': 'Checking the latest release…', 'download.recommended': 'Recommended for this device', 'download.windows': 'Download portable app',
      'release.title': 'What changed in this release', 'release.loading': 'Release notes will appear when version data loads.',
      'release.github': 'View the full Release on GitHub', 'release.checksum': 'Download SHA256 checksums',
      'warning.title': 'First launch:', 'warning.text': 'The Windows and macOS builds are not code-signed yet, so your system may show a security prompt. Packages can be checked against SHA256 and the public source.', 'warning.guide': 'Read the install guide',
      'opensource.kicker': 'Open source', 'opensource.title': 'Data stays on your computer. Code stays in the open.',
      'opensource.text': 'ClickPulse-Social is an independent derivative of endNone/ClickPulse, maintained by Luo Yangyang under GPL-3.0-or-later.',
      'opensource.action': 'View source on GitHub', 'footer.tagline': 'Give today’s input a number.', 'footer.changelog': 'Changelog', 'footer.issues': 'Report an issue',
      'state.ready': 'Latest stable release {version}', 'state.fallback': 'Version service is unavailable. Downloads remain on GitHub.',
      'version.ready': '{version} is available', 'notes.empty': 'Open the full Release to read the notes for this version.',
      'smart.windows': 'Download for Windows', 'smart.linux': 'Download for Linux x64', 'smart.default': 'Choose a download'
    }
  };

  const preferred = localStorage.getItem('clickpulse-site-language');
  let language = preferred === 'en' || preferred === 'zh-CN' ? preferred : (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
  let release = null;
  let detectedPlatform = 'other';
  let languageSwitching = false;

  const text = (key, variables = {}) => {
    let value = translations[language][key] || translations['zh-CN'][key] || key;
    for (const [name, replacement] of Object.entries(variables)) value = value.replace(`{${name}}`, replacement);
    return value;
  };

  function applyLanguage() {
    const isChinese = language === 'zh-CN';
    document.documentElement.lang = language;
    document.title = isChinese ? 'ClickPulse — 给今天的输入，留一个数字' : 'ClickPulse — Give today’s input a number';
    document.querySelector('meta[name="description"]').content = isChinese
      ? 'ClickPulse 在本地统计键盘和鼠标次数，让每天的工作节奏可以量化、回看，也可以偶尔和别人比一比。'
      : 'ClickPulse counts keyboard and mouse activity locally, turning each day into a private input journal you can revisit.';
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = isChinese
      ? '不记录输入内容，只记录键盘和鼠标次数。一份只属于你的电脑输入日记。'
      : 'Never the content—only keyboard and mouse counts. A computer input journal that belongs to you.';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.innerHTML = text(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-alt]').forEach(node => { node.alt = text(node.dataset.i18nAlt); });
    document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', text(node.dataset.i18nAria)); });
    const switcher = document.getElementById('language-switch');
    switcher.querySelector('.language-current').textContent = isChinese ? '中' : 'EN';
    switcher.querySelector('.language-next').textContent = isChinese ? 'EN' : '中';
    switcher.setAttribute('aria-label', isChinese ? 'Switch to English' : '切换到中文');
    renderRelease();
    updateSmartDownload();
  }

  async function toggleLanguage() {
    if (languageSwitching) return;
    const nextLanguage = language === 'zh-CN' ? 'en' : 'zh-CN';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shell = document.getElementById('site-shell');
    const switcher = document.getElementById('language-switch');
    languageSwitching = true;
    switcher.disabled = true;
    try {
      if (reduceMotion || typeof shell.animate !== 'function') {
        language = nextLanguage;
        localStorage.setItem('clickpulse-site-language', language);
        applyLanguage();
        return;
      }
      const outgoing = shell.animate([
        { opacity: 1, filter: 'blur(0)' },
        { opacity: .42, filter: 'blur(1.5px)' }
      ], { duration: 90, easing: 'ease-out', fill: 'forwards' });
      await outgoing.finished;
      language = nextLanguage;
      localStorage.setItem('clickpulse-site-language', language);
      applyLanguage();
      const incoming = shell.animate([
        { opacity: .42, filter: 'blur(1.5px)' },
        { opacity: 1, filter: 'blur(0)' }
      ], { duration: 180, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'forwards' });
      outgoing.cancel();
      await incoming.finished;
      incoming.cancel();
    } finally {
      languageSwitching = false;
      switcher.disabled = false;
    }
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
    for (const item of data.assets) {
      if (!item || typeof item.name !== 'string' || typeof item.browser_download_url !== 'string') continue;
      const url = new URL(item.browser_download_url);
      if (url.protocol !== 'https:' || !['clickpulse.fangdutex.cn', 'github.com'].includes(url.hostname)) continue;
      assets.set(item.name, { url: url.href, size: Number(item.size) || 0 });
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

  document.getElementById('language-switch').addEventListener('click', toggleLanguage);
  detectedPlatform = detectPlatform();
  applyLanguage();
  loadRelease();
})();
