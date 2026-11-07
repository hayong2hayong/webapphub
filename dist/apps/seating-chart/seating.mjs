import { parseExcluded } from '../../lib/core.mjs';
import { decorateIcons, el, notify } from '../../lib/ui.mjs';
import { validateSeatingOptions, createSeatingChart } from './seating-core.mjs';

decorateIcons();
const $ = selector => document.querySelector(selector);
const settings = $('#seating-settings');
const seatDialog = $('#seat-dialog');
let layout = { rows: 5, columns: 6, blocked: [], fixed: [] };
let lastResult = null;
let lastKey = null;
let mode = 'edit';
let round = 0;
let selectedSeat = null;

function readInteger(id, min, max, label) {
  const value = Number($(`#${id}`).value);
  if (!Number.isInteger(value) || value < min || value > max) {
    const error = new Error(`${label}은(는) ${min}~${max} 사이의 정수로 입력해 주세요.`);
    error.fieldId = id;
    throw error;
  }
  return value;
}

function readStudents() {
  const studentCount = readInteger('student-count', 1, 30, '학생 수');
  try {
    return { studentCount, excluded: parseExcluded($('#excluded').value, 1, studentCount) };
  } catch (error) {
    error.fieldId = 'excluded';
    throw error;
  }
}

function readDraft() {
  return validateSeatingOptions({
    ...readStudents(), rows: 5, columns: 6,
    blocked: [...layout.blocked], fixed: layout.fixed.map(item => ({ ...item }))
  });
}

function optionsKey(options) {
  return JSON.stringify([
    options.studentCount,
    [...options.excluded].sort((a, b) => a - b),
    [...options.blocked].sort((a, b) => a - b),
    [...options.fixed].sort((a, b) => a.seat - b.seat).map(item => [item.seat, item.number])
  ]);
}

function draftMatchesResult() {
  if (!lastResult) return false;
  try { return optionsKey(readDraft()) === lastKey; }
  catch { return false; }
}

function clearError() {
  $('#seating-error').textContent = '';
  settings.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
}

function showError(error) {
  $('#seating-error').textContent = error.message;
  if (error.fieldId && settings.contains($(`#${error.fieldId}`))) $(`#${error.fieldId}`).setAttribute('aria-invalid', 'true');
}

function announce(message) { $('#seating-announcement').textContent = message; }

function coordinate(index) {
  const column = index % 6;
  return `${Math.floor(column / 2) + 1}분단 ${Math.floor(index / 6) + 1}행 ${column % 2 === 0 ? '왼쪽' : '오른쪽'}`;
}

function seatNumber(number) {
  const label = el('span', 'seat-number', String(number));
  label.append(el('span', 'seat-unit', '번'));
  return label;
}

function makeSeat(chart, index, editing, blocked, fixed) {
  const empty = blocked.has(index);
  const fixedNumber = fixed.get(index);
  const number = editing ? fixedNumber : chart.cells[index];
  const seat = el(editing ? 'button' : 'div', 'seat');
  seat.classList.toggle('is-designated-empty', empty);
  seat.classList.toggle('is-fixed', fixedNumber !== undefined);
  if (editing) {
    seat.type = 'button';
    seat.dataset.seat = String(index);
    seat.setAttribute('aria-haspopup', 'dialog');
    seat.setAttribute('aria-controls', 'seat-dialog');
    const state = empty ? '빈자리 지정' : fixedNumber !== undefined ? `${fixedNumber}번 고정` : '자동 배정';
    seat.setAttribute('aria-label', `${coordinate(index)}, ${state}. 좌석 설정 열기`);
  } else seat.append(el('span', 'sr-only', `${coordinate(index)}, `));
  if (empty || (!editing && number === null)) {
    seat.classList.add('is-empty');
    const mark = el('span', 'seat-number', '—');
    mark.setAttribute('aria-hidden', 'true');
    seat.append(mark, el('span', 'seat-state', empty ? '빈자리 지정' : '빈자리'));
  } else if (number !== undefined && number !== null) {
    seat.classList.add('is-assigned');
    seat.append(seatNumber(number));
    if (fixedNumber !== undefined) seat.append(el('span', 'seat-state fixed-label', '고정'));
  } else seat.append(el('span', 'seat-number auto-label', '자동'), el('span', 'seat-state', '배정'));
  return seat;
}

