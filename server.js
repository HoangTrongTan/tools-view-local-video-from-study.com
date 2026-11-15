'use strict';

// Điểm khởi động (giữ ở gốc để "Mo hoc video.bat/.vbs" và `npm start` vẫn chạy như cũ).
// Mã nguồn server nằm trong src/, giao diện trong public/, dữ liệu trong data/.
require('./src/app').start().catch(error => {
  console.error('Không khởi động được Video tool:', error);
  process.exit(1);
});
