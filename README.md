# Góc học tập

Nhấp đúp `Mo hoc video.bat - Shortcut.lnk` để mở mà không hiện cửa sổ CMD (có thể sao chép lối tắt này ra Desktop). Chọn thư mục chứa MP4 và SRT, rồi xem bài. Tool nhớ thư mục, bài và thời điểm xem; video nằm trên máy. File `Mo hoc video.bat` vẫn dùng được nếu muốn xem lỗi khởi động trong cửa sổ CMD.

## Trắc nghiệm AI sau bài học

Tool đọc file phụ đề cùng tên video (`_vi.srt`, `.vi.srt` hoặc `.srt`) để tạo câu hỏi. Khi có API key, tool dùng Gemini `gemini-3.1-flash-lite`. AI tự chọn từ 3–20 câu theo độ khó và số ý cần kiểm tra của bài. Bấm **Trắc nghiệm bài này** để tạo câu hỏi. Sau khi xem hết video, phần trắc nghiệm tự mở.

Câu hỏi tô nổi bật từ khóa chính. Mỗi bài có thêm một câu vận dụng mở rộng liên quan nhưng không được dạy trực tiếp trong video; phần giải thích đánh dấu rõ kiến thức mở rộng. Sau khi chấm, câu sai có giải thích và tool tự tạo câu nhắc lại để bạn luyện tiếp. Bạn có thể bấm **Bài tiếp** khi xong.

## Bài tập cuối khóa

Bấm **Bài tập cuối khóa** trên thanh trên cùng, rồi **Tạo trang đầu tiên**. Tool chia mọi ý đã lưu sau khi chấm trắc nghiệm của từng bài thành các trang: tối đa 19 câu bám theo kiến thức đã học và một câu vận dụng mở rộng, tổng cộng tối đa 20 câu mỗi trang. Trang sau chỉ được tạo khi bạn mở đến, và đáp án đã chọn trên các trang được giữ trong phiên hiện tại. Câu hỏi đi từ khó đến mức senior, có thể về code hoặc lý thuyết tùy dữ kiện; tất cả vẫn là trắc nghiệm bốn đáp án. Hãy chấm các bài học trước để đề có đủ nội dung.

Để dùng Gemini nhanh hơn, tạo API key tại https://aistudio.google.com/apikey, tạo file `gemini-key.txt` trong thư mục tool, dán duy nhất API key vào file rồi lưu và mở lại tool. Khi có key, tool dùng Gemini thay Ollama; phụ đề và một phần kiến thức đã lưu sẽ được gửi đến Google để tạo câu hỏi. Không chia sẻ file key. App thử lần lượt `gemini-3.1-flash-lite`, `gemma-4-31b-it`, `gemini-3.6-flash`, `gemini-3-flash-preview`, `gemini-3.5-flash-lite`, `gemini-flash-latest`, `gemini-3.7-flash`, `gemini-2.5-flash` khi model đang dùng lỗi; model vừa hoạt động được ưu tiên ở các lần gọi tiếp theo. Có thể dùng biến môi trường `GEMINI_API_KEY` thay cho file; `GEMINI_MODEL` dùng để thêm model ưu tiên đầu danh sách. Xóa file key và biến môi trường để quay lại Ollama.

Khi không cấu hình Gemini, Ollama cần được cài trên Windows: https://ollama.com/download/windows. Tool gọi Ollama tại `127.0.0.1:11434`. Nếu muốn dùng model local khác, đặt biến môi trường `OLLAMA_MODEL` trước khi mở tool.

Sau khi chấm trắc nghiệm, tool lưu câu hỏi, đáp án đúng và giải thích vào `learning-context.json` ngay trong thư mục VideoLearningTool. File chia riêng kiến thức theo từng thư mục khóa học. Khi tạo trắc nghiệm bài mới, AI đọc một phần kiến thức gần đây, ưu tiên các câu đã trả lời sai để liên hệ và ôn lại nếu phù hợp. Bạn có thể sao lưu hoặc xóa file để bắt đầu lại. Nội dung lưu là kiến thức từ bài đã chấm, không phải đánh giá rằng bạn đã thuộc tất cả kiến thức đó.