function makeBoard(chart, editing = false) {
  const canvas = el('div', 'board-canvas');
  const front = el('div', 'chalkboard', '칠판');
  front.append(el('span', '', '· 교실 앞'));
  const grid = el('div', 'paired-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', '짝꿍 3분단, 5행, 총 30자리');
  const labels = el('div', 'row-labels');
  labels.setAttribute('aria-hidden', 'true');
  labels.append(el('span', 'grid-axis'));
  for (let row = 1; row <= 5; row++) labels.append(el('span', 'grid-axis', `${row}행`));
  grid.append(labels);
  const blocked = new Set(chart.blocked);
  const fixed = new Map(chart.fixed.map(item => [item.seat, item.number]));
  for (let section = 0; section < 3; section++) {
    const group = el('section', 'seat-section');
    group.setAttribute('aria-label', `${section + 1}분단`);
    const title = el('h3', 'section-title', `${section + 1}분단`);
    const pair = el('div', 'pair-grid');
    for (let row = 0; row < 5; row++) {
      for (let side = 0; side < 2; side++) pair.append(makeSeat(chart, row * 6 + section * 2 + side, editing, blocked, fixed));
    }
    group.append(title, pair);
    grid.append(group);
  }
  canvas.append(front, grid);
  return canvas;
}

function renderBoard(focusSeat) {
  const editing = mode === 'edit';
  const chart = editing ? layout : lastResult;
  $('#board-canvas').replaceChildren(...makeBoard(chart, editing).childNodes);
  $('#board-scroll').setAttribute('aria-label', `3분단 ${editing ? '자리 편집' : '배정 결과'}. 좁은 화면에서는 좌우로 스크롤할 수 있습니다.`);
  $('#board-title').textContent = editing ? '고정석과 빈자리를 정해요' : '우리 반 자리표';
  $('#board-description').textContent = editing
    ? '좌석을 누르면 자동 배정, 빈자리, 번호 고정을 선택할 수 있어요.'
    : '고정 번호는 다시 섞어도 같은 자리에 앉아요. 나머지 번호만 새로 배정해요.';
  $('#board-summary').textContent = editing
    ? `3분단 × 5행 · 고정석 ${chart.fixed.length}개 · 지정 빈자리 ${chart.blocked.length}개`
    : `${chart.assignedCount}명 배정 · 고정석 ${chart.fixed.length}개 · 빈자리 ${chart.cells.length - chart.assignedCount}개`;
  $('#keyboard-hint').hidden = !editing;
  const legend = $('#seat-legend');
  legend.replaceChildren();
  const entries = editing
    ? [['', '', '자동 배정'], ['is-fixed', '고', '번호 고정'], ['is-designated-empty', '—', '지정 빈자리']]
    : [['', '7', '배정 번호'], ['is-fixed', '고', '번호 고정'], ['is-empty', '—', '빈자리'], ['is-designated-empty', '—', '지정 빈자리']];
  for (const [className, mark, label] of entries) {
    const entry = el('span', 'legend-item');
    const swatch = el('span', `legend-mark ${className}`, mark);
    swatch.setAttribute('aria-hidden', 'true');
    entry.append(swatch, document.createTextNode(label));
    legend.append(entry);
  }
  if (focusSeat !== undefined) $(`[data-seat="${focusSeat}"]`)?.focus({ preventScroll: true });
}

