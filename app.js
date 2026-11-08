/* داشبورد گزارش آنلاین وضعیت ریخته‌گری — داده‌ها از data.json خوانده می‌شوند. */
const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const COLORS = {
  paper: '#ffffff', ink: '#183a44', grid: '#d8e7e3', teal: '#176864', navy: '#153c48',
  countScale: [[0, '#2f9d72'], [0.45, '#e0b957'], [1, '#bd4854']],
  effectScale: [[0, '#bf4c55'], [0.48, '#e4b85a'], [1, '#3aa278']]
};
const TIMELINE_START = { year: 1404, month: 8 };
const state = { data: null, rows: [], filtered: [], options: {}, filters: {}, menuKeys: ['year','month','defect','group','part'] };

const $ = (selector) => document.querySelector(selector);
const safeText = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const normalize = (value) => String(value ?? '').trim();
const unique = (arr) => [...new Set(arr.filter(Boolean))];
const faNum = (value) => Number(value || 0).toLocaleString('fa-IR');
const parseDate = (date) => {
  const parts = normalize(date).split(/[\/-]/);
  return { year: parts[0] || '', month: parts[1] || '', day: parts[2] || '' };
};
const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number.parseFloat(String(value ?? '').replace('%','').replace(',','.'));
  return Number.isFinite(n) ? n : 0;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const latestFilledDate = (rows) => [...rows].reverse().find(row => normalize(row.date))?.date || '';
