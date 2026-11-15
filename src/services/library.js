'use strict';

/** Thư mục khóa học: danh sách video, phụ đề, đổi thư mục và ảnh chụp trạng thái cho giao diện. */

const fsp = require('node:fs').promises;
const path = require('node:path');
const { videoExts } = require('../config');
const { state, persist } = require('../state/appState');
const { byName } = require('../utils/fsAtomic');
const store = require('./knowledge/contextStore');
const selection = require('./knowledge/selection');
const lessonFacts = require('./knowledge/lessonFacts');

/** Liệt kê file trong thư mục đang chọn có phần mở rộng thuộc `exts`. */
async function listFolderFiles(exts) {
  if (!state.folder) return [];
  try {
    const entries = await fsp.readdir(state.folder, { withFileTypes: true });
    return entries.filter(e => e.isFile() && exts.has(path.extname(e.name).toLowerCase()))
      .map(e => ({ name: e.name })).sort(byName);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

const videos = () => listFolderFiles(videoExts);

async function snapshot() {
  const [videoFiles, lessons, contexts, contextId] = await Promise.all([
    videos(), state.folder ? lessonFacts.courseLessons(state.folder) : [], store.listContexts(), selection.activeContextId()
  ]);
  const { folderContexts, ...publicState } = state;
  return { ...publicState, contextId, contexts, files: videoFiles, completedVideos: lessons.map(item => item.video) };
}

async function setFolder(folder) {
  if (typeof folder !== 'string' || !folder.trim()) throw new Error('Vui lòng chọn thư mục.');
  const resolved = path.resolve(folder.trim());
  const info = await fsp.stat(resolved);
  if (!info.isDirectory()) throw new Error('Đường dẫn không phải thư mục.');
  if (state.folder !== resolved) Object.assign(state, { folder: resolved, current: '', position: 0 });
  state.recentFolders = [resolved, ...state.recentFolders.filter(item => item.toLowerCase() !== resolved.toLowerCase())].slice(0, 6);
  const list = await videos();
  if (!list.some(f => f.name === state.current)) { state.current = list[0]?.name || ''; state.position = 0; }
  await selection.applyFolderContext();
  await persist();
  return snapshot();
}

async function videoPath(name) {
  if (!name || path.basename(name) !== name || !(await videos()).some(f => f.name === name)) throw new Error('Không tìm thấy video.');
  return path.join(state.folder, name);
}

async function subtitlePath(file) {
  const entries = await fsp.readdir(path.dirname(file), { withFileTypes: true });
  const base = path.basename(file, path.extname(file)).toLowerCase();
  const subtitles = new Map(entries.filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.srt')
    .map(entry => [entry.name.toLowerCase(), entry.name]));
  const match = [`${base}_vi.srt`, `${base}.vi.srt`, `${base}.srt`]
    .map(candidate => subtitles.get(candidate)).find(Boolean);
  return match ? path.join(path.dirname(file), match) : null;
}

module.exports = { listFolderFiles, videos, snapshot, setFolder, videoPath, subtitlePath };