function updateState() {
  const applied = draftMatchesResult();
  try {
    const options = readDraft();
    $('#draft-summary').textContent = `배정 대상 ${options.studentCount - options.excluded.length}명 · 고정석 ${options.fixed.length}개 · 지정 빈자리 ${options.blocked.length}개`;
  } catch {
    $('#draft-summary').textContent = '학생 수·제외 번호·고정석 설정을 확인해 주세요.';
  }
  $('#edit-mode').setAttribute('aria-pressed', String(mode === 'edit'));
  $('#result-mode').setAttribute('aria-pressed', String(mode === 'result'));
  $('#result-mode').disabled = !lastResult;
  $('#board-badge').textContent = !lastResult ? '배정 전' : applied ? `${round}회차 배정` : '설정 미적용';
  $('#assign-label').textContent = lastResult && !applied ? '새 설정으로 배정' : '자리 배정하기';
  $('#draft-notice').hidden = !lastResult || applied;
  $('#draft-notice').textContent = mode === 'result'
    ? '설정이 바뀌었어요. 지금 보이는 번호는 이전 배정 결과예요. 새 설정으로 배정해 주세요.'
    : '설정이 바뀌었어요. 이전 번호는 ‘배정 결과’에서 볼 수 있어요. 편집을 마치면 새 설정으로 배정해 주세요.';
  $('#print').disabled = !applied;
  $('#shuffle').disabled = !applied;
  $('#print-hint').textContent = !lastResult
    ? '자리를 배정하면 인쇄할 수 있어요.'
    : !applied ? '현재 설정으로 다시 배정한 뒤 인쇄할 수 있어요.' : '인쇄 창에서 ‘PDF로 저장’을 선택할 수 있어요.';
  document.body.classList.toggle('print-ready', applied && !seatDialog.open);
}

function renderPrint() {
  const sheet = $('#seating-print');
  sheet.replaceChildren();
  sheet.append(el('h1', '', '우리 반 자리 배정표'));
  sheet.append(el('p', 'print-summary', `짝꿍 3분단 × 5행 · ${lastResult.assignedCount}명 배정 · 고정석 ${lastResult.fixed.length}개 · ${round}회차`));
  sheet.append(makeBoard(lastResult));
  sheet.append(el('p', 'print-note', '고정: 다시 섞어도 같은 번호가 앉는 자리 · 빈자리 지정: 미리 비워 둔 자리 · 빈자리: 배정 후 남은 자리'));
}

function assign() {
  clearError();
  try {
    const options = readDraft();
    // Commit only after validation and assignment succeed, preserving the previous result on errors.
    const nextResult = createSeatingChart(options);
    lastResult = nextResult;
    lastKey = optionsKey(options);
    round++;
    mode = 'result';
    renderBoard();
    renderPrint();
    updateState();
    announce(`${round}회차, ${nextResult.assignedCount}명의 자리를 배정했습니다. 고정석 ${nextResult.fixed.length}개이며 칠판은 위쪽입니다.`);
  } catch (error) { showError(error); updateState(); }
}

settings.addEventListener('submit', event => { event.preventDefault(); assign(); });
settings.addEventListener('input', () => {
  clearError();
  if (layout.fixed.length) {
    try { readDraft(); } catch (error) { showError(error); }
  }
  updateState();
});

function updateSeatKind() {
  const fixed = $('#seat-editor input[name="seat-kind"]:checked').value === 'fixed';
  $('#fixed-number-field').hidden = !fixed;
  $('#fixed-number').disabled = !fixed;
  $('#seat-editor-error').textContent = '';
  $('#fixed-number').removeAttribute('aria-invalid');
}

$('#board-canvas').addEventListener('click', event => {
  const seat = event.target.closest('[data-seat]');
  if (!seat || mode !== 'edit') return;
  selectedSeat = Number(seat.dataset.seat);
  const fixed = layout.fixed.find(item => item.seat === selectedSeat);
  const kind = layout.blocked.includes(selectedSeat) ? 'empty' : fixed ? 'fixed' : 'auto';
  $(`#seat-editor input[value="${kind}"]`).checked = true;
  $('#fixed-number').value = fixed ? String(fixed.number) : '';
  $('#seat-dialog-title').textContent = coordinate(selectedSeat);
  updateSeatKind();
  seatDialog.showModal();
  updateState();
  $(`#seat-editor input[value="${kind}"]`).focus();
});

$('#seat-editor').addEventListener('change', event => {
  if (event.target.name === 'seat-kind') updateSeatKind();
});
$('#fixed-number').addEventListener('input', () => {
  $('#seat-editor-error').textContent = '';
  $('#fixed-number').removeAttribute('aria-invalid');
});

