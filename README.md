# Góc học tập

Nhấp đúp `Mo hoc video.bat - Shortcut.lnk` để mở mà không hiện cửa sổ CMD (có thể sao chép lối tắt này ra Desktop). Chọn thư mục chứa MP4 và SRT, rồi xem bài. Tool nhớ thư mục, bài và thời điểm xem; video nằm trên máy. File `Mo hoc video.bat` vẫn dùng được nếu muốn xem lỗi khởi động trong cửa sổ CMD.

## Trắc nghiệm AI sau bài học

Tool dùng Ollama local và đọc file phụ đề cùng tên video (`_vi.srt`, `.vi.srt` hoặc `.srt`) để tạo câu hỏi. AI tự chọn từ 3–20 câu theo độ khó và số ý cần kiểm tra của bài. Bấm **Trắc nghiệm bài này** một lần: tool tự kết nối Ollama, tải model `qwen3:4b` nếu thiếu, rồi tạo câu hỏi. Lần đầu tải model khoảng 2,5 GB, nên có thể mất vài phút; các lần sau dùng model đã tải. Sau khi xem hết video, phần trắc nghiệm tự mở.

Câu hỏi tô nổi bật từ khóa chính. Sau khi chấm, câu sai có giải thích và tool tự tạo câu nhắc lại để bạn luyện tiếp. Bạn có thể bấm **Bài tiếp** khi xong.

Ollama cần được cài trên Windows: https://ollama.com/download/windows. Tool chỉ gọi Ollama tại `127.0.0.1:11434`; phụ đề không được gửi lên dịch vụ đám mây. Nếu muốn dùng model local khác, đặt biến môi trường `OLLAMA_MODEL` trước khi mở tool.

Sau khi chấm trắc nghiệm, tool lưu câu hỏi, đáp án đúng và giải thích vào `learning-context.json` ngay trong thư mục VideoLearningTool. File chia riêng kiến thức theo từng thư mục khóa học. Khi tạo trắc nghiệm bài mới, AI đọc một phần kiến thức gần đây, ưu tiên các câu đã trả lời sai để liên hệ và ôn lại nếu phù hợp. Bạn có thể sao lưu hoặc xóa file để bắt đầu lại. Nội dung lưu là kiến thức từ bài đã chấm, không phải đánh giá rằng bạn đã thuộc tất cả kiến thức đó.
