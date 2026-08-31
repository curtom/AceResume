const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const pages = {
  resumes: {
    eyebrow: 'RESUME LIBRARY', title: '我的简历', description: '为不同机会，准备不同版本的自己。', action: '＋ 创建简历',
    cards: [
      ['前端开发实习 · 2026 秋招', '墨蓝单栏 · 完整度 82%', '编辑中'],
      ['产品运营实习', '暖灰双栏 · 完整度 100%', '已完成'],
      ['通用中文简历', '学院派 · 完整度 74%', '草稿'],
    ],
  },
  profile: {
    eyebrow: 'PERSONAL ARCHIVE', title: '个人资料', description: '一次整理，按需复用到每一份简历。', action: '82% 已完善',
    cards: [['基本信息', '姓名、联系方式、求职意向与个人简介', '已完成'], ['教育与经历', '1 段教育、1 段实习、2 个项目', '6 条'], ['技能与证书', '前端开发、工程工具、语言能力', '4 类']],
  },
  documents: {
    eyebrow: 'SOURCE LIBRARY', title: '材料库', description: '所有 AI 建议，都从这里找到事实依据。', action: '＋ 上传材料',
    cards: [['课程设计结项报告.pdf', '解析完成 · 18 页 · 2 分钟前使用', '可引用'], ['暑期实习总结.docx', '解析完成 · 6 个相关片段', '可引用'], ['旧版简历.pdf', '等待确认 · 识别到 24 个字段', '待确认']],
  },
  templates: {
    eyebrow: 'TEMPLATE GALLERY', title: '模板中心', description: '内容不变，换一种更适合岗位的表达秩序。', action: '8 套已发布',
    cards: [['墨蓝单栏', '技术岗 · 中文 · 建议 1 页', '当前使用'], ['暖灰双栏', '通用岗 · 中英文 · 建议 1–2 页', '可使用'], ['学院派', '学术 / 留学 · 中英文 · 建议 2 页', '可使用']],
  },
  market: {
    eyebrow: 'APPLICATION MARKET', title: '投递市场', description: '从优秀公司的官方招聘平台出发，寻找下一份机会。', action: '官方招聘入口',
  },
  settings: {
    eyebrow: 'ACCOUNT & PRIVACY', title: '账号设置', description: '管理登录、安全、语言以及你的数据。', action: '数据受保护',
    cards: [['账号与安全', '邮箱、密码与登录会话管理', '正常'], ['语言与偏好', '界面语言：简体中文', '已设置'], ['数据与隐私', '材料授权、数据导出与账号注销', '可管理']],
  },
};

function icon(id) {
  return `<svg><use href="#${id}"/></svg>`;
}

function buildPlaceholder(route) {
  const page = pages[route];
  const view = $(`#${route}-view`);
  if (!page || view.dataset.ready) return;
  if (route === 'market') {
    buildMarket(view, page);
    view.dataset.ready = 'true';
    return;
  }
  view.innerHTML = `
    <div class="placeholder-head">
      <div><span class="eyebrow">${page.eyebrow}</span><h1>${page.title}</h1><p>${page.description}</p></div>
      <button class="primary-btn placeholder-action"><span>${page.action}</span>${icon('i-chevron')}</button>
    </div>
    <div class="placeholder-cards">
      ${page.cards.map((card, index) => `<article class="placeholder-card"><span class="num">0${index + 1}</span><h3>${card[0]}</h3><p>${card[1]}</p><span class="tag">${card[2]}</span></article>`).join('')}
    </div>`;
  view.dataset.ready = 'true';
  $('.placeholder-action', view).addEventListener('click', () => {
    if (route === 'resumes') openModal();
    else if (route === 'documents') $('#file-input').click();
    else showToast(`${page.title}功能已进入演示状态`);
  });
  if (route === 'resumes') $('.placeholder-card', view).addEventListener('click', openEditor);
}

