import { decorateIcons, el, icon } from '../../lib/ui.mjs';
import {
  todayInKorea, dateBounds, isSelectableDate, moveDate, weekForDate,
  mealsForDate, groupTimetable, createWeekLoader,
} from './school-core.mjs';

decorateIcons();
const $ = selector => document.querySelector(selector);
const loader = createWeekLoader();
const mobile = window.matchMedia('(max-width: 800px)');
const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
let selectedDate = todayInKorea();
let viewGeneration = 0;

function dateObject(date) { return new Date(`${date}T00:00:00.000Z`); }
function shortDate(date) {
  const parsed = dateObject(date);
  return `${parsed.getUTCMonth() + 1}월 ${parsed.getUTCDate()}일`;
}
function weekday(date) { return weekdayNames[dateObject(date).getUTCDay()]; }
function fullDate(date) { return `${shortDate(date)} ${weekday(date)}요일`; }
function isWeekend(date) { return [0, 6].includes(dateObject(date).getUTCDay()); }
function weekRange(date) {
  const dates = weekForDate(date).dates;
  return `${shortDate(dates[0])} – ${shortDate(dates[4])}`;
}
function text(value) { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }

function setDateLabels() {
  const today = todayInKorea();
  const bounds = dateBounds();
  $('#date-context').textContent = selectedDate === today ? '오늘' : '선택한 날짜';
  $('#selected-date').textContent = fullDate(selectedDate);
  $('#school-date').value = selectedDate;
  $('#school-date').min = bounds.min;
  $('#school-date').max = bounds.max;
  $('#previous-date').disabled = selectedDate <= bounds.min;
  $('#next-date').disabled = selectedDate >= bounds.max;
  $('#today-date').disabled = selectedDate === today;
  $('#meal-date').textContent = `${shortDate(selectedDate)} (${weekday(selectedDate)})`;
  $('#week-range').textContent = weekRange(selectedDate);
}

function stateView({ title, description, kind = 'empty', retry = false, global = false }) {
  const state = el('div', `school-state is-${kind}`);
  const mark = el('span', 'state-icon');
  mark.setAttribute('aria-hidden', 'true');
  mark.append(icon(kind === 'loading' || kind === 'error' ? 'refresh' : 'book'));
  const heading = el(global ? 'h2' : 'h3', '', title);
  if (global) heading.id = 'global-state-title';
  state.append(mark, heading, el('p', '', description));
  if (retry) {
    const button = el('button', 'button secondary', '다시 확인');
    button.type = 'button';
    button.prepend(icon('refresh'));
    button.addEventListener('click', () => loadSelectedDate(true));
    state.append(button);
  }
  return state;
}

function setBusy(busy) {
  $('#meals-panel').setAttribute('aria-busy', String(busy));
  $('#timetable-panel').setAttribute('aria-busy', String(busy));
}

function showLoading() {
  $('#global-state').hidden = true;
  $('#school-content').hidden = false;
  setBusy(true);
  $('#data-status').textContent = '학교 자료를 불러오고 있어요.';
  $('#data-status').classList.remove('has-error');
  $('#meals-body').replaceChildren(stateView({
    title: '급식을 불러오고 있어요', description: `${fullDate(selectedDate)}의 메뉴를 확인하고 있어요.`, kind: 'loading',
  }));
  $('#timetable-body').replaceChildren(stateView({
    title: '시간표를 불러오고 있어요', description: '우리 반의 월요일부터 금요일까지 수업을 확인하고 있어요.', kind: 'loading',
  }));
}

function renderMeals(data) {
  const target = $('#meals-body');
  target.replaceChildren();
  if (data.status === 'error') {
    target.append(stateView({ title: '급식을 불러오지 못했어요', description: '잠시 후 다시 확인해 주세요.', kind: 'error', retry: true }));
    return;
  }
  const meals = mealsForDate(data.rows, selectedDate);
  if (!meals.length) {
    target.append(stateView({
      title: '등록된 급식이 없어요',
      description: isWeekend(selectedDate)
        ? '선택한 날짜는 주말이에요. 학교에서 등록한 급식이 있으면 여기에 표시돼요.'
        : '휴업일·방학이거나 학교에서 급식을 아직 등록하지 않았을 수 있어요.',
    }));
    return;
  }
  for (const meal of meals) {
    const card = el('section', 'meal-card');
    const heading = el('div', 'meal-card-heading');
    heading.append(el('h3', '', text(meal.typeName) || '급식'));
    if (text(meal.calories)) heading.append(el('p', 'meal-calories', `열량 ${text(meal.calories)}`));
    card.append(heading);
    if (meal.dishes.length) {
      const dishes = el('ul', 'meal-dishes');
      for (const dish of meal.dishes) dishes.append(el('li', '', text(dish)));
      card.append(dishes);
    } else card.append(el('p', 'timetable-note', '등록된 메뉴가 없어요.'));
    target.append(card);
  }
  target.append(el('p', 'allergy-note', '메뉴의 괄호 안 숫자는 나이스에 등록된 알레르기 표시예요.'));
}

