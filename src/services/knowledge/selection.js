'use strict';

/** Chọn bộ kiến thức đang dùng và nhớ bộ kiến thức theo từng thư mục khóa học. */

const fsp = require('node:fs').promises;
const path = require('node:path');
const { paths } = require('../../config');
const { state, persist, folderKey } = require('../../state/appState');
const store = require('./contextStore');

async function activeContextId() {
  return state.contextId && await store.contextExists(state.contextId) ? state.contextId : '';
}

function rememberForFolder(id) {
  if (state.folder && id) state.folderContexts[folderKey(state.folder)] = id;
}

async function selectContext(id) {
  if (!await store.contextExists(id)) throw new Error('Không tìm thấy bộ kiến thức.');
  state.contextId = id;
  rememberForFolder(id);
  await persist();
}

/** Gọi khi đổi thư mục: dùng lại bộ kiến thức đã gắn với thư mục đó (nếu có). Không tự lưu. */
async function applyFolderContext() {
  if (!state.folder) return;
  const mapped = state.folderContexts[folderKey(state.folder)];
  if (mapped && await store.contextExists(mapped)) state.contextId = mapped;
  else rememberForFolder(await activeContextId());
}

/** Bộ kiến thức để lưu kết quả; tự tạo một bộ theo tên thư mục nếu chưa có bộ nào được chọn. */
async function contextForSaving() {
  const current = await activeContextId();
  if (current) return current;
  const created = await store.createContext({ name: path.basename(state.folder) || 'Kiến thức mới' });
  await selectContext(created.id);
  return created.id;
}

async function createAndSelect(input) {
  const created = await store.createContext(input);
  await selectContext(created.id);
  return created;
}

async function initContexts() {
  await fsp.mkdir(paths.contextsDir, { recursive: true });
  let changed = false;
  try {
    const migrated = await store.migrateLegacyContext();
    if (migrated) {
      console.log(`Đã chuyển learning-context.json sang bộ kiến thức "${migrated.id}".`);
      for (const folder of migrated.folders) state.folderContexts[folderKey(folder)] ??= migrated.id;
      state.contextId = migrated.id;
      changed = true;
    }
  } catch (error) { console.error('Không chuyển được learning-context.json cũ:', error.message); }
  if (!await activeContextId()) {
    const mapped = state.folder && state.folderContexts[folderKey(state.folder)];
    const fallback = mapped && await store.contextExists(mapped) ? mapped : (await store.listContexts())[0]?.id || '';
    if (fallback !== state.contextId) { state.contextId = fallback; changed = true; }
  }
  if (state.contextId && state.folder && !state.folderContexts[folderKey(state.folder)]) { rememberForFolder(state.contextId); changed = true; }
  if (changed) await persist();
}

module.exports = { activeContextId, selectContext, applyFolderContext, contextForSaving, createAndSelect, initContexts };
