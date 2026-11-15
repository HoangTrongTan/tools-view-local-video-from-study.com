'use strict';

const fsp = require('node:fs').promises;

/** Ghi file qua file tạm rồi đổi tên để không bao giờ để lại JSON ghi dở. */
async function writeJsonAtomic(file, data) {
  const temporary = file + '.tmp';
  await fsp.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(temporary, file);
}

/** Hàng đợi tuần tự: mỗi tác vụ chỉ chạy khi tác vụ trước đã xong (kể cả khi lỗi). */
function createQueue() {
  let tail = Promise.resolve();
  return task => {
    const work = tail.catch(() => {}).then(task);
    tail = work;
    return work;
  };
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

module.exports = { writeJsonAtomic, createQueue, byName };
