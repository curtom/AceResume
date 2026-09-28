import type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionType,
  ResumeTheme,
  RichTextDocument,
  RichTextNode,
  TemplateDefinition,
} from '@aceresume/resume-schema';
import { DEFAULT_RESUME_THEME, TemplateDefinitionSchema } from '@aceresume/resume-schema';

const ALL_SECTIONS: ResumeSectionType[] = [
  'basic',
  'target',
  'education',
  'experience',
  'project',
  'campus',
  'skill',
  'award',
  'summary',
  'custom',
];
const CONSTRAINTS = {
  fontSize: { min: 9, max: 16 },
  lineHeight: { min: 1.2, max: 2 },
  sectionGap: { min: 6, max: 32 },
  paragraphGap: { min: 2, max: 20 },
  pageMargin: { min: 10, max: 30 },
  fonts: ['Noto Sans SC'] as const,
};
const FONT = {
  family: 'Noto Sans SC' as const,
  asset: 'NotoSansSC-Variable.ttf' as const,
  license: 'SIL Open Font License 1.1' as const,
};

function template(
  input: Pick<
    TemplateDefinition,
    | 'id'
    | 'versionId'
    | 'name'
    | 'description'
    | 'category'
    | 'layout'
    | 'sidebarSections'
    | 'visualStyle'
  > & { accentColor: string; recommendedPages?: number },
): TemplateDefinition {
  const { accentColor, recommendedPages = 2, ...definition } = input;
  return TemplateDefinitionSchema.parse({
    schemaVersion: 1,
    version: 1,
    supportedLocales: ['zh-CN', 'en-US'],
    supportedSections: ALL_SECTIONS,
    defaultTheme: { ...DEFAULT_RESUME_THEME, accentColor },
    themeConstraints: CONSTRAINTS,
    pagination: {
      recommendedPages,
      maximumPages: 6,
      avoidEntryBreak: true,
    },
    font: FONT,
    ...definition,
  });
}

export const BUILT_IN_TEMPLATES: readonly TemplateDefinition[] = [
  template({
    id: 'classic-single',
    versionId: 'classic-single-v1',
    name: '经典单栏',
    description: '稳重清晰的通用单栏，适合大多数校招岗位。',
    category: 'general',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'classic',
    accentColor: '#1846b8',
  }),
  template({
    id: 'modern-line',
    versionId: 'modern-line-v1',
    name: '现代线条',
    description: '轻量留白与醒目章节线，适合产品与运营岗位。',
    category: 'general',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'modern',
    accentColor: '#087f8c',
  }),
  template({
    id: 'tech-focus',
    versionId: 'tech-focus-v1',
    name: '技术聚焦',
    description: '强化技术栈与项目信息层级，适合研发岗位。',
    category: 'technology',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'technical',
    accentColor: '#155e75',
  }),
  template({
    id: 'campus-first',
    versionId: 'campus-first-v1',
    name: '校招启程',
    description: '亲和明快的学生模板，突出教育与校园经历。',
    category: 'internship',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'campus',
    accentColor: '#d35d45',
  }),
  template({
    id: 'academic-clean',
    versionId: 'academic-clean-v1',
    name: '学术清简',
    description: '克制的黑白层级，适合研究、实验室与升学申请。',
    category: 'academic',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'academic',
    accentColor: '#334155',
    recommendedPages: 3,
  }),
  template({
    id: 'slate-sidebar',
    versionId: 'slate-sidebar-v1',
    name: '深蓝双栏',
    description: '侧栏集中呈现技能与奖项，主栏突出核心经历。',
    category: 'technology',
    layout: 'two-column',
    sidebarSections: ['basic', 'target', 'skill', 'award'],
    visualStyle: 'slate',
    accentColor: '#244766',
  }),
  template({
    id: 'coral-sidebar',
    versionId: 'coral-sidebar-v1',
    name: '珊瑚双栏',
    description: '温暖而有识别度的双栏，适合作品与项目型经历。',
    category: 'internship',
    layout: 'two-column',
    sidebarSections: ['basic', 'target', 'skill', 'award'],
    visualStyle: 'coral',
    accentColor: '#d85f4a',
  }),
  template({
    id: 'compact-professional',
    versionId: 'compact-professional-v1',
    name: '紧凑专业',
    description: '高信息密度但保持可读性，适合经历较丰富的候选人。',
    category: 'general',
    layout: 'single-column',
    sidebarSections: [],
    visualStyle: 'compact',
    accentColor: '#365314',
    recommendedPages: 2,
  }),
] as const;

