'use strict';

/**
 * Kho "bộ kiến thức" (learning context). Mỗi bộ là một file riêng trong data/contexts/<id>.json
 * để mỗi môn học/chủ đề tách biệt, AI chỉ đọc kiến thức của bộ đang chọn (prompt gọn hơn).
 *
 * Cấu trúc file:
 * {
 *   "schema": 1, "id": "aspnet-microservices-a1b2c3", "name": "ASP.NET Microservices",
 *   "type": "Lập trình", "description": "", "createdAt": ISO, "updatedAt": ISO,
 *   "courses": [{ "folder": "M:\\...", "lessons": [{ "video", "completedAt", "facts": [...] }] }]
 * }
 */

const fsp = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { paths } = require('../../config');
const { CONTEXT_ID } = require('../../state/appState');
const { writeJsonAtomic, createQueue } = require('../../utils/fsAtomic');

const SCHEMA = 1;
const DEFAULT_TYPE = 'Khác';
const enqueue = createQueue();

function contextFile(id) {
  if (typeof id !== 'string' || !CONTEXT_ID.test(id)) throw new Error('Mã bộ kiến thức không hợp lệ.');
  return path.join(paths.contextsDir, `${id}.json`);
}

function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'context';
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}

function normalizeMeta(input, { partial = false } = {}) {
  const meta = {};
  if (!partial || input.name !== undefined) {
    meta.name = cleanText(input.name, 80);
    if (!meta.name) throw new Error('Hãy nhập tên bộ kiến thức.');
  }
  if (!partial || input.type !== undefined) meta.type = cleanText(input.type, 40) || DEFAULT_TYPE;
  if (!partial || input.description !== undefined) meta.description = cleanText(input.description, 300);
  return meta;
}

function validLessons(course) {
  return Array.isArray(course?.lessons) ? course.lessons.filter(item => item && typeof item.video === 'string' && Array.isArray(item.facts)) : [];
}

async function readContext(id) {
  const file = contextFile(id);
  let data;
  try { data = JSON.parse(await fsp.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Không đọc được bộ kiến thức ${id}: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.courses)) throw new Error(`Bộ kiến thức ${id} có cấu trúc không hợp lệ.`);
  return { ...data, id };
}

async function contextExists(id) {
  if (typeof id !== 'string' || !CONTEXT_ID.test(id)) return false;
  try { await fsp.access(contextFile(id)); return true; } catch { return false; }
}

function summarize(context) {
  const lessons = context.courses.flatMap(validLessons);
  return {
    id: context.id,
    name: typeof context.name === 'string' && context.name ? context.name : context.id,
    type: typeof context.type === 'string' && context.type ? context.type : DEFAULT_TYPE,
    description: typeof context.description === 'string' ? context.description : '',
    createdAt: context.createdAt || null,
    updatedAt: context.updatedAt || context.createdAt || null,
    courses: context.courses.length,
    lessons: lessons.length,
    facts: lessons.reduce((total, lesson) => total + lesson.facts.length, 0)
  };
}