$('#seat-editor').addEventListener('submit', event => {
  event.preventDefault();
  const kind = $('#seat-editor input[name="seat-kind"]:checked').value;
  const candidate = {
    ...layout,
    blocked: layout.blocked.filter(index => index !== selectedSeat),
    fixed: layout.fixed.filter(item => item.seat !== selectedSeat).map(item => ({ ...item }))
  };
  try {
    if (kind === 'empty') candidate.blocked.push(selectedSeat);
    if (kind === 'fixed') {
      const students = readStudents();
      const number = readInteger('fixed-number', 1, students.studentCount, '고정할 학생 번호');
      // Validate this fixed seat alone, allowing other stale fixed seats to be cleared one by one.
      validateSeatingOptions({ ...students, rows: 5, columns: 6, blocked: candidate.blocked, fixed: [{ seat: selectedSeat, number }] });
      const duplicate = candidate.fixed.find(item => item.number === number);
      if (duplicate) throw new Error(`${number}번은 ${coordinate(duplicate.seat)}에 이미 고정되어 있어요. 먼저 그 자리를 자동 배정으로 바꿔 주세요.`);
      candidate.fixed.push({ seat: selectedSeat, number });
    }
    layout = { ...candidate, blocked: candidate.blocked.sort((a, b) => a - b), fixed: candidate.fixed.sort((a, b) => a.seat - b.seat) };
    clearError();
    renderBoard();
    try { readDraft(); } catch (error) { showError(error); }
    updateState();
    announce(`${coordinate(selectedSeat)}을 ${kind === 'empty' ? '빈자리로 지정했습니다' : kind === 'fixed' ? `${$('#fixed-number').value}번 고정석으로 설정했습니다` : '자동 배정으로 바꿨습니다'}.`);
    seatDialog.close();
  } catch (error) {
    $('#seat-editor-error').textContent = error.message;
    if (kind === 'fixed') $('#fixed-number').setAttribute('aria-invalid', 'true');
  }
});

for (const id of ['seat-dialog-close', 'seat-dialog-cancel']) $(`#${id}`).addEventListener('click', () => seatDialog.close());
seatDialog.addEventListener('close', () => { updateState(); $(`[data-seat="${selectedSeat}"]`)?.focus({ preventScroll: true }); });

$('#board-canvas').addEventListener('keydown', event => {
  const seat = event.target.closest('[data-seat]');
  if (!seat || mode !== 'edit' || event.altKey || event.ctrlKey || event.metaKey) return;
  const index = Number(seat.dataset.seat);
  const row = Math.floor(index / 6);
  const column = index % 6;
  let next = index;
  if (event.key === 'ArrowLeft' && column > 0) next--;
  else if (event.key === 'ArrowRight' && column < 5) next++;
  else if (event.key === 'ArrowUp' && row > 0) next -= 6;
  else if (event.key === 'ArrowDown' && row < 4) next += 6;
  else if (event.key === 'Home') next = row * 6;
  else if (event.key === 'End') next = row * 6 + 5;
  else if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  $(`[data-seat="${next}"]`)?.focus();
});

for (const [id, nextMode] of [['edit-mode', 'edit'], ['result-mode', 'result']]) {
  $(`#${id}`).addEventListener('click', () => {
    if (nextMode === 'result' && !lastResult) return;
    mode = nextMode;
    renderBoard();
    updateState();
  });
}

$('#shuffle').addEventListener('click', assign);
$('#print').addEventListener('click', () => { updateState(); if (draftMatchesResult()) window.print(); });
window.addEventListener('beforeprint', updateState);

$('#reset').addEventListener('click', () => {
  settings.reset();
  layout = { rows: 5, columns: 6, blocked: [], fixed: [] };
  lastResult = null;
  lastKey = null;
  round = 0;
  mode = 'edit';
  clearError();
  $('#seating-print').replaceChildren();
  renderBoard();
  updateState();
  announce('고정석과 빈자리, 배정 결과를 모두 초기화했습니다. 30명, 짝꿍 3분단 5행으로 다시 시작합니다.');
  notify('고정석과 빈자리를 지우고 30명으로 초기화했어요.');
});

renderBoard();
updateState();
