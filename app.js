'use strict';
const $ = id => document.getElementById(id);
const video = $('video');
const frame = $('video-frame');
let state = { folder: '', files: [], current: '', position: 0, recentFolders: [], completedVideos: [] };
let loaded = '';
let lastSaved = 0;
let pendingRestore = 0;
let toastTimer;
let captionsOn = true;
let filterText = '';
const quizCache = new Map();
let quizVideo = '';
let activeQuiz = null;
let quizBusy = false;
let quizPollTimer = null;
let manualQuizToken = 0;
let remedialQuestions = null;
let remedialWrong = [];
let remedialToken = 0;
const files = () => state.files || [];
const fileName = entry => typeof entry === 'string' ? entry : entry.name;
const searchable = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');
const svg = body => `<svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  play: svg('<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
  volume: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  muted: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>'),
  fullscreen: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  exitFullscreen: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  prev: svg('<polyline points="15 18 9 12 15 6"/>'),
  next: svg('<polyline points="9 18 15 12 9 6"/>'),
  list: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'),
  controls: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="15" x2="17" y2="15"/>')
};
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
}
async function request(url, data) {
  const res = await fetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) {
    let info;
    try { info = await res.json(); } catch {}
    throw new Error(info?.error || `Lỗi ${res.status}`);
  }
  return res.json();
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
function quizKey(videoName) { return `${state.folder}\u0000${videoName}`; }
function setQuizStatus(message, error = false) {
  $('quiz-status').textContent = message;
  $('quiz-status').classList.toggle('error', error);
}
function appendHighlighted(container, value, item, includeFallback = false) {
  const content = String(value || '');
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const fallback = item.options?.[item.answerIndex];
  const terms = [...new Set([...keywords, ...(includeFallback && !keywords.length ? [fallback] : [])]
    .filter(term => typeof term === 'string').map(term => term.trim())
    .filter(term => term.length >= 2 && term.length <= 80))]
    .sort((a, b) => b.length - a.length).slice(0, 12);
  if (!terms.length) { container.append(document.createTextNode(content)); return; }
  const pattern = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu');
  let last = 0;
  for (const match of content.matchAll(pattern)) {
    if (match.index > last) container.append(document.createTextNode(content.slice(last, match.index)));
    const mark = document.createElement('mark');
    mark.textContent = match[0];
    container.append(mark);
    last = match.index + match[0].length;
  }
  if (last < content.length) container.append(document.createTextNode(content.slice(last)));
}
function validQuestions(questions) {
  return Array.isArray(questions) && questions.length > 0 && questions.every(item =>
    typeof item.question === 'string' && Array.isArray(item.options) && item.options.length === 4 &&
    item.options.every(option => typeof option === 'string') && Number.isInteger(item.answerIndex) &&
    item.answerIndex >= 0 && item.answerIndex <= 3 && typeof item.explanation === 'string');
}
function renderQuestionSet(container, questions, prefix) {
  container.replaceChildren();
  questions.forEach((item, questionIndex) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'quiz-question';
    const legend = document.createElement('legend');
    legend.append(document.createTextNode(`Câu ${questionIndex + 1}${item.extension ? ' · Mở rộng' : ''}. `));
    appendHighlighted(legend, item.question, item);
    fieldset.append(legend);
    item.options.forEach((option, optionIndex) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `${prefix}-${questionIndex}`;
      input.value = String(optionIndex);
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, text);
      fieldset.append(label);
    });
    container.append(fieldset);
  });
}
function resetRemedial() {
  remedialToken++;
  remedialQuestions = null;
  remedialWrong = [];
  $('remedial').hidden = true;
  $('remedial-questions').replaceChildren();
  $('remedial-result').hidden = true;
  $('remedial-submit').hidden = true;
  $('remedial-retry').hidden = true;
}
function renderQuiz() {
  if (!activeQuiz) return;
  $('quiz-manual').hidden = true;
  resetRemedial();
  renderQuestionSet($('quiz-questions'), activeQuiz, 'quiz-question');
  $('quiz-generate').hidden = true;
  $('quiz-submit').hidden = false;
  $('quiz-retry').hidden = true;
  $('quiz-result').hidden = true;
  $('quiz-progress').hidden = true;
  setQuizStatus(`${activeQuiz.length} câu hỏi theo nội dung bài học. Từ khóa quan trọng được tô màu.`);
}
let noteName = '';
let noteMtime = 0;
let noteDirty = false;
const pickedNotes = [];
const noteLabel = name => String(name || '').split(/[\\/]/).pop();
function setNoteStatus(message, error = false) {
  $('note-status').textContent = message;
  $('note-status').classList.toggle('error', error);
}
function setNoteDirty(value) {
  noteDirty = value;
  $('note-save').textContent = value ? 'Lưu • chưa lưu (Ctrl+S)' : 'Lưu (Ctrl+S)';
}
function focusNoteEnd() {
  const editor = $('note-editor');
  if (editor.disabled) return;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(editor.value.length, editor.value.length);
  editor.scrollTop = editor.scrollHeight;
}
function resetNotes() {
  noteName = '';
  noteMtime = 0;
  $('note-editor').value = '';
  $('note-editor').disabled = true;
  for (const id of ['note-save', 'note-reload', 'note-notepad']) $(id).disabled = true;
  setNoteDirty(false);
}
let rememberedNote = '';
async function refreshNotes(selectName = noteName) {
  const select = $('note-select');
  try {
    const { notes, picked = [], last = '' } = await request('/api/notes');
    pickedNotes.splice(0, pickedNotes.length, ...picked);
    rememberedNote = last;
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = notes.length ? 'Chọn file ghi chú…' : 'Chưa có file .md / .txt nào';
    select.append(placeholder);
    for (const note of notes) {
      const option = document.createElement('option');
      option.value = option.textContent = note.name;
      option.title = note.name;
      select.append(option);
    }
    for (const picked of pickedNotes) {
      const option = document.createElement('option');
      option.value = picked;
      option.textContent = `📄 ${noteLabel(picked)}`;
      option.title = picked;
      select.append(option);
    }
    select.value = notes.some(note => note.name === selectName) || pickedNotes.includes(selectName) ? selectName : '';
    return notes;
  } catch (error) { setNoteStatus(error.message, true); return []; }
}
async function openNote(name) {
  if (!name) return;
  if (noteDirty && name !== noteName && !confirm('Ghi chú hiện tại chưa lưu. Bỏ thay đổi và mở file khác?')) { $('note-select').value = noteName; return; }
  try {
    const note = await request(`/api/note?name=${encodeURIComponent(name)}`);
    noteName = name;
    noteMtime = note.mtime;
    $('note-editor').value = note.content;
    $('note-editor').disabled = false;
    for (const id of ['note-save', 'note-reload', 'note-notepad']) $(id).disabled = false;
    $('note-select').value = noteName;
    setNoteDirty(false);
    setNoteStatus(`Đang sửa: ${noteLabel(noteName)}`);
    focusNoteEnd();
  } catch (error) { setNoteStatus(error.message, true); $('note-select').value = noteName; }
}
async function saveNote() {
  if (!noteName || $('note-save').disabled) return;
  try {
    const result = await request('/api/note', { name: noteName, content: $('note-editor').value, mtime: noteMtime });
    noteMtime = result.mtime;
    setNoteDirty(false);
    setNoteStatus(`Đã lưu vào file gốc: ${noteLabel(noteName)}`);
  } catch (error) { setNoteStatus(error.message, true); }
}
async function createNote() {
  if (!state.folder) { setNoteStatus('Hãy chọn thư mục video trước.', true); return; }
  const base = state.current ? state.current.replace(/\.[^.]+$/, '') : 'ghi-chu';
  let name = prompt('Tên file ghi chú (.md hoặc .txt):', `${base}.md`);
  if (!name) return;
  name = name.trim();
  if (!/\.(md|txt)$/i.test(name)) name += '.md';
  if (noteDirty && !confirm('Ghi chú hiện tại chưa lưu. Bỏ thay đổi và tạo file mới?')) return;
  try {
    await request('/api/note', { name, content: `# ${base}\n\n`, create: true });
    await refreshNotes(name);
    await openNote(name);
    $('note-editor').focus();
  } catch (error) { setNoteStatus(error.message, true); }
}
async function chooseNote() {
  try {
    const result = await request('/api/note/choose', {});
    if (!result.path) return;
    if (noteDirty && result.path !== noteName && !confirm('Ghi chú hiện tại chưa lưu. Bỏ thay đổi và mở file khác?')) return;
    noteDirty = false;
    const inFolder = state.folder && result.path.toLowerCase() === `${state.folder}\\${result.name}`.toLowerCase();
    const target = inFolder ? result.name : result.path;
    if (!inFolder && !pickedNotes.includes(target)) pickedNotes.push(target);
    await refreshNotes(target);
    await openNote(target);
  } catch (error) { setNoteStatus(error.message, true); }
}
async function showNotes() {
  const notes = await refreshNotes();
  if (!noteName) {
    if (rememberedNote && (notes.some(note => note.name === rememberedNote) || pickedNotes.includes(rememberedNote))) { await openNote(rememberedNote); return; }
    if (!state.current) return;
    const base = state.current.replace(/\.[^.]+$/, '').toLowerCase();
    const match = notes.find(note => [`${base}.md`, `${base}.txt`].includes(note.name.toLowerCase()));
    if (match) await openNote(match.name);
  }
}
function scrollToCurrentLesson() {
  const list = $('list');
  const active = list.querySelector('.lesson.active');
  if (!active || list.hidden || $('lesson-pane').hidden) return;
  const offset = active.getBoundingClientRect().top - list.getBoundingClientRect().top;
  list.scrollTop += offset - (list.clientHeight - active.offsetHeight) / 2;
}
function showSidebarTab(tab) {
  const quiz = tab === 'quiz';
  const notes = tab === 'notes';
  $('lesson-pane').hidden = quiz || notes;
  $('quiz-dialog').hidden = !quiz;
  $('note-pane').hidden = !notes;
  $('tab-lessons').setAttribute('aria-selected', String(!quiz && !notes));
  $('tab-quiz').setAttribute('aria-selected', String(quiz));
  $('tab-notes').setAttribute('aria-selected', String(notes));
  if (notes) {
    if (noteName) focusNoteEnd();
    showNotes();
  }
  if (!quiz && !notes) scrollToCurrentLesson();
}
async function openQuiz() {
  if (!state.current) return;
  closeDrawer(false);
  if (document.fullscreenElement === frame) await document.exitFullscreen();
  if (quizVideo === state.current && $('quiz-dialog').open) { showSidebarTab('quiz'); return; }
  quizVideo = state.current;
  manualQuizToken++;
  $('quiz-manual').hidden = true;
  $('quiz-lesson').textContent = state.current.replace(/\.[^.]+$/, '');
  const index = files().findIndex(entry => fileName(entry) === state.current);
  $('quiz-next').hidden = index < 0 || index >= files().length - 1;
  if (!$('quiz-dialog').open) $('quiz-dialog').show();
  showSidebarTab('quiz');
  activeQuiz = quizCache.get(quizKey(quizVideo)) || null;
  $('quiz-questions').replaceChildren();
  $('quiz-result').hidden = true;
  $('quiz-submit').hidden = true;
  $('quiz-retry').hidden = true;
  $('quiz-generate').hidden = true;
  resetRemedial();
  if (activeQuiz) return renderQuiz();
  $('quiz-progress').hidden = false;
  $('quiz-progress').removeAttribute('value');
  setQuizStatus(quizBusy ? 'AI đang chuẩn bị bài tập trước đó…' : 'Đang kết nối AI và chuẩn bị câu hỏi…');
  if (!quizBusy) generateQuiz();
}
async function pollQuizJob(videoName, folder) {
  if (!quizBusy) return;
  try {
    const job = await request(`/api/quiz/job?video=${encodeURIComponent(videoName)}`);
    if ($('quiz-dialog').open && quizVideo === videoName && state.folder === folder && job.phase !== 'idle') {
      setQuizStatus(job.message || 'AI đang chuẩn bị câu hỏi…');
      if (Number.isFinite(job.percent)) $('quiz-progress').value = Math.max(0, Math.min(100, job.percent));
      else $('quiz-progress').removeAttribute('value');
    }
  } catch { /* The quiz request supplies the final error. */ }
  if (quizBusy) quizPollTimer = setTimeout(() => pollQuizJob(videoName, folder), 1200);
}
async function generateQuiz() {
  if (quizBusy || !quizVideo) return;
  const requestedVideo = quizVideo;
  const requestedFolder = state.folder;
  quizBusy = true;
  $('quiz-manual').hidden = true;
  $('quiz-generate').hidden = true;
  $('quiz-progress').hidden = false;
  $('quiz-progress').removeAttribute('value');
  setQuizStatus('Đang kết nối AI và chuẩn bị câu hỏi…');
  quizPollTimer = setTimeout(() => pollQuizJob(requestedVideo, requestedFolder), 1200);
  try {
    const result = await request('/api/quiz', { video: requestedVideo });
    if (!validQuestions(result.questions)) {
      throw new Error('AI trả về câu hỏi chưa đúng định dạng. Hãy thử lại.');
    }
    quizCache.set(`${requestedFolder}\u0000${requestedVideo}`, result.questions);
    if ($('quiz-dialog').open && state.folder === requestedFolder && state.current === requestedVideo) {
      activeQuiz = result.questions;
      renderQuiz();
    }
  } catch (error) {
    if ($('quiz-dialog').open && quizVideo === requestedVideo && state.folder === requestedFolder) {
      setQuizStatus(error.message, true);
      $('quiz-progress').hidden = true;
      $('quiz-generate').hidden = false;
      showManualQuiz(requestedVideo, requestedFolder);
    }
  } finally {
    quizBusy = false;
    clearTimeout(quizPollTimer);
    quizPollTimer = null;
    if ($('quiz-dialog').open && quizVideo !== requestedVideo && !quizCache.has(quizKey(quizVideo))) {
      setQuizStatus('Bài mới chưa tạo câu hỏi. Bấm nút bên dưới để bắt đầu.');
      $('quiz-progress').hidden = true;
      $('quiz-generate').textContent = 'Bắt đầu tạo trắc nghiệm';
      $('quiz-generate').hidden = false;
    }
  }
}
async function showManualQuiz(videoName, folder) {
  const token = ++manualQuizToken;
  $('quiz-manual').hidden = false;
  $('quiz-manual-prompt').value = '';
  $('quiz-manual-copy').disabled = true;
  $('quiz-manual-status').textContent = 'Đang chuẩn bị prompt từ phụ đề bài học…';
  try {
    const result = await request(`/api/quiz/manual?video=${encodeURIComponent(videoName)}`);
    if (token !== manualQuizToken || quizVideo !== videoName || state.folder !== folder) return;
    $('quiz-manual-prompt').value = result.prompt;
    $('quiz-manual-copy').disabled = false;
    $('quiz-manual-status').textContent = 'Prompt đã sẵn sàng để copy.';
  } catch (error) {
    if (token === manualQuizToken) $('quiz-manual-status').textContent = error.message;
  }
}
function gradeSet(container, questions) {
  const fields = [...container.querySelectorAll('fieldset')];
  const picks = fields.map(field => field.querySelector('input:checked'));
  if (picks.some(pick => !pick)) return null;
  let correct = 0;
  const wrong = [];
  fields.forEach((field, index) => {
    const item = questions[index];
    const answer = item.answerIndex;
    const selected = Number(picks[index].value);
    if (selected === answer) correct++;
    else wrong.push({ question: item.question, correctAnswer: item.options[answer], explanation: item.explanation });
    [...field.querySelectorAll('.quiz-option')].forEach((label, optionIndex) => {
      label.classList.toggle('correct', optionIndex === answer);
      label.classList.toggle('incorrect', optionIndex === selected && selected !== answer);
      label.querySelector('input').disabled = true;
      const text = label.querySelector('span');
      text.replaceChildren();
      appendHighlighted(text, item.options[optionIndex], item, true);
    });
    const explanation = document.createElement('p');
    explanation.className = 'quiz-explanation';
    appendHighlighted(explanation, item.explanation, item, true);
    field.append(explanation);
  });
  return { correct, wrong };
}
function gradeQuiz() {
  if (!activeQuiz) return;
  const result = gradeSet($('quiz-questions'), activeQuiz);
  if (!result) return setQuizStatus('Bạn hãy chọn đáp án cho tất cả các câu rồi bấm Chấm bài.', true);
  const { correct, wrong } = result;
  $('quiz-result').textContent = `Bạn đúng ${correct}/${activeQuiz.length} câu.`;
  $('quiz-result').hidden = false;
  $('quiz-submit').hidden = true;
  $('quiz-retry').hidden = false;
  setQuizStatus(wrong.length ? 'Đã chấm bài. AI đang soạn câu nhắc lại cho những ý bạn chưa nắm…' : 'Đúng hết! Bạn đã nắm các ý chính của bài.');
  const completedVideo = quizVideo, completedFolder = state.folder;
  request('/api/quiz/complete', { video: completedVideo, wrongQuestions: wrong.map(item => item.question) })
    .then(() => {
      if (state.folder !== completedFolder) return;
      state.completedVideos ||= [];
      if (!state.completedVideos.includes(completedVideo)) state.completedVideos.push(completedVideo);
      renderLists();
    })
    .catch(error => toast(`Không lưu được kiến thức: ${error.message}`));
  if (wrong.length) generateRemedial(wrong);
}
async function generateRemedial(wrong) {
  const token = ++remedialToken;
  const requestedVideo = quizVideo;
  const requestedFolder = state.folder;
  remedialWrong = wrong;
  $('remedial').hidden = false;
  $('remedial-questions').replaceChildren();
  $('remedial-result').hidden = true;
  $('remedial-submit').hidden = true;
  $('remedial-retry').hidden = true;
  $('remedial-status').textContent = `Đang tạo ${wrong.length} câu nhắc lại kiến thức…`;
  try {
    const result = await request('/api/quiz/remedial', { video: requestedVideo, wrongQuestions: wrong });
    if (token !== remedialToken || !$('quiz-dialog').open || quizVideo !== requestedVideo || state.folder !== requestedFolder) return;
    if (!validQuestions(result.questions)) throw new Error('AI chưa tạo được câu nhắc hợp lệ.');
    remedialQuestions = result.questions;
    renderQuestionSet($('remedial-questions'), remedialQuestions, 'remedial-question');
    $('remedial-status').textContent = 'Làm các câu nhắc lại dưới đây để nhớ chắc hơn. Từ khóa chính được tô màu.';
    $('remedial-submit').hidden = false;
  } catch (error) {
    if (token !== remedialToken || !$('quiz-dialog').open) return;
    $('remedial-status').textContent = `${error.message} Bạn có thể thử lại.`;
    $('remedial-retry').hidden = false;
  }
}
function gradeRemedial() {
  if (!remedialQuestions) return;
  const result = gradeSet($('remedial-questions'), remedialQuestions);
  if (!result) { $('remedial-status').textContent = 'Hãy chọn đáp án cho tất cả câu nhắc lại.'; return; }
  $('remedial-result').textContent = `Bạn đúng ${result.correct}/${remedialQuestions.length} câu nhắc lại.`;
  $('remedial-result').hidden = false;
  $('remedial-submit').hidden = true;
  $('remedial-status').textContent = result.wrong.length ? 'Còn ý cần ôn. Bấm tạo lại câu nhắc để luyện tiếp.' : 'Bạn đã trả lời đúng tất cả các câu nhắc lại!';
  if (result.wrong.length) { remedialWrong = result.wrong; $('remedial-retry').hidden = false; }
}
function updatePlayer() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  $('seek').value = duration ? String(Math.round(video.currentTime / duration * 1000)) : '0';
  $('time').textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  $('play-pause').innerHTML = video.paused ? ICONS.play : ICONS.pause;
  $('play-pause').setAttribute('aria-label', video.paused ? 'Phát video' : 'Tạm dừng video');
  $('mute').innerHTML = video.muted || video.volume === 0 ? ICONS.muted : ICONS.volume;
  $('mute').setAttribute('aria-label', video.muted ? 'Bật âm thanh' : 'Tắt âm thanh');
  $('captions').classList.toggle('active', captionsOn);
  $('captions').setAttribute('aria-label', captionsOn ? 'Tắt phụ đề' : 'Bật phụ đề');
  $('fullscreen').innerHTML = document.fullscreenElement === frame ? ICONS.exitFullscreen : ICONS.fullscreen;
  $('fullscreen').setAttribute('aria-label', document.fullscreenElement === frame ? 'Thoát toàn màn hình' : 'Toàn màn hình');
  const controlsHidden = frame.classList.contains('controls-hidden');
  $('controls-toggle').innerHTML = ICONS.controls;
  $('controls-toggle').setAttribute('aria-label', controlsHidden ? 'Hiện điều khiển video' : 'Ẩn điều khiển video');
  $('controls-toggle').setAttribute('aria-pressed', String(!controlsHidden));
  $('controls-toggle').title = (controlsHidden ? 'Hiện điều khiển' : 'Ẩn điều khiển') + ' (nhấn phím K để bật/tắt)';
}
function renderFolders() {
  const select = $('recent-folders');
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Thư mục gần đây';
  select.append(placeholder);
  for (const folder of state.recentFolders || []) {
    const option = document.createElement('option');
    option.value = folder;
    option.textContent = folder;
    select.append(option);
  }
  select.value = '';
  select.hidden = !(state.recentFolders || []).length;
}
function closeDrawer(restoreFocus = true) {
  if ($('lesson-drawer').hidden) return;
  $('lesson-drawer').hidden = true;
  $('drawer-toggle').setAttribute('aria-expanded', 'false');
  if (restoreFocus && document.fullscreenElement === frame) $('drawer-toggle').focus();
}
function renderLists() {
  const all = files();
  const completedVideos = new Set(state.completedVideos || []);
  const needle = searchable(filterText.trim());
  const matching = all.map((entry, index) => ({ name: fileName(entry), index }))
    .filter(({ name }) => searchable(name).includes(needle));
  $('total').textContent = needle ? `${matching.length} / ${all.length} bài` : `${all.length} bài`;
  for (const target of [$('list'), $('drawer-list')]) {
    target.replaceChildren();
    if (!matching.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = all.length ? 'Không có bài nào khớp bộ lọc.' : state.folder ? 'Không tìm thấy video trong thư mục này.' : 'Danh sách bài học sẽ xuất hiện ở đây.';
      target.append(empty);
      continue;
    }
    for (const { name, index } of matching) {
      const button = document.createElement('button');
      const completed = completedVideos.has(name);
      button.className = 'lesson' + (name === state.current ? ' active' : '') + (completed ? ' completed' : '');
      if (name === state.current) button.setAttribute('aria-current', 'true');
      const number = document.createElement('span');
      number.className = 'lesson-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = 'lesson-name';
      label.textContent = name.replace(/\.[^.]+$/, '');
      const done = document.createElement('span');
      done.className = 'lesson-done';
      done.textContent = '✓ Đã làm';
      done.hidden = !completed;
      const play = document.createElement('span');
      play.className = 'lesson-play';
      play.innerHTML = name === state.current ? ICONS.play : ICONS.next;
      button.append(number, label, done, play);
      button.addEventListener('click', () => { select(name, true); closeDrawer(); });
      target.append(button);
    }
  }
}
function render() {
  $('folder').textContent = state.folder || 'Chưa chọn thư mục';
  $('folder').title = state.folder || '';
  renderFolders();
  const all = files();
  const index = all.findIndex(x => fileName(x) === state.current);
  $('counter').textContent = `${index < 0 ? 0 : index + 1} / ${all.length}`;
  $('title').textContent = state.current ? state.current.replace(/\.[^.]+$/, '') : 'Chọn một bài học';
  $('title').title = state.current || '';
  $('empty').hidden = index >= 0;
  $('previous').disabled = $('player-previous').disabled = index <= 0;
  $('next').disabled = $('player-next').disabled = index < 0 || index >= all.length - 1;
  $('play-pause').disabled = $('seek').disabled = $('fullscreen').disabled = index < 0;
  $('quiz-open').disabled = index < 0;
  renderLists();
  updatePlayer();
}
async function save() {
  if (!loaded || loaded !== state.current || pendingRestore) return;
  const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  try {
    await request('/api/progress', { current: loaded, position });
    $('save-status').textContent = 'Tiến độ đã được lưu';
  } catch {
    $('save-status').textContent = 'Chưa lưu được tiến độ';
  }
}
async function select(name, play = false, position = 0) {
  if (loaded && loaded !== name) await save();
  video.pause();
  state.current = name;
  state.position = position;
  loaded = name;
  pendingRestore = position || 0;
  video.removeAttribute('src');
  video.querySelectorAll('track').forEach(track => track.remove());
  video.src = `/video?name=${encodeURIComponent(name)}`;
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = 'Phụ đề';
  track.srclang = 'vi';
  track.src = `/subtitle?name=${encodeURIComponent(name)}`;
  track.default = true;
  track.addEventListener('load', () => { if (video.textTracks[0]) video.textTracks[0].mode = captionsOn ? 'showing' : 'disabled'; });
  video.append(track);
  if (video.textTracks[0]) video.textTracks[0].mode = captionsOn ? 'showing' : 'disabled';
  video.load();
  render();
  if (!pendingRestore) await save();
  if (play) video.play().catch(() => {});
}
async function applyFolder(result) {
  resetNotes();
  $('note-select').replaceChildren();
  if (!$('note-pane').hidden) showSidebarTab('lessons');
  state = result;
  filterText = '';
  $('list-filter').value = $('drawer-filter').value = '';
  loaded = '';
  pendingRestore = 0;
  video.pause();
  video.removeAttribute('src');
  video.querySelectorAll('track').forEach(track => track.remove());
  video.load();
  if (state.current && files().some(x => fileName(x) === state.current)) await select(state.current, false, state.position);
  else if (files().length) await select(fileName(files()[0]));
  else render();
}
async function choose() {
  try {
    if (loaded) await save();
    const result = await request('/api/choose', {});
    if (result) await applyFolder(result);
  } catch (error) { toast(error.message); }
}
async function switchFolder(folder) {
  if (!folder) return;
  try {
    if (loaded) await save();
    await applyFolder(await request('/api/folder', { folder }));
  } catch (error) { toast(error.message); }
}
function previous() {
  const i = files().findIndex(x => fileName(x) === state.current);
  if (i > 0) select(fileName(files()[i - 1]), true);
}
function next() {
  const i = files().findIndex(x => fileName(x) === state.current);
  if (i >= 0 && i < files().length - 1) select(fileName(files()[i + 1]), true);
}
function seekBy(delta) {
  if (!loaded || !Number.isFinite(video.duration)) return;
  video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
  updatePlayer();
}
function togglePlayback() {
  if (!loaded) return;
  if (video.paused) video.play().catch(() => {});
  else video.pause();
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === frame) await document.exitFullscreen();
    else await frame.requestFullscreen();
  } catch (error) { toast(error.message || 'Không mở được toàn màn hình.'); }
}
$('choose').onclick = $('change').onclick = $('empty-choose').onclick = choose;
$('recent-folders').addEventListener('change', event => switchFolder(event.target.value));
for (const input of [$('list-filter'), $('drawer-filter')]) {
  input.addEventListener('input', () => {
    filterText = input.value;
    const other = input === $('list-filter') ? $('drawer-filter') : $('list-filter');
    other.value = filterText;
    renderLists();
  });
}
$('drawer-toggle').onclick = () => {
  const drawer = $('lesson-drawer');
  if (!drawer.hidden) return closeDrawer();
  drawer.hidden = false;
  $('drawer-toggle').setAttribute('aria-expanded', 'true');
  $('drawer-filter').focus();
};
$('drawer-close').onclick = () => closeDrawer();
$('drawer-filter').addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
});
$('exit-tool').onclick = async () => {
  const button = $('exit-tool');
  button.disabled = true;
  button.textContent = 'Đang thoát…';
  video.pause();
  await save();
  try {
    const response = await fetch('/api/exit', { method: 'POST', headers: { 'X-Video-Tool-Exit': '1' } });
    if (!response.ok) throw new Error('Không dừng được server.');
    window.close();
    setTimeout(() => { location.replace('about:blank'); }, 300);
  } catch (error) {
    toast(error.message);
    button.disabled = false;
    button.textContent = 'Thoát';
  }
};
$('quiz-open').onclick = () => openQuiz().catch(error => toast(error.message));
$('quiz-close').onclick = () => showSidebarTab('lessons');
$('tab-lessons').onclick = () => showSidebarTab('lessons');
$('tab-quiz').onclick = () => openQuiz().catch(error => toast(error.message));
$('tab-notes').onclick = () => { closeDrawer(false); showSidebarTab('notes'); };
$('note-select').addEventListener('change', event => openNote(event.target.value));
$('note-new').onclick = createNote;
$('note-choose').onclick = chooseNote;
$('note-save').onclick = saveNote;
$('note-reload').onclick = async () => {
  if (noteDirty && !confirm('Bỏ thay đổi chưa lưu và tải lại từ file?')) return;
  noteDirty = false;
  await openNote(noteName);
};
$('note-notepad').onclick = async () => {
  try { await request('/api/note/open', { name: noteName }); setNoteStatus(`Đã mở ${noteLabel(noteName)} bằng Notepad. Sau khi lưu bên đó, bấm Tải lại.`); }
  catch (error) { setNoteStatus(error.message, true); }
};
$('note-editor').addEventListener('input', () => setNoteDirty(true));
$('note-editor').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveNote(); }
  if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey) {
    event.preventDefault();
    document.execCommand('insertText', false, '  ');
  }
});
window.addEventListener('beforeunload', event => { if (noteDirty) { event.preventDefault(); event.returnValue = ''; } });
$('quiz-generate').onclick = generateQuiz;
$('quiz-manual-copy').onclick = async () => {
  const prompt = $('quiz-manual-prompt').value;
  if (!prompt) return;
  try { await navigator.clipboard.writeText(prompt); $('quiz-manual-status').textContent = 'Đã copy prompt.'; }
  catch {
    $('quiz-manual-prompt').select();
    $('quiz-manual-status').textContent = 'Hãy bấm Ctrl+C để copy prompt đang được chọn.';
  }
};
$('quiz-manual-import').onclick = async () => {
  const button = $('quiz-manual-import');
  const requestedVideo = quizVideo, requestedFolder = state.folder;
  button.disabled = true;
  $('quiz-manual-status').textContent = 'Đang kiểm tra và nhập câu hỏi…';
  try {
    const result = await request('/api/quiz/manual', { video: requestedVideo, response: $('quiz-manual-response').value });
    if (!validQuestions(result.questions)) throw new Error('JSON chưa có bộ câu hỏi hợp lệ.');
    quizCache.set(`${requestedFolder}\u0000${requestedVideo}`, result.questions);
    if (quizVideo === requestedVideo && state.folder === requestedFolder) {
      activeQuiz = result.questions;
      renderQuiz();
    }
  } catch (error) { $('quiz-manual-status').textContent = error.message; }
  finally { button.disabled = false; }
};
$('quiz-submit').onclick = gradeQuiz;
$('quiz-retry').onclick = renderQuiz;
$('quiz-next').onclick = () => { showSidebarTab('lessons'); next(); };
$('remedial-submit').onclick = gradeRemedial;
$('remedial-retry').onclick = () => { if (remedialWrong.length) generateRemedial(remedialWrong); };
let courseExamQuestions = null;
let courseExamPlan = null;
let courseExamPage = 0;
let courseExamBusy = false;
const courseExamCache = new Map();
let courseExamMilestone = 0;
const courseExamEncouragement = {
  20: 'Bạn đã đi được 20% đề rồi. Cứ giữ nhịp nhé!',
  40: 'Đã hoàn thành 40%. Nỗ lực của bạn đang tích lũy thành kiến thức!',
  60: 'Qua mốc 60% rồi. Tiếp tục tập trung, bạn làm tốt lắm!',
  80: 'Đã tới 80%. Chỉ còn một đoạn nữa thôi!',
  100: 'Bạn đã trả lời hết đề. Giờ hãy chấm bài để xem kết quả!'
};
$('course-exam-questions').addEventListener('change', () => {
  if (!courseExamQuestions || $('course-exam-submit').hidden) return;
  const answered = $('course-exam-questions').querySelectorAll('fieldset input:checked').length;
  const milestone = Math.floor(answered / courseExamQuestions.length * 5) * 20;
  if (milestone > courseExamMilestone && courseExamEncouragement[milestone]) {
    courseExamMilestone = milestone;
    const entry = courseExamCache.get(courseExamPage);
    if (entry) entry.milestone = milestone;
    toast(courseExamEncouragement[milestone]);
  }
});
function saveCourseExamPage() {
  const entry = courseExamCache.get(courseExamPage);
  if (!entry || !courseExamQuestions) return;
  entry.picks = [...$('course-exam-questions').querySelectorAll('fieldset')].map(field =>
    field.querySelector('input:checked')?.value ?? null);
}
function renderCourseExamPage() {
  const entry = courseExamCache.get(courseExamPage);
  courseExamQuestions = entry.questions;
  courseExamMilestone = entry.milestone || 0;
  renderQuestionSet($('course-exam-questions'), entry.questions, 'course-exam-question');
  [...$('course-exam-questions').querySelectorAll('fieldset')].forEach((field, index) => {
    if (entry.picks?.[index] != null) field.querySelector(`input[value="${entry.picks[index]}"]`).checked = true;
  });
  if (entry.graded) gradeSet($('course-exam-questions'), entry.questions);
  $('course-exam-result').hidden = !entry.graded;
  if (entry.graded) $('course-exam-result').textContent = `Trang này đúng ${entry.correct}/${entry.questions.length} câu.`;
  $('course-exam-submit').hidden = entry.graded;
  $('course-exam-retry').hidden = !entry.graded;
  $('course-exam-generate').hidden = true;
  $('course-exam-pages').hidden = false;
  $('course-exam-page-label').textContent = `Trang ${courseExamPage + 1}/${courseExamPlan.pages} · ${entry.questions.length} câu`;
  $('course-exam-previous').disabled = courseExamPage === 0 || courseExamBusy;
  $('course-exam-next').disabled = courseExamPage >= courseExamPlan.pages - 1 || courseExamBusy;
  $('course-exam-status').textContent = entry.graded
    ? 'Đã chấm trang này. Xem đáp án và giải thích dưới từng câu.'
    : 'Câu hỏi tăng dần từ khó đến mức senior; câu cuối là phần mở rộng.';
  window.scrollTo(0, 0);
}
async function loadCourseExamPage(page) {
  if (courseExamBusy || !courseExamPlan || page < 0 || page >= courseExamPlan.pages) return;
  saveCourseExamPage();
  courseExamBusy = true;
  $('course-exam-previous').disabled = $('course-exam-next').disabled = true;
  $('course-exam-generate').disabled = true;
  try {
    if (!courseExamCache.has(page)) {
      $('course-exam-status').textContent = `Đang tạo trang ${page + 1}/${courseExamPlan.pages} từ kiến thức đã lưu…`;
      const result = await request('/api/course-exam/page', { page, revision: courseExamPlan.revision });
      if (!validQuestions(result.questions) || result.questions.length > 20) throw new Error('Trang đề chưa hợp lệ.');
      courseExamCache.set(page, { questions: result.questions, picks: [], graded: false, milestone: 0 });
    }
    courseExamPage = page;
    renderCourseExamPage();
  } catch (error) { $('course-exam-status').textContent = error.message; }
  finally {
    courseExamBusy = false;
    $('course-exam-generate').disabled = false;
    if (courseExamCache.has(courseExamPage)) {
      $('course-exam-previous').disabled = courseExamPage === 0;
      $('course-exam-next').disabled = courseExamPage >= courseExamPlan.pages - 1;
    }
  }
}
$('course-exam-open').onclick = async () => {
  if (!state.folder) return toast('Hãy chọn thư mục khóa học trước.');
  let latestPlan;
  try { latestPlan = { ...await request('/api/course-exam/plan'), folder: state.folder }; }
  catch (error) { return toast(error.message); }
  if (!courseExamPlan || courseExamPlan.folder !== latestPlan.folder || courseExamPlan.revision !== latestPlan.revision) {
    courseExamQuestions = null;
    courseExamCache.clear();
    $('course-exam-questions').replaceChildren();
    $('course-exam-pages').hidden = true;
    $('course-exam-generate').hidden = false;
    $('course-exam-submit').hidden = true;
    $('course-exam-retry').hidden = true;
    $('course-exam-result').hidden = true;
  }
  courseExamPlan = latestPlan;
  video.pause();
  document.querySelector('.layout').hidden = true;
  $('course-exam').hidden = false;
  window.scrollTo(0, 0);
};
$('course-exam-close').onclick = () => {
  $('course-exam').hidden = true;
  document.querySelector('.layout').hidden = false;
};
$('course-exam-generate').onclick = async () => {
  const button = $('course-exam-generate');
  button.disabled = true;
  $('course-exam-status').textContent = 'Đang chia kiến thức toàn khóa thành các trang…';
  try {
    courseExamPlan = { ...await request('/api/course-exam/plan'), folder: state.folder };
    courseExamCache.clear();
    courseExamQuestions = null;
    courseExamPage = 0;
    await loadCourseExamPage(0);
  } catch (error) { $('course-exam-status').textContent = error.message; }
  finally { button.disabled = false; }
};
$('course-exam-previous').onclick = () => loadCourseExamPage(courseExamPage - 1);
$('course-exam-next').onclick = () => loadCourseExamPage(courseExamPage + 1);
$('course-exam-submit').onclick = () => {
  if (!courseExamQuestions) return;
  const result = gradeSet($('course-exam-questions'), courseExamQuestions);
  if (!result) return $('course-exam-status').textContent = 'Hãy chọn đáp án cho tất cả các câu.';
  const entry = courseExamCache.get(courseExamPage);
  saveCourseExamPage();
  entry.graded = true;
  entry.correct = result.correct;
  $('course-exam-result').textContent = `Trang này đúng ${result.correct}/${courseExamQuestions.length} câu.`;
  $('course-exam-result').hidden = false;
  $('course-exam-submit').hidden = true;
  $('course-exam-retry').hidden = false;
  $('course-exam-status').textContent = 'Đã chấm bài. Xem đáp án và giải thích dưới từng câu.';
  window.scrollTo(0, 0);
};
$('course-exam-retry').onclick = () => {
  courseExamMilestone = 0;
  const entry = courseExamCache.get(courseExamPage);
  entry.graded = false;
  entry.picks = [];
  entry.milestone = 0;
  renderQuestionSet($('course-exam-questions'), courseExamQuestions, 'course-exam-question');
  $('course-exam-result').hidden = true;
  $('course-exam-submit').hidden = false;
  $('course-exam-retry').hidden = true;
  window.scrollTo(0, 0);
};
$('quiz-dialog').addEventListener('close', () => { remedialToken++; });
$('previous').onclick = $('player-previous').onclick = previous;
$('next').onclick = $('player-next').onclick = next;
$('play-pause').onclick = togglePlayback;
$('fullscreen').onclick = toggleFullscreen;
function toggleControls() { frame.classList.toggle('controls-hidden'); updatePlayer(); }
$('controls-toggle').onclick = toggleControls;
$('captions').onclick = () => {
  captionsOn = !captionsOn;
  for (const track of video.textTracks) track.mode = captionsOn ? 'showing' : 'disabled';
  updatePlayer();
};
$('mute').onclick = () => { video.muted = !video.muted; updatePlayer(); };
$('volume').addEventListener('input', event => { video.volume = Number(event.target.value); video.muted = video.volume === 0; updatePlayer(); });
$('seek').addEventListener('input', event => {
  if (Number.isFinite(video.duration)) video.currentTime = Number(event.target.value) / 1000 * video.duration;
  updatePlayer();
});
video.addEventListener('click', togglePlayback);
video.addEventListener('dblclick', toggleFullscreen);
video.addEventListener('loadedmetadata', () => {
  if (pendingRestore > 0 && Number.isFinite(video.duration)) {
    video.currentTime = Math.min(pendingRestore, Math.max(0, video.duration - 0.2));
    pendingRestore = 0;
  }
  updatePlayer();
});
video.addEventListener('timeupdate', () => {
  updatePlayer();
  if (Date.now() - lastSaved >= 5000 && !video.paused) { lastSaved = Date.now(); save(); }
});
video.addEventListener('play', updatePlayer);
video.addEventListener('pause', () => { updatePlayer(); if (!pendingRestore) save(); });
video.addEventListener('volumechange', updatePlayer);
video.addEventListener('ended', () => { save(); });
document.addEventListener('fullscreenchange', () => {
  frame.classList.toggle('controls-hidden', document.fullscreenElement === frame);
  updatePlayer();
  if (document.fullscreenElement !== frame) closeDrawer(false);
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (!['ArrowLeft', 'ArrowRight', ' ', 'f', 'F', 'k', 'K'].includes(event.key)) return;
  if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur();
  if (event.key === 'ArrowLeft') seekBy(-5);
  if (event.key === 'ArrowRight') seekBy(5);
  if (event.key === ' ') togglePlayback();
  if (event.key === 'f' || event.key === 'F') toggleFullscreen();
  if (event.key === 'k' || event.key === 'K') toggleControls();
  event.preventDefault();
});
window.addEventListener('pagehide', () => {
  if (loaded && loaded === state.current && !pendingRestore) fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: loaded, position: video.currentTime || 0 }), keepalive: true }).catch(() => {});
});
$('player-previous').innerHTML = ICONS.prev;
$('player-next').innerHTML = ICONS.next;
$('drawer-toggle').innerHTML = ICONS.list;
(async () => {
  try {
    state = await request('/api/state');
    if (state.current && files().some(x => fileName(x) === state.current)) await select(state.current, false, state.position);
    else render();
  } catch (error) { render(); toast(error.message); }
})();
