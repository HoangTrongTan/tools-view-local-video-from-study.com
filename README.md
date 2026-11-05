# Góc học tập

Nhấp đúp `Mo hoc video.bat - Shortcut.lnk` để mở mà không hiện cửa sổ CMD (có thể sao chép lối tắt này ra Desktop). Chọn thư mục chứa MP4 và SRT, rồi xem bài. Tool nhớ thư mục, bài và thời điểm xem; video nằm trên máy. File `Mo hoc video.bat` vẫn dùng được nếu muốn xem lỗi khởi động trong cửa sổ CMD.

## Trắc nghiệm AI sau bài học

Tool đọc file phụ đề cùng tên video (`_vi.srt`, `.vi.srt` hoặc `.srt`) để tạo câu hỏi. Khi có API key, tool dùng Gemini `gemini-3.1-flash-lite`. AI tự chọn từ 3–20 câu theo độ khó và số ý cần kiểm tra của bài. Bấm **Trắc nghiệm bài này** để tạo câu hỏi. Sau khi xem hết video, phần trắc nghiệm tự mở.

Câu hỏi tô nổi bật từ khóa chính. Sau khi chấm, câu sai có giải thích và tool tự tạo câu nhắc lại để bạn luyện tiếp. Bạn có thể bấm **Bài tiếp** khi xong.

## Bài tập cuối khóa

Bấm **Bài tập cuối khóa** trên thanh trên cùng, rồi **Tạo đề tổng hợp**. Tool đọc mọi ý đã lưu sau khi chấm trắc nghiệm của từng bài trong thư mục khóa học, tạo một câu trắc nghiệm khó cho mỗi ý và chấm toàn bộ đề. Các chủ đề như OOP, SOLID, DDD và kiến trúc chỉ được hỏi khi có dữ kiện tương ứng trong kiến thức đã lưu. Không có bài viết code hay câu tự luận. Khóa nhiều bài có thể mất vài phút để tạo đề. Hãy chấm các bài học trước để đề có đủ nội dung.

Để dùng Gemini nhanh hơn, tạo API key tại https://aistudio.google.com/apikey, tạo file `gemini-key.txt` trong thư mục tool, dán duy nhất API key vào file rồi lưu và mở lại tool. Khi có key, tool dùng Gemini thay Ollama; phụ đề và một phần kiến thức đã lưu sẽ được gửi đến Google để tạo câu hỏi. Không chia sẻ file key. Có thể dùng biến môi trường `GEMINI_API_KEY` thay cho file; `GEMINI_MODEL` dùng để đổi model (mặc định `gemini-3.1-flash-lite`). Xóa file key và biến môi trường để quay lại Ollama.

Khi không cấu hình Gemini, Ollama cần được cài trên Windows: https://ollama.com/download/windows. Tool gọi Ollama tại `127.0.0.1:11434`. Nếu muốn dùng model local khác, đặt biến môi trường `OLLAMA_MODEL` trước khi mở tool.

Sau khi chấm trắc nghiệm, tool lưu câu hỏi, đáp án đúng và giải thích vào `learning-context.json` ngay trong thư mục VideoLearningTool. File chia riêng kiến thức theo từng thư mục khóa học. Khi tạo trắc nghiệm bài mới, AI đọc một phần kiến thức gần đây, ưu tiên các câu đã trả lời sai để liên hệ và ôn lại nếu phù hợp. Bạn có thể sao lưu hoặc xóa file để bắt đầu lại. Nội dung lưu là kiến thức từ bài đã chấm, không phải đánh giá rằng bạn đã thuộc tất cả kiến thức đó.
