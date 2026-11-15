'use strict';

/** Đọc, sửa, tạo file ghi chú và mở bằng Notepad. */

const fsp = require('node:fs').promises;
const path = require('node:path');
const { spawn } = require('node:child_process');
const { noteExts } = require('../config');
const { json, readBody } = require('../http/response');
const { state, persist } = require('../state/appState');
const { notes, notePath, allowExtraNote } = require('../services/notes');
const { chooseNoteFile } = require('../services/windowsDialogs');

module.exports = [
  {
    method: 'GET', path: '/api/notes',
    async handler({ res }) {
      const picked = [];
      for (const item of state.pickedNotes || []) { try { await fsp.access(item); picked.push(item); } catch {} }
      return json(res, 200, { notes: await notes(), picked, last: state.lastNote || '' });
    }
  },
  {
    method: 'GET', path: '/api/note',
    async handler({ res, url }) {
      const file = notePath(url.searchParams.get('name'));
      const [content, stat] = await Promise.all([fsp.readFile(file, 'utf8'), fsp.stat(file)]);
      const requested = url.searchParams.get('name');
      if (state.lastNote !== requested) { state.lastNote = requested; await persist(); }
      return json(res, 200, { name: path.basename(file), content, mtime: stat.mtimeMs });
    }
  },
  {
    method: 'POST', path: '/api/note',
    async handler({ req, res }) {
      const body = await readBody(req, 4 * 1024 * 1024);
      const file = notePath(body.name);
      if (typeof body.content !== 'string') throw new Error('Nội dung ghi chú không hợp lệ.');
      let content = body.content;
      if (body.create) {
        try { await fsp.writeFile(file, content, { encoding: 'utf8', flag: 'wx' }); }
        catch (error) { if (error.code === 'EEXIST') throw new Error('File ghi chú này đã tồn tại.'); throw error; }
      } else {
        const [existing, stat] = await Promise.all([fsp.readFile(file, 'utf8'), fsp.stat(file)]);
        if (Number.isFinite(body.mtime) && Math.abs(stat.mtimeMs - body.mtime) > 1) throw new Error('File đã bị thay đổi bên ngoài. Hãy bấm Tải lại trước khi lưu để không mất dữ liệu.');
        if (existing.includes('\r\n')) content = content.replace(/\r?\n/g, '\r\n');
        await fsp.writeFile(file, content, 'utf8');
      }
      return json(res, 200, { ok: true, mtime: (await fsp.stat(file)).mtimeMs });
    }
  },
  {
    method: 'POST', path: '/api/note/choose',
    async handler({ res }) {
      const picked = await chooseNoteFile();
      if (!picked) return json(res, 200, { path: '' });
      const resolved = path.resolve(picked);
      if (!noteExts.has(path.extname(resolved).toLowerCase())) throw new Error('Chỉ hỗ trợ file .md hoặc .txt.');
      allowExtraNote(resolved);
      if (state.folder && path.dirname(resolved).toLowerCase() !== state.folder.toLowerCase() && !(state.pickedNotes || []).some(item => item.toLowerCase() === resolved.toLowerCase())) {
        state.pickedNotes = [...(state.pickedNotes || []), resolved].slice(-20);
        await persist();
      }
      return json(res, 200, { path: resolved, name: path.basename(resolved) });
    }
  },
  {
    method: 'POST', path: '/api/note/open',
    async handler({ req, res }) {
      if (process.platform !== 'win32') throw new Error('Mở Notepad chỉ hỗ trợ Windows.');
      const file = notePath((await readBody(req)).name);
      await fsp.access(file);
      const child = spawn('notepad.exe', [file], { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return json(res, 200, { ok: true });
    }
  }
];
