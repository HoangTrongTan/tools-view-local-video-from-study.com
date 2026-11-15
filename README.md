# Góc học tập

Nhấp đúp `Mo hoc video.bat - Shortcut.lnk` để mở mà không hiện cửa sổ CMD (có thể sao chép lối tắt này ra Desktop). Chọn thư mục chứa MP4 và SRT, rồi xem bài. Tool nhớ thư mục, bài và thời điểm xem; video nằm trên máy. File `Mo hoc video.bat` vẫn dùng được nếu muốn xem lỗi khởi động trong cửa sổ CMD.

## Trắc nghiệm AI sau bài học

Tool đọc file phụ đề cùng tên video (`_vi.srt`, `.vi.srt` hoặc `.srt`) để tạo câu hỏi. Khi có API key, tool dùng Gemini và các model dự phòng đã cấu hình. App ấn định số câu cho bài hiện tại theo độ dài phụ đề và số ý tóm tắt, rồi yêu cầu AI trả đúng số câu đó trong một object JSON `{"questions":[...]}`; bài có thêm một câu mở rộng và, khi đủ dữ liệu, ba câu ôn bài cũ (tối đa 20 câu tổng cộng). Bấm **Trắc nghiệm bài này** để tạo câu hỏi. Sau khi xem hết video, phần trắc nghiệm tự mở.

Câu hỏi tô nổi bật từ khóa chính. Mỗi bài có thêm một câu vận dụng mở rộng liên quan nhưng không được dạy trực tiếp trong video; phần giải thích đánh dấu rõ kiến thức mở rộng. Sau khi chấm, câu sai có giải thích và tool tự tạo câu nhắc lại để bạn luyện tiếp. Bạn có thể bấm **Bài tiếp** khi xong.

Trong danh sách bài học và danh sách ở chế độ toàn màn hình, video đã chấm trắc nghiệm và lưu kiến thức có dấu **✓ Đã làm**. Dấu này được giữ khi mở lại app và tách theo từng thư mục khóa học.

Nếu tất cả model đều lỗi, tab Trắc nghiệm hiện mục **Tạo bằng AI khác**. Bấm **Copy prompt**, dán vào AI bạn dùng, rồi dán JSON câu hỏi trả về vào app và bấm **Nhập bài tập**. App kiểm tra định dạng, hiển thị đề và vẫn lưu kiến thức sau khi chấm như bình thường. Mỗi lần gọi Gemini được ghi vào `data/logs/ai-debug.jsonl` và in ra console server, gồm thời gian, tên model, mã HTTP và toàn bộ phản hồi hoặc lý do lỗi; file này không được đưa vào Git và API key được che nếu vô tình xuất hiện trong phản hồi. Mở bằng `Mo hoc video.bat` để thấy console trực tiếp.

Khi dùng AI ngoài, hãy copy **toàn bộ JSON thô** từ `{` đầu đến `}` cuối. Prompt yêu cầu không dùng dấu `\` nối dòng, mã HTML như `&#x20;` hoặc lời dẫn. Ô nhập tự bỏ các dấu nối dòng và mã khoảng trắng thường gặp, nhưng JSON bị cắt dở vẫn cần lấy lại phần còn thiếu.

## Bài tập cuối khóa

Bấm **Bài tập cuối khóa** trên thanh trên cùng, rồi **Tạo trang đầu tiên**. Tool chia mọi ý đã lưu sau khi chấm trắc nghiệm của từng bài thành các trang: tối đa 19 câu bám theo kiến thức đã học và một câu vận dụng mở rộng, tổng cộng tối đa 20 câu mỗi trang. Trang sau chỉ được tạo khi bạn mở đến, và đáp án đã chọn trên các trang được giữ trong phiên hiện tại. Câu hỏi đi từ khó đến mức senior, có thể về code hoặc lý thuyết tùy dữ kiện; tất cả vẫn là trắc nghiệm bốn đáp án. Hãy chấm các bài học trước để đề có đủ nội dung.