function lessonView(lesson, parallel = false) {
  const item = el('li');
  item.append(el('strong', 'timetable-subject', text(lesson.subject) || '과목 미등록'));
  const details = [
    [lesson.course, '계열'], [lesson.department, '학과'], [lesson.classroom, '강의실'],
  ];
  for (const [value, label] of details) {
    const ordinary = label === '계열' && value === '일반계'
      || label === '학과' && ['일반과', '일반학과'].includes(value)
      || label === '강의실' && value === '8';
    if (text(value) && (parallel || !ordinary)) item.append(el('span', 'timetable-detail', `${label} ${text(value)}`));
  }
  return item;
}

function renderTimetable(data, week) {
  const target = $('#timetable-body');
  target.replaceChildren();
  if (data.status === 'error') {
    target.append(stateView({ title: '시간표를 불러오지 못했어요', description: '잠시 후 다시 확인해 주세요.', kind: 'error', retry: true }));
    return;
  }
  if (isWeekend(selectedDate)) target.append(el('p', 'weekend-note', '선택한 날짜는 주말이에요. 시간표는 월요일부터 금요일까지 보여 드려요.'));
  const grouped = groupTimetable(data.rows, week.dates.slice(0, 5));
  if (!grouped.periods.length) {
    target.append(stateView({ title: '이번 주에 등록된 시간표가 없어요', description: '방학·휴업 기간이거나 학교에서 시간표를 아직 등록하지 않았을 수 있어요.' }));
    return;
  }
  const scroll = el('div', 'timetable-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', '우리 반 주간 시간표. 좌우로 스크롤할 수 있어요.');
  scroll.setAttribute('aria-describedby', 'timetable-scroll-hint');
  const table = el('table', 'weekly-table');
  table.append(el('caption', 'sr-only', `한솔고등학교 2학년 8반 ${weekRange(selectedDate)} 시간표`));
  const thead = el('thead');
  const header = el('tr');
  const corner = el('th', 'period-column', '교시');
  corner.scope = 'col';
  header.append(corner);
  for (const day of grouped.days) {
    const selected = day.date === selectedDate;
    const today = day.date === todayInKorea();
    const th = el('th', selected ? 'is-selected' : '');
    th.scope = 'col';
    const button = el('button', 'table-date-button');
    button.type = 'button';
    button.disabled = !isSelectableDate(day.date);
    button.setAttribute('aria-label', `${fullDate(day.date)} 선택`);
    button.setAttribute('aria-pressed', String(selected));
    button.append(el('span', '', weekday(day.date)));
    const date = el('time', 'table-date', `${dateObject(day.date).getUTCMonth() + 1}.${dateObject(day.date).getUTCDate()}`);
    date.dateTime = day.date;
    button.append(date, el('span', 'table-day-status', selected ? '선택' : today ? '오늘' : ''));
    button.addEventListener('click', () => selectDate(day.date));
    th.append(button);
    header.append(th);
  }
  thead.append(header);
  table.append(thead);
  const tbody = el('tbody');
  for (const period of grouped.periods) {
    const row = el('tr');
    const label = el('th', '', `${period}교시`);
    label.scope = 'row';
    row.append(label);
    for (const day of grouped.days) {
      const cell = el('td', day.date === selectedDate ? 'is-selected' : '');
      const lessons = day.cells.get(period);
      if (lessons.length) {
        const list = el('ul', 'timetable-entries');
        for (const lesson of lessons) list.append(lessonView(lesson, lessons.length > 1));
        cell.append(list);
      } else {
        const empty = el('span', 'empty-lesson', '—');
        empty.setAttribute('aria-label', '등록된 수업 없음');
        cell.append(empty);
      }
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(tbody);
  scroll.append(table);
  const hint = el('p', 'timetable-note', '시간표를 좌우로 움직이면 한 주를 모두 볼 수 있어요. — 등록된 수업 없음');
  hint.id = 'timetable-scroll-hint';
  target.append(scroll, hint);
}

function updatedLabel(updatedAt) {
  const parsed = new Date(updatedAt);
  if (!Number.isFinite(parsed.getTime())) return '학교에서 등록한 자료예요.';
  const label = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul',
  }).format(parsed);
  return `${label} 확인`;
}