const parseYearMonth = (date) => {
  const parsed = parseDate(date);
  const year = Number(parsed.year);
  const month = Number(parsed.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month, source: `${year}/${String(month).padStart(2, '0')}`, index: year * 12 + month - 1 };
};
const monthLabel = (year, month) => `${MONTHS[month - 1]} ${String(year).slice(-2).padStart(2, '0')}`;
const formatMonthYear = (date) => {
  const parsed = parseYearMonth(date);
  if (!parsed) return 'ثبت نشده';
  return monthLabel(parsed.year, parsed.month);
};
const truncate = (value, length = 32) => {
  const text = safeText(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};
const escapeHTML = (value) => safeText(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function rowMonth(row) { return parseYearMonth(row.date)?.source || ''; }
function rowYear(row) { return parseDate(row.date).year; }
function displayValue(value) { return value || 'بدون مقدار'; }
function rowIsVisible(row) {
  const checks = {
    year: rowYear(row), month: rowMonth(row), defect: normalize(row.defect), group: normalize(row.group), part: normalize(row.part)
  };
  return state.menuKeys.every(key => state.filters[key].size === 0 || state.filters[key].has(checks[key]));
}

function makeOptions(rows) {
  const year = unique(rows.map(rowYear)).sort((a,b) => b.localeCompare(a, 'fa'));
  const availableMonths = rows.map(row => parseYearMonth(row.date)).filter(Boolean);
  const latest = availableMonths.reduce((current, item) => item.index > current.index ? item : current, { ...TIMELINE_START, index: TIMELINE_START.year * 12 + TIMELINE_START.month - 1 });
  const month = Array.from({ length: Math.max(0, latest.index - (TIMELINE_START.year * 12 + TIMELINE_START.month - 1) + 1) }, (_, offset) => {
    const index = TIMELINE_START.year * 12 + TIMELINE_START.month - 1 + offset;
    const year = Math.floor(index / 12);
    const monthNumber = (index % 12) + 1;
    return `${year}/${String(monthNumber).padStart(2, '0')}`;
  });
  const defect = unique(rows.map(row => normalize(row.defect))).sort((a,b) => a.localeCompare(b, 'fa'));
  const group = unique(rows.map(row => normalize(row.group))).sort((a,b) => a.localeCompare(b, 'fa'));
  const part = unique(rows.map(row => normalize(row.part))).sort((a,b) => a.localeCompare(b, 'fa'));
  return { year, month, defect, group, part };
}

function mountLogo(id, url, label) {
  const target = document.getElementById(id);
  if (!target || !url) return;
  target.innerHTML = '';
  const image = document.createElement('img');
  image.src = url;
  image.alt = label;
  image.addEventListener('error', () => {
    target.innerHTML = `<span class="logo-mark">${label.slice(0,1)}</span><span class="logo-caption">مسیر لوگو بررسی شود</span>`;
  });
  target.appendChild(image);
}

function setupFilter(key, values) {
  const wrapper = document.querySelector(`[data-filter="${key}"]`);
  const select = wrapper.querySelector('.multi-select');
  const menu = select.querySelector('.options-menu');
  state.filters[key] = new Set(values);
  const sortedValues = values;
  menu.innerHTML = '';
  const allLabel = document.createElement('label');
  allLabel.className = 'option-row option-all';
  allLabel.innerHTML = `<input type="checkbox" data-all="true" checked><span>انتخاب همه</span>`;
  menu.appendChild(allLabel);
  sortedValues.forEach(value => {
    const label = document.createElement('label');
    label.className = 'option-row';
    label.innerHTML = `<input type="checkbox" value="${escapeHTML(value)}" checked><span>${escapeHTML(key === 'month' ? formatMonthYear(value) : displayValue(value))}</span>`;
    menu.appendChild(label);
  });
  const triggerText = select.querySelector('.multi-select-trigger span:first-child');
  const updateTrigger = () => {
    const count = state.filters[key].size;
    triggerText.textContent = count === values.length ? 'همه موارد' : count === 0 ? 'هیچ موردی' : `${faNum(count)} مورد انتخاب شده`;
    const all = menu.querySelector('[data-all="true"]');
    all.checked = count === values.length;
    all.indeterminate = count > 0 && count < values.length;
  };
  updateTrigger();
  select.querySelector('.multi-select-trigger').addEventListener('click', event => {
    event.stopPropagation();
    document.querySelectorAll('.multi-select.open').forEach(other => { if (other !== select) other.classList.remove('open'); });
    select.classList.toggle('open');
  });
  menu.addEventListener('click', event => event.stopPropagation());
  menu.addEventListener('change', event => {
    if (event.target.dataset.all) {
      state.filters[key] = event.target.checked ? new Set(values) : new Set();
      menu.querySelectorAll('input:not([data-all])').forEach(input => { input.checked = event.target.checked; });
    } else {
      if (event.target.checked) state.filters[key].add(event.target.value);
      else state.filters[key].delete(event.target.value);
    }
    updateTrigger();
    updateDashboard();
  });
}

function setupFilters() {
  state.options = makeOptions(state.rows);
  state.menuKeys.forEach(key => setupFilter(key, state.options[key]));
  document.addEventListener('click', () => document.querySelectorAll('.multi-select.open').forEach(select => select.classList.remove('open')));
  $('#resetFilters').addEventListener('click', () => {
    state.menuKeys.forEach(key => {
      state.filters[key] = new Set(state.options[key]);
      const menu = document.querySelector(`[data-filter="${key}"] .options-menu`);
      menu.querySelectorAll('input').forEach(input => { input.checked = true; input.indeterminate = false; });
      const trigger = document.querySelector(`[data-filter="${key}"] .multi-select-trigger span:first-child`);
      trigger.textContent = 'همه موارد';
    });
    updateDashboard();
  });
}

function aggregate(rows, key) {
  const map = new Map();
  rows.forEach(row => {
    const name = normalize(row[key]) || 'بدون مقدار';
    if (!map.has(name)) map.set(name, { name, count: 0, effective: 0 });
    const item = map.get(name);
    item.count += 1;
    if (normalize(row.effectiveness) === 'اثربخش') item.effective += 1;
  });
  return [...map.values()].map(item => ({ ...item, effectiveness: item.count ? item.effective / item.count : 0 }));
}

function treemap(targetId, data, mode) {
  const sorted = [...data].sort((a,b) => b[mode === 'count' ? 'count' : 'effectiveness'] - a[mode === 'count' ? 'count' : 'effectiveness']);
  if (!sorted.length) return emptyChart(targetId, 'داده‌ای برای نمایش وجود ندارد');
  const values = sorted.map(item => mode === 'count' ? item.count : item.effectiveness * 100);
  const labels = sorted.map(item => truncate(item.name, 27));
  const fullNames = sorted.map(item => item.name);
  const trace = {
    type: 'treemap', labels, parents: labels.map(() => ''), values: sorted.map(item => item.count),
    customdata: sorted.map((item, index) => [fullNames[index], item.count, item.effectiveness]),
    marker: { colors: values, colorscale: mode === 'count' ? COLORS.countScale : COLORS.effectScale, cmin: Math.min(...values), cmax: Math.max(...values), showscale: true, colorbar: { title: mode === 'count' ? 'تعداد' : 'درصد', ticksuffix: mode === 'count' ? '' : '%' } },
    textinfo: 'none', texttemplate: '<b>%{label}</b><br><b>%{value}</b>', textposition: 'middle center', textfont: { family: 'SiteText, Times New Roman', size: 15 }, insidetextfont: { family: 'SiteText, Times New Roman', size: 15, color: '#ffffff' }, hovertemplate: '<b>%{customdata[0]}</b><br>تعداد: %{customdata[1]}<br>اثربخشی: %{customdata[2]:.1%}<extra></extra>', tiling: { pad: 4 }, pathbar: { visible: false }
  };
  drawPlot(targetId, [trace], { margin: { t: 8, r: 8, b: 8, l: 8 }, coloraxis: undefined });
}

function barChart(targetId, data, metric, colorMode) {
  const sorted = [...data].sort((a,b) => b[metric] - a[metric]);
  if (!sorted.length) return emptyChart(targetId, 'داده‌ای برای نمایش وجود ندارد');
  const maxItems = 30;
  const view = sorted.slice(0, maxItems).reverse();
  const values = view.map(item => metric === 'effectiveness' ? item.effectiveness * 100 : item.count);
  const colors = values;
  const trace = {
    type: 'bar', orientation: 'h', x: values, y: view.map(item => truncate(item.name, 42)),
    customdata: view.map(item => [item.name, item.count, item.effectiveness]),
    marker: { color: colors, colorscale: colorMode === 'effect' ? COLORS.effectScale : COLORS.countScale, cmin: Math.min(...values), cmax: Math.max(...values), line: { width: 0 } },
    hovertemplate: '<b>%{customdata[0]}</b><br>تعداد: %{customdata[1]}<br>اثربخشی: %{customdata[2]:.1%}<extra></extra>'
  };
  const xTitle = metric === 'effectiveness' ? 'درصد اثربخشی' : 'تعداد تکرار مشکل';
  drawPlot(targetId, [trace], { margin: { t: 8, r: 8, b: 48, l: 170 }, xaxis: { title: xTitle, ticksuffix: metric === 'effectiveness' ? '%' : '', gridcolor: COLORS.grid, rangemode: 'tozero' }, yaxis: { automargin: true, gridcolor: 'transparent' }, showlegend: false });
}

function monthlyChart(rows) {
  const yearFilterRestricted = state.filters.year && state.filters.year.size < state.options.year.length;
  const monthFilterRestricted = state.filters.month && state.filters.month.size < state.options.month.length;
  const dateFilterRestricted = yearFilterRestricted || monthFilterRestricted;
  const timelineRows = dateFilterRestricted ? rows : state.rows;
  const availableMonths = timelineRows.map(row => parseYearMonth(row.date)).filter(Boolean);
  const timelineIndexes = dateFilterRestricted
    ? [...new Set(availableMonths.map(item => item.index))].sort((a, b) => a - b)
    : (() => {
        const latest = availableMonths.reduce((current, item) => item.index > current.index ? item : current, { ...TIMELINE_START, index: TIMELINE_START.year * 12 + TIMELINE_START.month - 1 });
        return Array.from({ length: Math.max(0, latest.index - (TIMELINE_START.year * 12 + TIMELINE_START.month - 1) + 1) }, (_, offset) => TIMELINE_START.year * 12 + TIMELINE_START.month - 1 + offset);
      })();
  if (!timelineIndexes.length) return emptyChart('monthlyChart', 'داده‌ای برای نمایش روند وجود ندارد');
  const timeline = timelineIndexes.map(index => {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return { index, source: `${year}/${String(month).padStart(2, '0')}`, label: monthLabel(year, month) };
  });
  const counts = timeline.map(point => rows.reduce((total, row) => total + (parseYearMonth(row.date)?.index === point.index ? 1 : 0), 0));
  const trendDenominator = timeline.map((_, index) => index * index).reduce((sum, value) => sum + value, 0) || 1;
  const trendSlope = counts.reduce((sum, value, index) => sum + index * value, 0) / trendDenominator;
  const trace = { type:'scatter', mode:'lines+markers', x: timeline.map(point => point.label), y: counts, customdata: timeline.map(point => [point.source, point.label]), line:{color:'#176864',width:3}, marker:{color:'#176864',size:7}, name:'تعداد مشکل', hovertemplate:'<b>%{customdata[1]}</b><br>مقدار ستون B: %{customdata[0]}<br>تعداد مشکل: %{y}<extra></extra>' };
  const trend = { type:'scatter', mode:'lines', x: timeline.map(point => point.label), y: counts.map((_, index) => trendSlope * index), line:{color:'#bd4854',width:2,dash:'dash'}, name:'روند تعداد مشکلات', hovertemplate:'%{x}<br>روند: %{y:.1f}<extra></extra>' };
  const labels = timeline.map(point => point.label);
  drawPlot('monthlyChart', [trace, trend], { margin:{t:12,r:12,b:92,l:50}, xaxis:{title:'ماه گزارش', type:'category', tickmode:'array', tickvals:labels, ticktext:labels, automargin:true, gridcolor:'transparent', tickangle:-35}, yaxis:{title:'تعداد مشکل', gridcolor:COLORS.grid, rangemode:'tozero'}, legend:{orientation:'h',y:1.12,x:1,xanchor:'right'}, showlegend:true });
}

function emptyChart(targetId, message) {
  const target = document.getElementById(targetId);
  if (target) target.innerHTML = `<div class="empty-chart">${escapeHTML(message)}</div>`;
}
function drawPlot(targetId, traces, layout) {
  if (!window.Plotly) return emptyChart(targetId, 'کتابخانه نمودار بارگذاری نشد');
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = '';
  Plotly.newPlot(target, traces, { ...layout, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'SiteText, Times New Roman', color: COLORS.ink, size: 13 }, hoverlabel: { bgcolor: '#163c47', font: { family:'SiteText, Times New Roman', color:'#fff' } }, uniformtext: { minsize: 10, mode: 'show' } }, { responsive:true, displaylogo:false, modeBarButtonsToRemove:['lasso2d','select2d'] });
}

function renderMetrics(rows) {
  const effective = rows.filter(row => normalize(row.effectiveness) === 'اثربخش').length;
  const effectRate = rows.length ? effective / rows.length : 0;
  const defects = unique(rows.map(row => normalize(row.defect))).length;
  const groups = unique(rows.map(row => normalize(row.group))).length;
  $('#metricGrid').innerHTML = [
    ['گزارش‌های قابل مشاهده', faNum(rows.length), 'بر پایه فیلترهای فعال'],
    ['اثربخشی ثبت‌شده', `${(effectRate * 100).toLocaleString('fa-IR',{maximumFractionDigits:1})}%`, `${faNum(effective)} گزارش اثربخش`],
    ['گروه‌های محصول', faNum(groups), 'در محدوده فیلترشده'],
    ['انواع عیب ریخته‌گری', faNum(defects), 'در محدوده فیلترشده']
  ].map(([label,value,detail]) => `<article class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-detail">${detail}</div></article>`).join('');
}

function renderUpdateDate(rows) {
  const target = $('#dataUpdatedAt');
  if (!target) return;
  const date = latestFilledDate(rows);
  target.textContent = `آخرین به‌روزرسانی داده‌ها: ${date ? formatMonthYear(date) : 'ثبت نشده'}`;
}

function renderTable(rows) {
  const ordered = [...rows].sort((a,b) => (Number(b.row)||0) - (Number(a.row)||0));
  $('#tableCount').textContent = `نمایش ${faNum(ordered.length)} ردیف · مرتب‌سازی از شماره آخر به اول`;
  $('#reportsTable tbody').innerHTML = ordered.map(row => `<tr>
    <td>${escapeHTML(row.row)}</td><td>${escapeHTML(row.date)}</td><td>${escapeHTML(row.defect)}</td><td>${escapeHTML(row.group)}</td><td>${escapeHTML(row.part)}</td><td>${escapeHTML(row.description)}</td><td>${escapeHTML(row.effectiveness)}</td><td>${escapeHTML(row.supplierNotes)}</td>
  </tr>`).join('');
}

function updateDashboard() {
  state.filtered = state.rows.filter(rowIsVisible);
  const groupData = aggregate(state.filtered, 'group');
  const defectData = aggregate(state.filtered, 'defect');
  const partData = aggregate(state.filtered, 'part');
  renderMetrics(state.filtered);
  treemap('groupCountChart', groupData, 'count');
  treemap('groupEffectChart', groupData, 'effectiveness');
  treemap('defectCountChart', defectData, 'count');
  treemap('defectEffectChart', defectData, 'effectiveness');
  barChart('partCountChart', partData, 'count', 'count');
  barChart('partEffectChart', partData, 'effectiveness', 'effect');
  monthlyChart(state.filtered);
  renderTable(state.filtered);
  $('#filterStatus').textContent = `${faNum(state.filtered.length)} گزارش از ${faNum(state.rows.length)} گزارش`;
}

function downloadJSON() {
  const payload = { ...state.data, rows: state.filtered, filteredAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = 'گزارش-فیلترشده.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function init() {
  try {
    const response = await fetch(`data.json?v=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error('data.json not found');
    state.data = await response.json();
    state.rows = Array.isArray(state.data.rows) ? state.data.rows : [];
    renderUpdateDate(state.rows);
    setupFilters();
    updateDashboard();
    $('#downloadFiltered').addEventListener('click', downloadJSON);
    const logos = window.DASHBOARD_LOGOS || {};
    mountLogo('pouyaLogo', logos.pouyanovin, 'لوگوی پویانوین');
    mountLogo('ezamLogo', logos.ezam, 'لوگوی عظام');
  } catch (error) {
    $('#filterStatus').textContent = 'خطا در خواندن داده';
    document.querySelector('main').innerHTML = `<section class="filters-panel"><h2>داده‌ها بارگذاری نشد</h2><p>فایل <code>data.json</code> در کنار داشبورد قرار نگرفته است.</p><p class="section-note">${escapeHTML(error.message)}</p></section>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