async function listContexts() {
  let entries;
  try { entries = await fsp.readdir(paths.contextsDir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== '.json') continue;
    const id = path.basename(entry.name, '.json');
    if (!CONTEXT_ID.test(id)) continue;
    try { const context = await readContext(id); if (context) result.push(summarize(context)); }
    catch (error) { console.error(error.message); }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' }));
}

async function createContext(input, courses = []) {
  const meta = normalizeMeta(input || {});
  await fsp.mkdir(paths.contextsDir, { recursive: true });
  const now = new Date().toISOString();
  return enqueue(async () => {
    let id;
    do id = `${slugify(meta.name)}-${crypto.randomBytes(3).toString('hex')}`; while (await contextExists(id));
    const context = { schema: SCHEMA, id, ...meta, createdAt: now, updatedAt: now, courses };
    await writeJsonAtomic(contextFile(id), context);
    return summarize(context);
  });
}

async function updateContextMeta(id, input) {
  const meta = normalizeMeta(input || {}, { partial: true });
  return enqueue(async () => {
    const context = await readContext(id);
    if (!context) throw new Error('Không tìm thấy bộ kiến thức.');
    Object.assign(context, meta, { updatedAt: new Date().toISOString() });
    await writeJsonAtomic(contextFile(id), context);
    return summarize(context);
  });
}

const sameFolder = (a, b) => typeof a === 'string' && typeof b === 'string' && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Các bài đã lưu của một thư mục khóa học trong bộ kiến thức (giữ thứ tự lưu). */
async function readCourseLessons(id, folder) {
  if (!id) return [];
  const context = await readContext(id);
  if (!context) return [];
  return validLessons(context.courses.find(item => sameFolder(item.folder, folder)));
}

/** Toàn bộ bài đã lưu trong bộ kiến thức (mọi khóa học), sắp theo thời gian hoàn thành. */
async function readAllLessons(id) {
  if (!id) return [];
  const context = await readContext(id);
  if (!context) return [];
  return context.courses.flatMap(course => validLessons(course).map(lesson => ({ ...lesson, folder: course.folder })))
    .map((lesson, order) => ({ lesson, order, time: Date.parse(lesson.completedAt) || 0 }))
    .sort((a, b) => a.time - b.time || a.order - b.order).map(item => item.lesson);
}

async function saveLessonFacts(id, folder, video, facts) {
  return enqueue(async () => {
    const context = await readContext(id);
    if (!context) throw new Error('Không tìm thấy bộ kiến thức đang chọn.');
    let course = context.courses.find(item => sameFolder(item.folder, folder));
    if (!course) { course = { folder, lessons: [] }; context.courses.push(course); }
    if (!Array.isArray(course.lessons)) course.lessons = [];
    const now = new Date().toISOString();
    course.lessons = course.lessons.filter(item => item.video !== video);
    course.lessons.push({ video, completedAt: now, facts });
    context.updatedAt = now;
    await writeJsonAtomic(contextFile(id), context);
  });
}

/**
 * Chuyển learning-context.json cũ (một file chung) thành một bộ kiến thức riêng.
 * Chỉ chạy khi chưa có bộ kiến thức nào; file cũ được chuyển vào data/legacy để sao lưu.
 * Trả về { id, folders } của bộ đã tạo, hoặc null.
 */
async function migrateLegacyContext() {
  let raw;
  try { raw = await fsp.readFile(paths.legacyContextFile, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if ((await listContexts()).length) return null;
  const data = JSON.parse(raw);
  if (!Array.isArray(data.courses)) throw new Error('learning-context.json cũ có cấu trúc không hợp lệ.');
  const courses = data.courses.filter(course => typeof course?.folder === 'string' && Array.isArray(course.lessons));
  const folders = courses.map(course => path.resolve(course.folder));
  let parent = folders.length ? path.dirname(folders[0]) : '';
  while (parent && !folders.every(folder => folder.toLowerCase().startsWith(parent.toLowerCase() + path.sep))) {
    const next = path.dirname(parent);
    parent = next === parent ? '' : next;
  }
  const name = (parent && path.basename(parent)) || 'Kiến thức đã lưu';
  const created = await createContext({ name, type: DEFAULT_TYPE, description: 'Chuyển tự động từ learning-context.json cũ.' }, courses);
  const times = courses.flatMap(validLessons).map(lesson => lesson.completedAt).filter(value => typeof value === 'string').sort();
  if (times.length) {
    await enqueue(async () => {
      const context = await readContext(created.id);
      context.createdAt = times[0];
      context.updatedAt = times[times.length - 1];
      await writeJsonAtomic(contextFile(created.id), context);
    });
  }
  await fsp.mkdir(paths.legacyBackupDir, { recursive: true });
  await fsp.rename(paths.legacyContextFile, path.join(paths.legacyBackupDir, `learning-context.${Date.now()}.json`));
  return { id: created.id, folders };
}

module.exports = {
  listContexts, readContext, contextExists, createContext, updateContextMeta,
  readCourseLessons, readAllLessons, saveLessonFacts, migrateLegacyContext
};