export const CLASSIC_SINGLE_TEMPLATE = BUILT_IN_TEMPLATES[0]!;

export function getTemplateDefinition(versionId: string): TemplateDefinition | undefined {
  return BUILT_IN_TEMPLATES.find((item) => item.versionId === versionId);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderNode(node: RichTextNode): string {
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'text') {
    let value = escapeHtml(node.text);
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') value = `<strong>${value}</strong>`;
      else if (mark.type === 'italic') value = `<em>${value}</em>`;
      else if (mark.type === 'underline') value = `<u>${value}</u>`;
      else value = `<a href="${escapeHtml(mark.attrs.href)}" rel="noreferrer">${value}</a>`;
    }
    return value;
  }
  const content = (node.content ?? []).map(renderNode).join('');
  if (node.type === 'paragraph') return `<p>${content}</p>`;
  if (node.type === 'listItem') return `<li>${content}</li>`;
  return node.type === 'bulletList' ? `<ul>${content}</ul>` : `<ol>${content}</ol>`;
}

export function renderRichText(document: RichTextDocument): string {
  return document.content.map(renderNode).join('');
}

function formatDate(startDate: string, endDate: string | null, isCurrent: boolean): string {
  return `${escapeHtml(startDate)} - ${isCurrent ? '至今' : escapeHtml(endDate ?? '')}`;
}

function sectionRegion(section: ResumeSection, definition: TemplateDefinition): string {
  return definition.sidebarSections.includes(section.type) ? 'sidebar' : 'main';
}

function renderEntries(section: ResumeSection, definition: TemplateDefinition): string {
  if (!('entries' in section.content) || section.content.entries.length === 0) return '';
  const region = sectionRegion(section, definition);
  return section.content.entries
    .map((entry, index) => {
      let body = '';
      if ('school' in entry)
        body = `<header class="entry-heading"><strong>${escapeHtml(entry.school)}</strong><span>${escapeHtml(entry.major)} · ${escapeHtml(entry.degree)}</span><time>${formatDate(entry.startDate, entry.endDate, entry.isCurrent)}</time></header>${renderRichText(entry.description)}`;
      else if ('position' in entry)
        body = `<header class="entry-heading"><strong>${escapeHtml(entry.organization)}</strong><span>${escapeHtml(entry.position)}</span><time>${formatDate(entry.startDate, entry.endDate, entry.isCurrent)}</time></header>${renderRichText(entry.description)}`;
      else if ('technologies' in entry)
        body = `<header class="entry-heading"><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.role ?? '')}</span><time>${formatDate(entry.startDate, entry.endDate, entry.isCurrent)}</time></header>${renderRichText(entry.description)}`;
      else if ('awardedAt' in entry)
        body = `<header><strong>${escapeHtml(entry.name)}</strong><time>${escapeHtml(entry.awardedAt ?? '')}</time></header><div class="sub">${escapeHtml(entry.issuer ?? '')}</div>${renderRichText(entry.description)}`;
      else if ('proficiency' in entry) body = renderRichText(entry.description);
      else
        body = `<header><strong>${escapeHtml(entry.organization)}</strong><time>${formatDate(entry.startDate, entry.endDate, entry.isCurrent)}</time></header><div class="sub">${escapeHtml(entry.role)}</div>${renderRichText(entry.description)}`;
      return `<article class="resume-block entry ${section.type === 'skill' ? 'skill' : ''}" data-region="${region}">${index === 0 ? `<h2>${escapeHtml(section.title)}</h2>` : ''}${body}</article>`;
    })
    .join('');
}