function showData(data) {
  setBusy(false);
  renderMeals(data.meals);
  renderTimetable(data.timetable, data.week);
  const partial = data.meals.status === 'error' || data.timetable.status === 'error';
  $('#data-status').textContent = partial ? '일부 자료를 불러오지 못했어요.' : updatedLabel(data.updatedAt);
  $('#data-status').classList.toggle('has-error', partial);
  $('#school-announcement').textContent = partial
    ? `${fullDate(selectedDate)}. 일부 자료를 불러오지 못했습니다. 각 항목에서 다시 확인할 수 있어요.`
    : `${fullDate(selectedDate)} 급식과 ${weekRange(selectedDate)} 시간표를 확인했습니다.`;
}

function showError(code) {
  setBusy(false);
  const preparing = code === 'NOT_CONFIGURED';
  $('#school-content').hidden = true;
  $('#global-state').hidden = false;
  $('#global-state').replaceChildren(stateView({
    title: preparing ? '학교 데이터 연결을 준비하고 있어요' : '학교 자료를 불러오지 못했어요',
    description: preparing
      ? '준비가 끝나면 여기에서 우리 반 급식과 시간표를 바로 볼 수 있어요.'
      : '인터넷 연결을 확인한 뒤 잠시 후 다시 시도해 주세요.',
    kind: preparing ? 'empty' : 'error', retry: true, global: true,
  }));
  $('#data-status').textContent = preparing ? '연결 준비 중' : '자료를 다시 확인해 주세요.';
  $('#data-status').classList.toggle('has-error', !preparing);
  $('#school-announcement').textContent = preparing ? '학교 데이터 연결을 준비하고 있어요.' : '학교 자료를 불러오지 못했습니다. 다시 확인해 주세요.';
}

async function loadSelectedDate(force = false) {
  const generation = ++viewGeneration;
  const date = selectedDate;
  showLoading();
  const result = await loader.load(date, { force });
  if (generation !== viewGeneration || result.kind === 'stale') return;
  if (result.kind === 'ready') showData(result.data);
  else showError(result.code);
}

function selectDate(date) {
  if (!isSelectableDate(date)) {
    const bounds = dateBounds();
    $('#date-error').textContent = `${bounds.min.slice(0, 4)}년부터 ${bounds.max.slice(0, 4)}년까지의 올바른 날짜를 선택해 주세요.`;
    $('#school-date').setAttribute('aria-invalid', 'true');
    return;
  }
  selectedDate = date;
  $('#date-error').textContent = '';
  $('#school-date').removeAttribute('aria-invalid');
  setDateLabels();
  loadSelectedDate();
}

function setTab(name) {
  $('#school-content').dataset.mobileView = name;
  for (const tab of ['meals', 'timetable']) {
    const active = tab === name;
    $(`#${tab}-tab`).setAttribute('aria-selected', String(active));
    $(`#${tab}-tab`).tabIndex = active ? 0 : -1;
  }
}

function syncPanelSemantics() {
  for (const name of ['meals', 'timetable']) {
    const panel = $(`#${name}-panel`);
    panel.setAttribute('aria-labelledby', `${name}-${mobile.matches ? 'tab' : 'title'}`);
    if (mobile.matches) {
      panel.setAttribute('role', 'tabpanel');
      panel.tabIndex = 0;
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('tabindex');
    }
  }
}

$('#school-date').addEventListener('change', event => selectDate(event.target.value));
$('#previous-date').addEventListener('click', () => selectDate(moveDate(selectedDate, -1)));
$('#next-date').addEventListener('click', () => selectDate(moveDate(selectedDate, 1)));
$('#today-date').addEventListener('click', () => selectDate(todayInKorea()));
for (const name of ['meals', 'timetable']) {
  const tab = $(`#${name}-tab`);
  tab.addEventListener('click', () => setTab(name));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'meals' : event.key === 'End' ? 'timetable' : name === 'meals' ? 'timetable' : 'meals';
    setTab(next);
    $(`#${next}-tab`).focus();
  });
}
mobile.addEventListener('change', syncPanelSemantics);
syncPanelSemantics();
setDateLabels();
loadSelectedDate();