Để dùng Gemini nhanh hơn, tạo API key tại https://aistudio.google.com/apikey, tạo file `gemini-key.txt` trong thư mục tool, dán duy nhất API key vào file rồi lưu và mở lại tool. Khi có key, tool dùng Gemini thay Ollama; phụ đề và một phần kiến thức đã lưu sẽ được gửi đến Google để tạo câu hỏi. Không chia sẻ file key. App thử lần lượt `gemini-3.1-flash-lite`, `gemma-4-31b-it`, `gemini-3.6-flash`, `gemini-3-flash-preview`, `gemini-3.5-flash-lite`, `gemini-flash-latest`, `gemini-3.7-flash`, `gemini-2.5-flash` khi model đang dùng lỗi; model vừa hoạt động được ưu tiên ở các lần gọi tiếp theo. Có thể dùng biến môi trường `GEMINI_API_KEY` thay cho file; `GEMINI_MODEL` dùng để thêm model ưu tiên đầu danh sách. Xóa file key và biến môi trường để quay lại Ollama.

Khi không cấu hình Gemini, Ollama cần được cài trên Windows: https://ollama.com/download/windows. Tool gọi Ollama tại `127.0.0.1:11434`. Nếu muốn dùng model local khác, đặt biến môi trường `OLLAMA_MODEL` trước khi mở tool.

## Bộ kiến thức (learning context)

Mỗi môn học / chủ đề có một **bộ kiến thức** riêng, lưu thành một file trong `data/contexts/<id>.json` với tên, loại (`type`), mô tả, thời điểm tạo (`createdAt`) và chỉnh sửa cuối (`updatedAt`). Trên thanh trên cùng, ô **Kiến thức** cho chọn bộ đang dùng; nút **＋** tạo bộ mới (tự chọn luôn), nút **✎** đổi tên, loại hoặc mô tả.

Sau khi chấm trắc nghiệm, tool lưu câu hỏi, đáp án đúng và giải thích vào bộ kiến thức đang chọn, chia theo từng thư mục khóa học. Khi tạo trắc nghiệm bài mới, AI chỉ đọc kiến thức của bộ đang chọn (một phần kiến thức gần đây và 3 ý để ôn tập, ưu tiên câu đã trả lời sai), nên các môn khác không làm prompt dài thêm. Dấu **✓ Đã làm** và **Bài tập cuối khóa** dùng kiến thức của thư mục hiện tại trong bộ đang chọn. Tool nhớ bộ kiến thức đã dùng cho từng thư mục: mở lại thư mục nào thì tự chọn lại bộ của thư mục đó. Nếu chưa có bộ nào, lần chấm bài đầu tiên tự tạo một bộ theo tên thư mục.

File `learning-context.json` cũ (một file chung) được tự chuyển thành một bộ kiến thức ở lần chạy đầu tiên, rồi chuyển vào `data/legacy/` để sao lưu. Nội dung lưu là kiến thức từ bài đã chấm, không phải đánh giá rằng bạn đã thuộc tất cả kiến thức đó.

## Cấu trúc thư mục

```
server.js                 Điểm khởi động (bat/vbs và npm start gọi file này)
src/
  app.js                  Tạo HTTP server, router, khởi động
  config.js               Cổng, đường dẫn, cấu hình Gemini/Ollama
  http/response.js        Trả JSON, đọc body, gửi file
  state/appState.js       Tiến độ học (data/progress.json)
  routes/                 system, notes, contexts, quiz, courseExam, media
  services/
    library.js            Thư mục khóa học, video, phụ đề
    notes.js, media.js, transcript.js, windowsDialogs.js
    knowledge/            contextStore (file bộ kiến thức), selection (bộ đang chọn), lessonFacts (dữ liệu cho prompt)
    ai/                   provider (Gemini/Ollama), quizFormat, aiLog
    quiz/                 quizService (trắc nghiệm, câu nhắc lại), courseExam
  utils/fsAtomic.js       Ghi file an toàn, hàng đợi ghi
public/                   Giao diện: index.html, app.js, style.css, favicon.ico
data/
  progress.json           Thư mục, bài và thời điểm đang xem
  contexts/*.json         Các bộ kiến thức
  logs/, legacy/          Log AI và bản sao lưu (không đưa vào Git)
```
