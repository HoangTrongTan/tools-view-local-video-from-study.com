'use strict';

/** File ghi chú .md/.txt: trong thư mục khóa học hoặc file đã chọn qua hộp thoại. */

const path = require('node:path');
const { noteExts } = require('../config');
const { state } = require('../state/appState');
const { listFolderFiles } = require('./library');

/** Đường dẫn tuyệt đối (chữ thường) của các file ghi chú ngoài thư mục đã được chọn qua hộp thoại. */
const extraNotes = new Set();

const notes = () => listFolderFiles(noteExts);

function allowExtraNote(file) { extraNotes.add(path.resolve(file).toLowerCase()); }

function notePath(name) {
  if (typeof name === 'string' && path.isAbsolute(name)) {
    const resolved = path.resolve(name);
    if (!extraNotes.has(resolved.toLowerCase()) || !noteExts.has(path.extname(resolved).toLowerCase())) throw new Error('File ghi chú chưa được chọn qua hộp thoại.');
    return resolved;
  }
  if (!state.folder) throw new Error('Chưa chọn thư mục.');
  if (typeof name !== 'string' || !name || path.basename(name) !== name || !noteExts.has(path.extname(name).toLowerCase()) || /[<>:"|?*\u0000-\u001f]/.test(name)) throw new Error('Tên file ghi chú không hợp lệ (chỉ hỗ trợ .md hoặc .txt).');
  return path.join(state.folder, name);
}

module.exports = { notes, notePath, allowExtraNote };