function renderSection(
  section: ResumeSection,
  definition: TemplateDefinition,
  targetRole: string | null,
  avatarUrl?: string,
): string {
  if (!section.isVisible) return '';
  const region = sectionRegion(section, definition);
  if (section.type === 'basic') {
    const { fullName, email, phone, location, website } = section.content;
    return `<header class="resume-block identity" data-region="${region}"><div class="identity-main"><h1>${escapeHtml(fullName ?? '未命名')}</h1>${targetRole ? `<p class="target">求职意向 · ${escapeHtml(targetRole)}</p>` : ''}<p>${[
      email,
      phone,
      location,
      website,
    ]
      .filter(Boolean)
      .map((value) => escapeHtml(String(value)))
      .join(
        ' · ',
      )}</p></div>${avatarUrl ? `<img class="resume-avatar" src="${escapeHtml(avatarUrl)}" alt="个人头像">` : ''}</header>`;
  }
  if (section.type === 'target') return '';
  const entries = renderEntries(section, definition);
  if (entries) return entries;
  const body =
    section.type === 'summary' || section.type === 'custom'
      ? renderRichText(section.content.body)
      : '';
  return body
    ? `<section class="resume-block prose" data-region="${region}"><h2>${escapeHtml(section.title)}</h2>${body}</section>`
    : '';
}

function css(
  theme: ResumeTheme,
  definition: TemplateDefinition,
  mode: 'screen' | 'print',
  fontUrl?: string,
): string {
  const fontFace = fontUrl
    ? `@font-face{font-family:"Noto Sans SC";src:url("${escapeHtml(fontUrl)}") format("truetype");font-weight:100 900;font-display:block}`
    : '';
  return `${fontFace}@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}body{background:${mode === 'screen' ? '#dfe4eb' : '#fff'};color:#182338;font-family:"Noto Sans SC",sans-serif;font-size:${theme.fontSize}px;line-height:${theme.lineHeight}}#resume-source{display:none}.resume-pages{padding:${mode === 'screen' ? '18px 0' : '0'}}.page{width:210mm;height:297mm;margin:${mode === 'screen' ? '0 auto 18px' : '0'};padding:${theme.pageMargin.top}mm ${theme.pageMargin.right}mm ${theme.pageMargin.bottom}mm ${theme.pageMargin.left}mm;overflow:hidden;background:#fff;box-shadow:${mode === 'screen' ? '0 18px 60px rgba(19,32,61,.16)' : 'none'};break-after:page}.page:last-child{break-after:auto}.page-inner{display:grid;width:100%;height:100%;grid-template-columns:1fr;gap:10mm}.page-inner.two-column{grid-template-columns:31% minmax(0,1fr)}.region{min-width:0;min-height:0;overflow:hidden}.page-inner:not(.two-column) .sidebar{display:none}.resume-block{margin:0 0 ${theme.sectionGap}px;break-inside:avoid}.identity{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;border-bottom:2px solid ${theme.accentColor};padding-bottom:10px}.identity-main{min-width:0}.identity h1{margin:0;font-size:30px;line-height:1.12;letter-spacing:.05em}.identity p,.target{margin:${theme.paragraphGap}px 0;color:#536078}.target{font-weight:700;color:${theme.accentColor}}.resume-avatar{width:24mm;height:30mm;object-fit:cover;object-position:center;border-radius:3px}h2{margin:0 0 8px;border-bottom:1px solid #ccd3df;color:${theme.accentColor};font-size:14px;letter-spacing:.1em}.entry>h2{margin-bottom:10px}.entry header{display:flex;justify-content:space-between;gap:12px}.entry .entry-heading{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:baseline}.entry-heading>span{text-align:center}.entry-heading>time{justify-self:end}.entry strong{font-weight:750}time{white-space:nowrap;color:#647087}.sub{margin:2px 0;color:#59657a}p{margin:${theme.paragraphGap}px 0}ul,ol{margin:${theme.paragraphGap}px 0;padding-left:20px}a{color:${theme.accentColor}}.template-modern h2{border:0;border-left:5px solid ${theme.accentColor};padding-left:8px}.template-modern .identity{border-bottom-width:1px}.template-technical .identity{padding:14px;background:#102a43;color:#fff;border:0}.template-technical .identity p{color:#d5e6f0}.template-technical h2{padding:5px 8px;background:#e8f3f6;border:0}.template-campus .identity{padding:16px;background:#fff1e8;border:0}.template-campus h2{border-bottom:2px dotted ${theme.accentColor}}.template-academic{color:#202020}.template-academic .identity,.template-academic h2{border-color:#202020}.template-academic h2{color:#202020;text-transform:uppercase}.template-slate .sidebar{margin:${-theme.pageMargin.top}mm 0 ${-theme.pageMargin.bottom}mm ${-theme.pageMargin.left}mm;padding:${theme.pageMargin.top}mm 7mm ${theme.pageMargin.bottom}mm ${theme.pageMargin.left}mm;background:#e8eef3}.template-coral .sidebar{margin:${-theme.pageMargin.top}mm 0 ${-theme.pageMargin.bottom}mm ${-theme.pageMargin.left}mm;padding:${theme.pageMargin.top}mm 7mm ${theme.pageMargin.bottom}mm ${theme.pageMargin.left}mm;background:#fff0eb}.template-slate .sidebar .identity h1,.template-coral .sidebar .identity h1{font-size:24px}.template-slate .sidebar .entry header,.template-coral .sidebar .entry header{display:block}.template-compact{font-size:${Math.max(9, theme.fontSize - 1)}px}.template-compact .resume-block{margin-bottom:${Math.max(6, theme.sectionGap - 4)}px}.template-compact .identity h1{font-size:26px}.page-number{position:absolute;right:8mm;bottom:5mm;color:#98a1ae;font-size:7px}.page{position:relative}@media print{body{background:#fff}.resume-pages{padding:0}.page{margin:0;box-shadow:none}}`;
}

