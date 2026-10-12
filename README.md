# 🎬 Alconost Studio Video Automation Tool

Hệ thống tự động hoá tạo và tải video hàng loạt từ [Alconost Studio](https://studio.alconost.com) theo danh sách Prompt, URL sản phẩm, Tỉ lệ video (Aspect Ratio) và Ngôn ngữ (Language).

---

## 🌟 Tính Năng Nổi Bật

1. **Quản Lý Hàng Đợi (Queue System)**:
   - Thêm từng task hoặc nhập hàng loạt từ file Excel (`.xlsx`, `.csv`).
   - Xử lý tuần tự từng task: Mở session, gửi prompt, chờ AI render video, tự động tải file `.mp4` về máy.
   - Trạng thái trực quan: Chờ chạy (Pending), Đang tạo (Running), Hoàn thành (Completed), Thất bại (Failed).

2. **Bộ Sinh Biến Thể Tự Động (Variant Generator)**:
   - Chỉ cần nhập 1 URL + 1 Prompt cơ bản, chọn các tỉ lệ (9:16, 16:9, 1:1, 4:5) và ngôn ngữ (Tiếng Việt, Tiếng Anh, Tiếng Nhật, v.v.).
   - Tool tự động nhân bản ra đầy đủ các biến thể vào Queue chỉ với 1 click!

3. **Vượt Rào Đăng Nhập Google (Google Sign-In Bypass)**:
   - Tích hợp sẵn nút **"Mở Chrome Đăng Nhập"** sử dụng trình duyệt Chrome thật cùng profile lưu trữ vĩnh viễn (`chrome_user_data`).
   - Bạn chỉ cần đăng nhập Google 1 lần duy nhất, các lần chạy sau không bao giờ bị hỏi lại và không bị Google chặn bot!

4. **Tự Động Bắt Link & Tải Video MP4**:
   - Tự động bắt link Cloudflare R2 / CDN `.mp4` trực tiếp từ network và DOM.
   - Tự động tải video lưu vào thư mục `output/videos/[Task_ID]_[Ten_San_Pham]_[Ti_Le].mp4`.
   - Lưu kèm kịch bản phân cảnh và phản hồi từ AI vào file `[Task_ID]_info.json`.

5. **Giao Diện Web Dashboard Thời Gian Thực**:
   - Truy cập tại `http://localhost:3000`.
   - Kết nối WebSocket cập nhật log và tiến độ từng giây.
   - Tích hợp video player xem trước và nút mở thư mục lưu video trong máy tính.
   - Xuất báo cáo tổng kết ra file Excel (`.xlsx`).

---

## 🚀 Hướng Dẫn Sử Dụng

### Bước 1: Khởi động Tool
- **Trên Windows**: Nhấp đúp vào file **`run.bat`** (hoặc mở PowerShell / CMD gõ `npm start`).
- **Trên macOS**:
  - **Cách 1 (Nhấp đúp chuột)**: Nhấp đúp vào file **`run_mac.command`** trong Finder (lần đầu tiên nếu máy hỏi phân quyền, bạn mở Terminal gõ `chmod +x run_mac.command`).
  - **Cách 2 (Terminal)**: Mở Terminal tại thư mục này và gõ `./run.sh` hoặc `npm start`.
- Trình duyệt sẽ tự động mở giao diện tại: **`http://localhost:3000`**.

### Bước 2: Đăng nhập Google (Chỉ cần làm 1 lần đầu)
1. Trên thanh điều hướng đầu trang, nhấn nút **"Mở Chrome Đăng Nhập"**.
2. Một cửa sổ Google Chrome sẽ mở ra trang Alconost Studio.
3. Bấm **"Continue with Google"** và đăng nhập tài khoản của bạn.
4. Sau khi đăng nhập thành công, giao diện sẽ hiển thị badge xanh: `Đã đăng nhập Google (phamg2944)`.

### Bước 3: Thêm Task hoặc Sinh Biến Thể
- **Cách 1 (Sinh biến thể hàng loạt)**: Bấm nút **"Sinh Biến Thể Hàng Loạt"**, điền URL sản phẩm, prompt gốc, tích chọn các tỉ lệ video (9:16, 16:9...) và các ngôn ngữ (English, Tiếng Việt...), bấm xác nhận.
- **Cách 2 (Nhập file Excel)**: Bấm **"Tải File Mẫu"** để lấy mẫu chuẩn, điền danh sách sản phẩm rồi bấm **"Nhập Excel"**.
- **Cách 3 (Thêm lẻ)**: Bấm **"Thêm Task Lẻ"** để nhập thủ công từng video.

### Bước 4: Chạy Queue & Lấy Video
1. Bấm nút màu xanh **"Bắt Đầu Chạy Queue"**.
2. Tool sẽ tự động:
   - Mở session Alconost Studio tương ứng (hoặc tạo session mới).
   - Điền prompt và gửi cho AI.
   - Theo dõi tiến trình render.
   - Bắt link video `.mp4` và tải về thư mục `output/videos/`.
3. Bấm nút **"Thư Mục Video"** để mở ngay thư mục chứa video trên máy tính của bạn.

---

## 📁 Cấu Trúc Thư Mục

```
tool_crawl_alconost/
├── run.bat                 # Phím tắt khởi động 1-click trên Windows
├── server.js               # Máy chủ Express + WebSocket Backend
├── config.js               # File cấu hình (port, timeout, prompt template)
├── engine/
│   ├── browser.js          # Quản lý trình duyệt Chrome & chống chặn Google
│   ├── alconost.js         # Tự động hoá session, gửi prompt, bắt video
│   └── downloader.js       # Tải video stream tốc độ cao
├── queue/
│   ├── queueManager.js     # Bộ điều phối hàng đợi (Queue State Machine)
│   └── storage.js          # Lưu trữ JSON & Import/Export Excel
├── public/                 # Giao diện Web Dashboard
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── output/
│   └── videos/             # Thư mục lưu các file video .mp4 đã tải về
├── chrome_user_data/       # Profile Chrome lưu đăng nhập Google
└── data/                   # Dữ liệu queue.json và settings
```