function navigate(route) {
  if (!pages[route] && route !== 'dashboard' && route !== 'editor') route = 'dashboard';
  if (pages[route]) buildPlaceholder(route);
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${route}-view`));
  $$('.nav-item[data-route]').forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  location.hash = route;
}

function openEditor() {
  navigate('editor');
}

function showToast(message) {
  const toast = $('#toast');
  $('span', toast).textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function openDrawer() {
  $('#ai-drawer').classList.add('show');
  $('#drawer-backdrop').classList.add('show');
}

function closeDrawer() {
  $('#ai-drawer').classList.remove('show');
  $('#drawer-backdrop').classList.remove('show');
}

function openModal() {
  $('#modal-backdrop').classList.add('show');
}

function closeModal() {
  $('#modal-backdrop').classList.remove('show');
}

function markSaving() {
  const status = $('#save-status');
  status.textContent = '正在保存…';
  status.previousElementSibling.style.background = '#e4aa3f';
  clearTimeout(markSaving.timer);
  markSaving.timer = setTimeout(() => {
    status.textContent = '所有更改已保存';
    status.previousElementSibling.style.background = '#58a96a';
  }, 900);
}

function bindEditor() {
  $$('[data-bind]').forEach((input) => {
    input.addEventListener('input', () => {
      const target = $(`[data-preview="${input.dataset.bind}"]`);
      if (target) target.textContent = input.value;
      markSaving();
    });
  });
  $('#resume-name').addEventListener('input', markSaving);

  const previewNodes = (section) => $$(`[data-preview-section="${section}"]`, $('#a4-page'));
  const getModuleName = (item) => $('.module-name', item).textContent.trim();
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const moduleEditorMeta = {
    basic: ['BASIC INFORMATION', '维护个人资料，简历会自动同步更新。', '基础资料', false],
    intent: ['JOB OBJECTIVE', '明确目标岗位与求职偏好，让招聘方快速识别方向。', '求职意向', false],
    education: ['EDUCATION', '按时间补充教育经历，完成后会自动排版到简历。', '教育经历', true],
    internship: ['INTERNSHIP', '重点记录岗位、时间与可验证的具体贡献。', '实习经历', true],
    project: ['PROJECT EXPERIENCE', '用事实、角色与结果讲清楚项目价值。', '项目经历', true],
    skills: ['PROFESSIONAL SKILLS', '聚焦岗位相关的技术能力，避免堆砌关键词。', '专业技能', false],
    awards: ['HONORS & CERTIFICATES', '添加获奖、证书或其他可证明的成就。', '奖项证书', true]
  };
  const editorInput = (label, value, target = '', wide = false) => `<label class="module-field${wide ? ' wide' : ''}"><span>${label}</span><input value="${escapeHtml(value)}"${target ? ` data-preview-target="${target}"` : ''}></label>`;
  const editorTextArea = (label, value, target = '') => `<label class="module-field wide"><span>${label}</span><textarea rows="4"${target ? ` data-preview-target="${target}"` : ''}>${escapeHtml(value)}</textarea></label>`;
  const moduleEditorFields = (section) => {
    if (section === 'basic') return `<div class="module-field-grid">${editorInput('姓名', '林晓屿', 'basicName')}${editorInput('联系电话', '138 ···· 7261')}${editorInput('邮箱', 'linxiaoyu@example.com')}${editorInput('毕业届别', '2026 届')}</div>`;
    if (section === 'intent') return `<div class="module-field-grid">${editorInput('目标岗位', '前端开发实习生', 'jobIntent')}${editorInput('意向城市', '杭州')}${editorInput('期望行业', '互联网 / SaaS')}${editorInput('到岗时间', '2026 年 6 月')}</div>`;
    if (section === 'education') return `<div class="module-field-grid">${editorInput('学校名称', '浙江工业大学', 'educationSchool')}${editorInput('学历 / 学位', '软件工程 · 本科', 'educationMajor')}${editorInput('在校时间', '2022.09 — 2026.06')}${editorInput('成绩信息', 'GPA 3.68 / 4.0 · 专业前 15%')}</div>`;
    if (section === 'internship') return `<div class="module-field-grid">${editorInput('公司名称', '杭州云舟科技有限公司', 'internshipCompany')}${editorInput('职位名称', '前端开发实习生', 'internshipRole')}${editorInput('实习时间', '2025.06 — 2025.09')}${editorInput('工作地点', '杭州')}${editorTextArea('实习描述', '参与运营管理后台重构，负责数据看板和用户分群模块的开发与联调；沉淀 8 个可复用业务组件，减少同类页面重复开发工作。', 'internshipDescription')}</div>`;
    if (section === 'project') return `<div class="module-field-grid">${editorInput('项目名称', '拾光 · 校园二手交易平台', 'projectName', true)}${editorInput('担任角色', '前端负责人', 'projectRole')}${editorInput('项目时间', '2025.09 — 2026.01')}${editorInput('技术栈', 'Vue 3 · TypeScript · Pinia · Vite', '', true)}${editorTextArea('项目描述', '负责交易发布与消息模块的前端架构，基于 Vue 3 Composition API 拆分 12 个业务组件；通过虚拟列表和图片懒加载优化长列表体验，首屏加载时间从 2.4 秒降至 1.5 秒。', 'projectDesc')}</div><p class="module-source-tip">✓ 数字“12、2.4 秒、1.5 秒”已在课程设计结项报告中找到依据</p>`;
    if (section === 'skills') return `<div class="module-field-grid">${editorTextArea('技能概述', '前端开发：熟悉 HTML、CSS、JavaScript、TypeScript 与 Vue 3\n工程实践：熟悉 Vite、Git、RESTful API，了解前端性能优化', 'skillsSummary')}</div>`;
    return `<div class="module-field-grid">${editorInput('证书或奖项名称', '全国大学生计算机设计大赛', 'awardName', true)}${editorInput('获得时间', '2025.05')}${editorInput('颁发机构', '中国高等教育学会')}${editorTextArea('成果说明', '负责项目核心交互与前端实现，获得省级二等奖。', 'awardDescription')}</div>`;
  };
  const renderModuleForm = (item) => {
    if (!item) return;
    const section = item.dataset.section;
    const meta = moduleEditorMeta[section] || moduleEditorMeta.project;
    const title = escapeHtml(getModuleName(item));
    const addButton = meta[3] ? `<button class="module-editor-add" type="button" data-add-entry><svg><use href="#i-plus"/></svg>添加一段${title}</button>` : '';
    const form = $('#module-form');
    form.dataset.section = section;
    form.innerHTML = `<div class="module-editor-heading"><div><span>${meta[0]}</span><h1>${title}</h1><p>${meta[1]}</p></div><button class="module-ai-button" type="button" data-module-ai><svg><use href="#i-spark"/></svg>AI 辅助优化</button></div><div class="module-editor-tip"><svg><use href="#i-check"/></svg>填写后会自动排版在简历上；不需要的内容可直接隐藏模块。</div><div class="module-entry-list"><article class="module-editor-card"><div class="module-card-title"><b>${meta[2]} 1</b><small>自动保存</small></div>${moduleEditorFields(section)}</article></div>${addButton}`;
  };
  const previewSelectorByField = {
    basicName: '.resume-header h1', jobIntent: '.resume-header p', educationSchool: '[data-preview-section="education"] .resume-entry-head strong', educationMajor: '[data-preview-section="education"] .resume-entry-sub span', internshipCompany: '[data-preview-section="internship"] .resume-entry-head strong', internshipRole: '[data-preview-section="internship"] .resume-entry-sub span', internshipDescription: '[data-preview-section="internship"] li:first-child', projectName: '[data-preview="projectName"]', projectRole: '[data-preview="projectRole"]', projectDesc: '[data-preview="projectDesc"]', skillsSummary: '[data-preview-section="skills"] .skill-lines p:first-child'
  };

  const selectModule = (item) => {
    $$('.module-item').forEach((node) => node.classList.remove('active'));
    item.classList.add('active');
    const drawerLabel = $('.drawer-handle b');
    if (drawerLabel) drawerLabel.textContent = `${getModuleName(item)}编辑`;
    renderModuleForm(item);
    const workspace = $('.editor-workspace');
    if (workspace.classList.contains('drawer-collapsed')) {
      workspace.classList.remove('drawer-collapsed');
      $('#drawer-toggle').setAttribute('aria-expanded', 'true');
    }
    if (item.dataset.section !== 'project') showToast(`已打开${getModuleName(item)}编辑抽屉`);
  };

  const toggleModuleVisibility = (item) => {
    const isVisible = item.classList.contains('is-hidden');
    item.classList.toggle('is-hidden', !isVisible);
    $('.module-state', item).classList.toggle('on', isVisible);
    previewNodes(item.dataset.section).forEach((node) => { node.style.display = isVisible ? '' : 'none'; });
    $('.module-visibility', item).setAttribute('aria-label', `${isVisible ? '隐藏' : '显示'}${getModuleName(item)}`);
    showToast(isVisible ? '模块已显示在简历中' : '模块已从简历预览中隐藏');
    markSaving();
  };

  const moveModule = (item, direction) => {
    const sibling = direction === 'prev' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) {
      showToast(direction === 'prev' ? '当前已是第一个模块' : '当前已是最后一个模块');
      return;
    }
    const list = item.parentElement;
    if (direction === 'prev') list.insertBefore(item, sibling);
    else list.insertBefore(sibling, item);
    const currentPreview = previewNodes(item.dataset.section);
    const siblingPreview = previewNodes(sibling.dataset.section);
    if (currentPreview.length === 1 && siblingPreview.length === 1 && currentPreview[0].parentElement === siblingPreview[0].parentElement) {
      if (direction === 'prev') currentPreview[0].parentElement.insertBefore(currentPreview[0], siblingPreview[0]);
      else currentPreview[0].parentElement.insertBefore(siblingPreview[0], currentPreview[0]);
    }
    showToast('模块顺序已更新');
    markSaving();
  };

  const renameModule = (item) => {
    const name = $('.module-name', item);
    if (!name || $('.module-title-input', item)) return;
    const input = document.createElement('input');
    input.className = 'module-title-input';
    input.value = name.textContent.trim();
    input.maxLength = 12;
    name.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const nextName = input.value.trim() || '未命名模块';
      const label = document.createElement('span');
      label.className = 'module-name';
      label.textContent = nextName;
      input.replaceWith(label);
      if (item.classList.contains('active')) { $('.drawer-handle b').textContent = `${nextName}编辑`; renderModuleForm(item); }
      const previewTitle = $(`[data-preview-section="${item.dataset.section}"] .resume-section-title b`);
      if (previewTitle) previewTitle.textContent = nextName;
      showToast('模块名称已更新');
      markSaving();
    };
    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') input.blur(); if (event.key === 'Escape') { input.value = name.textContent.trim(); input.blur(); } });
  };

  $$('.module-select').forEach((button) => button.addEventListener('click', (event) => {
    const item = button.closest('.module-item');
    if (event.target.closest('.module-edit')) renameModule(item);
    else selectModule(item);
  }));
  $$('.module-visibility').forEach((button) => button.addEventListener('click', () => toggleModuleVisibility(button.closest('.module-item'))));
  $$('.module-move').forEach((button) => button.addEventListener('click', () => moveModule(button.closest('.module-item'), button.dataset.direction)));
  const moduleForm = $('#module-form');
  moduleForm.addEventListener('input', (event) => {
    const field = event.target.closest('[data-preview-target]');
    if (!field) return;
    const selector = previewSelectorByField[field.dataset.previewTarget];
    const preview = selector ? $(selector, $('#a4-page')) : null;
    if (preview) preview.textContent = field.value;
    markSaving();
  });
  moduleForm.addEventListener('click', (event) => {
    if (event.target.closest('[data-module-ai]')) { openDrawer(); return; }
    if (!event.target.closest('[data-add-entry]')) return;
    const active = $('.module-item.active');
    const title = getModuleName(active);
    const entries = $('.module-entry-list', moduleForm);
    const count = entries.children.length + 1;
    entries.insertAdjacentHTML('beforeend', `<article class="module-editor-card module-editor-card-added"><div class="module-card-title"><b>${escapeHtml(title)} ${count}</b><small>待填写</small></div><p>已添加空白条目，可继续补充具体经历与结果。</p></article>`);
    showToast(`已添加一段${title}`);
    markSaving();
  });
  renderModuleForm($('.module-item.active'));
  $$('[data-close-drawer]').forEach((button) => button.addEventListener('click', closeDrawer));
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#generate-btn').addEventListener('click', () => {
    const button = $('#generate-btn');
    button.classList.add('loading');
    $('span', button).textContent = '正在核对事实来源…';
    setTimeout(() => {
      button.classList.remove('loading');
      $('span', button).textContent = '重新生成';
      $('#ai-result').classList.add('show');
    }, 900);
  });
  $$('.accept-suggestion').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.suggestion-card');
    card.classList.add('accepted');
    const text = $('p', card).textContent;
    selectModule($('.module-item[data-section="project"]'));
    const field = $('[data-preview-target="projectDesc"]', moduleForm);
    if (field && !field.value.includes(text)) field.value = `${field.value}\n${text}`;
    const preview = $('[data-preview="projectDesc"]');
    if (field && preview) preview.textContent = field.value;
    showToast('建议已写入，并创建历史版本');
    markSaving();
  }));
  $$('.reject-suggestion').forEach((button) => button.addEventListener('click', () => {
    button.closest('.suggestion-card').classList.add('rejected');
    showToast('已忽略这条建议');
  }));

  let zoom = 100;
  $$('[data-zoom]').forEach((button) => button.addEventListener('click', () => {
    zoom = Math.min(115, Math.max(70, zoom + (button.dataset.zoom === 'in' ? 5 : -5)));
    $('#zoom-value').textContent = `${zoom}%`;
    $('#a4-page').style.transform = `scale(${zoom / 100})`;
  }));
  $('#preview-btn').addEventListener('click', () => {
    const editorView = $('#editor-view');
    const isFullscreen = editorView.classList.toggle('fullscreen-preview');
    $('#a4-page').style.transform = isFullscreen ? 'scale(1)' : `scale(${zoom / 100})`;
    $('#preview-btn').innerHTML = isFullscreen ? '← 返回编辑' : `${icon('i-eye')}全屏预览`;
  });
  $('#download-btn').addEventListener('click', () => {
    showToast('导出前检查通过，正在打开打印预览');
    setTimeout(() => window.print(), 500);
  });
  $('#history-btn').addEventListener('click', () => showToast('最近版本：AI 建议前 · 今天 10:42'));
  $('#template-btn').addEventListener('click', () => showToast('模板切换不会删除或覆盖简历内容'));
  $('#add-section').addEventListener('click', () => showToast('可添加校园经历、自我评价等标准模块'));
  $('#add-custom').addEventListener('click', () => showToast('自定义模块已准备添加'));
  $('#style-btn').addEventListener('click', () => showToast('可调整字号、颜色、间距与页边距'));
  const legacyNewEntry = $('.new-entry');
  if (legacyNewEntry) legacyNewEntry.addEventListener('click', () => showToast('新的项目经历已添加到草稿'));

}


function bindShellToggles() {
  const sidebarToggle = $('#sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const shell = $('.app-shell');
      const isCollapsed = shell.classList.toggle('sidebar-collapsed');
      sidebarToggle.setAttribute('aria-label', isCollapsed ? '展开导航栏' : '收起导航栏');
      sidebarToggle.setAttribute('title', isCollapsed ? '展开导航栏' : '收起导航栏');
    });
  }

  const drawerToggle = $('#drawer-toggle');
  const workspace = $('.editor-workspace');
  if (drawerToggle && workspace) {
    drawerToggle.setAttribute('aria-expanded', String(!workspace.classList.contains('drawer-collapsed')));
    drawerToggle.addEventListener('click', () => {
      const isCollapsed = workspace.classList.toggle('drawer-collapsed');
      drawerToggle.setAttribute('aria-expanded', String(!isCollapsed));
      showToast(isCollapsed ? '编辑抽屉已收起' : '编辑抽屉已展开');
    });
  }
}
function init() {
  const now = new Date();
  $('#today-week').textContent = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
  $('#today-date').textContent = `${now.getMonth() + 1}月${now.getDate()}日`;

  $$('[data-route]').forEach((item) => item.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(item.dataset.route);
  }));
  $$('[data-open-editor]').forEach((item) => item.addEventListener('click', openEditor));
  const aiFocus = $('#open-ai-focus');
  if (aiFocus) aiFocus.addEventListener('click', () => { openEditor(); setTimeout(openDrawer, 100); });
  $('#create-resume').addEventListener('click', openModal);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target === $('#modal-backdrop')) closeModal(); });
  $$('[data-create-option]').forEach((button) => button.addEventListener('click', () => {
    closeModal();
    showToast(button.dataset.createOption === 'import' ? '请选择一份旧简历' : '简历草稿已创建');
    if (button.dataset.createOption === 'import') $('#file-input').click(); else setTimeout(openEditor, 350);
  }));
  const uploadTrigger = $('#upload-trigger');
  if (uploadTrigger) uploadTrigger.addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) showToast(`${file.name} 已进入解析队列`);
  });
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard'));
  bindShellToggles();
  bindEditor();
  navigate(location.hash.slice(1) || 'dashboard');
}


function buildMarket(view, page) {
  const companies = [
    { name: '字节跳动', wordmark: 'ByteDance', accent: '字节跳动', location: '北京 · 上海 · 杭州等', role: '校园招聘 / 实习机会', url: 'https://jobs.bytedance.com/campus/', theme: 'bytedance' },
    { name: '腾讯', wordmark: 'Tencent', accent: '腾讯招聘', location: '深圳 · 北京 · 上海等', role: '校园招聘 / 技术研发', url: 'https://join.qq.com/', theme: 'tencent' },
    { name: '阿里巴巴', wordmark: 'Alibaba', accent: '阿里巴巴', location: '杭州 · 北京 · 上海等', role: '校园招聘 / 研发工程', url: 'https://campus-talent.alibaba.com/campus/gov', theme: 'alibaba' },
    { name: '小米', wordmark: 'mi', accent: '小米招聘', location: '北京 · 南京 · 武汉等', role: '校园招聘 / 软件研发', url: 'https://hr.xiaomi.com/website/campus.html', theme: 'xiaomi' },
    { name: '美团', wordmark: 'meituan', accent: '美团招聘', location: '北京 · 上海 · 成都等', role: '校园招聘 / 日常实习', url: 'https://zhaopin.meituan.com/', theme: 'meituan' },
    { name: '京东', wordmark: 'JD', accent: '京东招聘', location: '北京 · 宿迁 · 成都等', role: '校园招聘 / 实习生招聘', url: 'https://zhaopin.jd.com/', theme: 'jd' },
  ];
  view.classList.add('market-view');
  view.innerHTML = `
    <div class="placeholder-head">
      <div><span class="eyebrow">${page.eyebrow}</span><h1>${page.title}</h1><p>${page.description}</p></div>
      <span class="market-status">${icon('i-shield')} 所有入口均为官方招聘平台</span>
    </div>
    <section class="market-hero">
      <div class="market-copy"><span class="eyebrow">FIND YOUR NEXT PLACE</span><h2>把准备好的简历，<br>投向真正心动的地方。</h2><p>选择一家公司即可跳转至其官方招聘页面。岗位状态与投递规则请以官网实时信息为准。</p></div>
      <div class="market-map" aria-hidden="true"><span>北京</span><span>杭州</span><span>深圳</span></div>
    </section>
    <div class="market-toolbar"><div><b>精选公司</b><small>6 个官方招聘入口</small></div><button type="button">按招聘类型筛选 · 全部</button></div>
    <div class="company-grid">${companies.map((company) => `
      <a class="company-card" href="${company.url}" target="_blank" rel="noopener noreferrer" aria-label="打开${company.name}官方招聘平台">
        <div class="company-visual ${company.theme}"><b>${company.wordmark}</b><i>${company.accent}</i></div>
        <div class="company-body"><span class="company-location">${icon('i-pin')}${company.location}</span><h3>${company.name}</h3><p>${company.role}<br>点击直达官网查看实时岗位</p><span class="company-link">进入官方招聘平台 ${icon('i-chevron')}</span></div>
      </a>`).join('')}</div>`;
}
init();