function paginationScript(definition: TemplateDefinition, instanceId: string): string {
  return `<script>(()=>{const start=async()=>{await document.fonts.ready;const source=document.querySelector('#resume-source');const output=document.querySelector('#resume-pages');const layout=${JSON.stringify(definition.layout)};const max=${definition.pagination.maximumPages};const pages=[];const positions={main:0,sidebar:0};const makePage=(index)=>{while(pages.length<=index){const page=document.createElement('section');page.className='page';page.innerHTML='<div class="page-inner '+(layout==='two-column'?'two-column':'')+'"><div class="region sidebar"></div><div class="region main"></div></div><span class="page-number">'+(pages.length+1)+'</span>';output.append(page);pages.push(page)}return pages[index]};for(const block of [...source.children]){const region=block.dataset.region||'main';let page=makePage(positions[region]);let target=page.querySelector('.'+region);target.append(block);if(target.scrollHeight>target.clientHeight&&target.children.length>1){block.remove();positions[region]++;page=makePage(positions[region]);target=page.querySelector('.'+region);target.append(block)}if(target.scrollHeight>target.clientHeight)block.dataset.overflow='true'}source.remove();const overflow=[...document.querySelectorAll('[data-overflow="true"]')].length;const blank=pages.filter((page)=>![...page.querySelectorAll('.region')].some((region)=>region.children.length)).length;const invalidLinks=[...document.querySelectorAll('a')].filter((link)=>!['http:','https:','mailto:'].includes(new URL(link.href).protocol)).length;const result={pageCount:pages.length,overflowCount:overflow,blankPageCount:blank,invalidLinkCount:invalidLinks,fontReady:document.fonts.check('12px "Noto Sans SC"'),exceedsRecommendedPages:pages.length>${definition.pagination.recommendedPages},exceedsMaximumPages:pages.length>max};window.__ACE_RESUME_RENDER__=result;document.documentElement.dataset.renderReady='true';document.documentElement.dataset.diagnostics=JSON.stringify(result);parent.postMessage({type:'ace-resume-render',instanceId:${JSON.stringify(instanceId)},diagnostics:result},'*')};void start()})()</script>`;
}

export type RenderDiagnostics = {
  pageCount: number;
  overflowCount: number;
  blankPageCount: number;
  invalidLinkCount: number;
  fontReady: boolean;
  exceedsRecommendedPages: boolean;
  exceedsMaximumPages: boolean;
};

