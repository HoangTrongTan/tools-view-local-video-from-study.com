# Góc học tập

Nhấp đúp `Mo hoc video.bat` (có thể sao chép file này ra Desktop), chọn thư mục chứa MP4 và SRT, rồi xem bài. Tool nhớ thư mục, bài và thời điểm xem; video nằm trên máy.

## Trắc nghiệm AI sau bài học

Tool dùng Ollama local và đọc file phụ đề cùng tên video (`_vi.srt`, `.vi.srt` hoặc `.srt`) để tạo câu hỏi. Số câu thay đổi theo nội dung bài. Bấm **Trắc nghiệm bài này** một lần: tool tự kết nối Ollama, tải model `qwen3:4b` nếu thiếu, rồi tạo câu hỏi. Lần đầu tải model khoảng 2,5 GB, nên có thể mất vài phút; các lần sau dùng model đã tải. Sau khi xem hết video, phần trắc nghiệm tự mở.

Câu hỏi tô nổi bật từ khóa chính. Sau khi chấm, câu sai có giải thích và tool tự tạo câu nhắc lại để bạn luyện tiếp. Bạn có thể bấm **Bài tiếp** khi xong.

Ollama cần được cài trên Windows: https://ollama.com/download/windows. Tool chỉ gọi Ollama tại `127.0.0.1:11434`; phụ đề không được gửi lên dịch vụ đám mây. Nếu muốn dùng model local khác, đặt biến môi trường `OLLAMA_MODEL` trước khi mở tool.
