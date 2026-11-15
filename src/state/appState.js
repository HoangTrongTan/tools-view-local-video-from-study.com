'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');
const { paths } = require('../config');
const { writeJsonAtomic, createQueue } = require('../utils/fsAtomic');

const CONTEXT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/**
 * Trạng thái dùng chung của app (được lưu vào data/progress.json).
 * Luôn sửa trực tiếp object này, không gán lại, để mọi module thấy cùng dữ liệu.
 *  - contextId: bộ kiến thức đang chọn.
 *  - folderContexts: thư mục khóa học (chữ thường) -> bộ kiến thức đã dùng lần trước.
 */
const state = {
  folder: '', current: '', position: 0, recentFolders: [], pickedNotes: [], lastNote: '',
  contextId: '', folderContexts: {}
};

const enqueue = createQueue();

function persist() {
  const data = JSON.parse(JSON.stringify(state));
  return enqueue(() => writeJsonAtomic(paths.stateFile, data));
}

const folderKey = folder => path.resolve(folder).toLowerCase();

/** Đọc tiến độ; nếu còn progress.json ở vị trí cũ (thư mục gốc) thì lấy bản mới hơn. */
async function readSaved() {
  const found = [];
  for (const file of [paths.stateFile, paths.legacyStateFile]) {
    try { found.push({ file, mtime: (await fsp.stat(file)).mtimeMs, data: JSON.parse(await fsp.readFile(file, 'utf8')) }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // File cũ hơn trước, file mới hơn ghi đè; giữ được contextId/folderContexts chỉ có ở data/progress.json.
  found.sort((a, b) => a.mtime - b.mtime);
  const valid = found.map(item => item.data).filter(data => data && typeof data === 'object');
  return { saved: valid.length ? Object.assign({}, ...valid) : null, hasLegacy: found.some(item => item.file === paths.legacyStateFile) };
}

async function loadState() {
  let saved, hasLegacy;
  try { ({ saved, hasLegacy } = await readSaved()); }
  catch (error) { console.error('Không đọc được tiến độ đã lưu:', error.message); return; }
  if (hasLegacy) {
    // Chuyển hẳn sang data/progress.json rồi bỏ file ở vị trí cũ.
    applySaved(saved);
    await persist();
    await fsp.rm(paths.legacyStateFile, { force: true });
    return;
  }
  applySaved(saved);
}

function applySaved(saved) {
  if (!saved || typeof saved.folder !== 'string' || typeof saved.current !== 'string' || !Number.isFinite(saved.position) || saved.position < 0) return;
  const recentFolders = Array.isArray(saved.recentFolders) ? saved.recentFolders.filter(item => typeof item === 'string' && item.trim()) : [];
  const folderContexts = {};
  if (saved.folderContexts && typeof saved.folderContexts === 'object') {
    for (const [folder, id] of Object.entries(saved.folderContexts)) {
      if (typeof id === 'string' && CONTEXT_ID.test(id) && folder) folderContexts[folder.toLowerCase()] = id;
    }
  }
  Object.assign(state, {
    folder: saved.folder, current: saved.current, position: saved.position,
    pickedNotes: Array.isArray(saved.pickedNotes) ? saved.pickedNotes.filter(item => typeof item === 'string' && path.isAbsolute(item)).slice(-20) : [],
    lastNote: typeof saved.lastNote === 'string' ? saved.lastNote : '',
    recentFolders: [saved.folder, ...recentFolders].filter((item, index, list) => item && list.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index).slice(0, 6),
    contextId: typeof saved.contextId === 'string' && CONTEXT_ID.test(saved.contextId) ? saved.contextId : '',
    folderContexts
  });
}

module.exports = { state, persist, loadState, folderKey, CONTEXT_ID };