export function renderResume(input: {
  resume: ResumeDocument;
  template?: TemplateDefinition;
  theme?: ResumeTheme;
  mode: 'screen' | 'print';
  fontUrl?: string;
  avatarUrl?: string;
  instanceId?: string;
}): string {
  const definition = input.template ?? getTemplateDefinition(input.resume.templateVersionId);
  if (!definition) throw new Error(`Unknown template version: ${input.resume.templateVersionId}`);
  const theme = input.theme ?? input.resume.theme;
  const target = input.resume.sections.find((section) => section.type === 'target');
  const targetRole = target?.type === 'target' ? target.content.role : null;
  const blocks = [...input.resume.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => renderSection(section, definition, targetRole, input.avatarUrl))
    .join('');
  return `<!doctype html><html lang="${input.resume.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css(theme, definition, input.mode, input.fontUrl)}</style></head><body class="template-${definition.visualStyle}" data-layout="${definition.layout}"><div id="resume-source">${blocks}</div><main id="resume-pages" class="resume-pages"></main>${paginationScript(definition, input.instanceId ?? 'server')}</body></html>`;
}

const text = (value: string): RichTextDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

export const SAMPLE_RESUME_DOCUMENT: ResumeDocument = {
  schemaVersion: 1,
  resumeId: '00000000-0000-4000-8000-000000000001',
  templateVersionId: 'classic-single-v1',
  locale: 'zh-CN',
  theme: DEFAULT_RESUME_THEME,
  sections: [
    {
      id: '00000000-0000-4000-8000-000000000011',
      type: 'basic',
      title: '基本信息',
      sortOrder: 0,
      isVisible: true,
      schemaVersion: 1,
      content: {
        fullName: '林知远',
        email: 'lin@example.test',
        phone: '138 0000 0000',
        location: '杭州',
        website: 'https://example.test',
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000012',
      type: 'target',
      title: '求职意向',
      sortOrder: 1,
      isVisible: true,
      schemaVersion: 1,
      content: { role: '前端开发工程师' },
    },
    {
      id: '00000000-0000-4000-8000-000000000013',
      type: 'education',
      title: '教育经历',
      sortOrder: 2,
      isVisible: true,
      schemaVersion: 1,
      content: {
        entries: [
          {
            id: '00000000-0000-4000-8000-000000000021',
            sortOrder: 0,
            school: '远山大学',
            major: '计算机科学与技术',
            degree: '本科',
            startDate: '2022-09',
            endDate: '2026-06',
            isCurrent: false,
            grade: '3.8 / 4.0',
            ranking: '前 10%',
            description: text('主修数据结构、计算机网络与软件工程。'),
          },
        ],
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000014',
      type: 'project',
      title: '项目经历',
      sortOrder: 3,
      isVisible: true,
      schemaVersion: 1,
      content: {
        entries: [
          {
            id: '00000000-0000-4000-8000-000000000022',
            sortOrder: 0,
            name: '校园活动管理平台',
            role: '前端负责人',
            technologies: ['Vue 3', 'TypeScript', 'Vite'],
            url: 'https://example.test',
            startDate: '2025-03',
            endDate: '2025-08',
            isCurrent: false,
            description: text('负责组件设计、性能优化与自动化测试，交付可复用的活动配置流程。'),
          },
        ],
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000015',
      type: 'skill',
      title: '专业技能',
      sortOrder: 4,
      isVisible: true,
      schemaVersion: 1,
      content: {
        entries: [
          {
            id: '00000000-0000-4000-8000-000000000023',
            sortOrder: 0,
            category: '开发',
            name: 'Vue / TypeScript / Node.js',
            proficiency: '熟练',
            description: text('注重类型安全、可访问性与可验证交付。'),
          },
        ],
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000016',
      type: 'summary',
      title: '自我评价',
      sortOrder: 5,
      isVisible: true,
      schemaVersion: 1,
      content: { body: text('善于把复杂需求拆解为清晰、可靠且可持续维护的产品能力。') },
    },
  ],
};
