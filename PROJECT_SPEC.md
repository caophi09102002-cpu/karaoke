# 🎤 TÀI LIỆU ĐẶC TẢ DỰ ÁN & ROADMAP TÍNH NĂNG (PROJECT SPECIFICATION & ROADMAP)
> **Dự án:** Ứng dụng Karaoke Dual-Screen Thời gian thực (Real-time Dual-Screen Karaoke Platform)  
> **Cập nhật lần cuối:** 28/10/2026  
> **Tác giả:** caophi09102002-cpu  
> **Mục đích:** File tài liệu duy nhất lưu trữ kiến trúc, quy tắc phát triển bắt buộc, trạng thái tính năng (Đã làm - Đang làm - Sẽ làm) và sổ tay khắc phục lỗi nhằm đảm bảo tính nhất quán trong suốt vòng đời dự án.

---

## 📌 MỤC LỤC
1. [Kiến Trúc & Công Nghệ Cốt Lõi](#1-kiến-trúc--công-nghệ-cốt-lõi)
2. [Quy Tắc Phát Triển Bắt Buộc (Rules & Standards)](#2-quy-tắc-phát-triển-bắt-buộc-rules--standards)
3. [Trạng Thái Tính Năng (Feature Status Matrix)](#3-trạng-thái-tính-năng-feature-status-matrix)
   - [A. Đã Hoàn Thành (Completed - 100%)](#a-đã-hoàn-thành-completed---100)
   - [B. Đang Triển Khai / Tối Ưu Hóa (In Progress)](#b-đang-triển-khai--tối-ưu-hóa-in-progress)
   - [C. Kế Hoạch Tương Lai (Upcoming Roadmap & Backlog)](#c-kế-hoạch-tương-lai-upcoming-roadmap--backlog)
4. [Kế Hoạch Cho Tính Năng Đổi Tone & Tách Lời (Tone & Vocal Splitter)](#4-kế-hoạch-cho-tính-năng-đổi-tone--tách-lời-tone--vocal-splitter)
5. [Quy Chuẩn Sự Kiện Socket.IO (Event Specifications)](#5-quy-chuẩn-sự-kiện-socketio-event-specifications)
6. [Sổ Tay Khắc Phục Lỗi (Troubleshooting & FAQs)](#6-sổ-tay-khắc-phục-lỗi-troubleshooting--faqs)

---

## 1. Kiến Trúc & Công Nghệ Cốt Lõi

| Tầng công nghệ | Công nghệ sử dụng | Mục đích & Chi tiết triển khai |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router)** | Giao diện React 19, tối ưu hóa tải trang, Server & Client Components. |
| **Styling** | **Tailwind CSS v4** | Hệ thống utility classes hiện đại, responsive hoàn toàn trên Mobile & TV. |
| **Icons** | **Lucide React** | Bộ icon đồng bộ, chuẩn kích thước và visual states. |
| **Real-time Engine** | **Socket.IO + Custom Node Server (`server.ts`)** | Đồng bộ 2 chiều tức thì (<35ms RTT) giữa TV Host và nhiều Controller cùng lúc. |
| **State Storage** | **RAM Server + LocalStorage** | RAM lưu trữ các phòng đang hát (`RoomManager`), `localStorage` lưu bài tủ và danh sách TV của từng người dùng. |
| **Video Player** | **YouTube IFrame Player (`react-youtube`)** | Phát trực tiếp video, nhạc nền beat và lời bài hát từ YouTube. |
| **Audio Engine** | **Web Audio API + SoundTouchJS** | Nền tảng xử lý âm thanh DSP sẵn sàng cho Tone Transposition và Vocal Separation. |
| **Mobile Tools** | **html5-qrcode & qrcode.react** | Sinh mã QR động chứa IP LAN/Domain và quét mã trực tiếp bằng camera điện thoại. |

---

## 2. Quy Tắc Phát Triển Bắt Buộc (Rules & Standards)

Mọi lập trình viên hoặc AI Agent khi tham gia phát triển dự án này **BẮT BUỘC** phải tuân thủ các nguyên tắc sau:

### 2.1. Quy tắc Next.js 16 App Router
1. **Dynamic Routes & `<React.Suspense>`**:
   - Bất kỳ trang nào sử dụng tham số động từ URL (như `params.roomId` trong `/room/[roomId]/...`) hoặc truy cập dữ liệu thời gian thực **bắt buộc phải được bọc trong `<React.Suspense fallback={...}>`**.
   - *Lý do:* Tránh lỗi ngắt quãng build tĩnh (`digest: NEXT_PRERENDER_INTERRUPTED`) khi biên dịch trên Linux/Render.
2. **Cấu hình `next.config.ts` ổn định**:
   - Không bật tùy tiện các cờ thử nghiệm không tương thích như `cacheComponents` hay `partialPrefetching` khi sử dụng các API route nhận `request.url`.

### 2.2. Quy tắc Server & Deployment
1. **Thư viện Runtime `tsx`**:
   - `tsx` phải nằm trong mục **`dependencies`** chính của `package.json` (không để trong `devDependencies`).
   - *Lý do:* Khi chạy lệnh `npm run start` trên môi trường Production (như Render, Railway), hệ thống sẽ chạy `NODE_ENV=production tsx server.ts`. Nếu để ở `devDependencies`, lệnh start sẽ báo lỗi `tsx: command not found`.
2. **Cổng mạng & Khả năng lắng nghe**:
   - Server bắt buộc lắng nghe trên `0.0.0.0` (thông qua biến `HOSTNAME || "0.0.0.0"`) và `PORT` do nền tảng Cloud cung cấp để các thiết bị khác trong mạng kết nối được.

### 2.3. Quy chuẩn Đặt tên Khóa Lưu Trữ (`localStorage`)
Để tránh xung đột dữ liệu giữa các phiên bản, các key trong trình duyệt người dùng được quy định thống nhất:
- `karaoke_user_id`: Định danh ẩn danh duy nhất của người dùng trên điện thoại.
- `karaoke_user_name`: Biệt danh hiển thị của người dùng (mặc định: "Khách hát").
- `karaoke_favorites`: Danh sách bài tủ yêu thích (mảng JSON các đối tượng bài hát).
- `karaoke_recent_devices`: Lịch sử các TV đã từng kết nối (mã phòng, tên TV, thời gian kết nối).
- `karaoke_last_room_id`: Mã phòng kết nối gần nhất.
- `karaoke_admin_pin_[roomId]`: Mã PIN quản trị đã xác thực để tự động khôi phục quyền Chủ phòng khi reload.

---

## 3. Trạng Thái Tính Năng (Feature Status Matrix)

### A. ĐÃ HOÀN THÀNH (Completed - 100%)

#### 1. Màn hình TV Host (`/room/[roomId]/host`):
- [x] Tạo phòng ngẫu nhiên và quản lý vòng đời phòng trong RAM máy chủ.
- [x] Tự động hiển thị mã phòng to rõ, mã PIN quản trị ngẫu nhiên 4 chữ số.
- [x] Sinh mã QR chứa link kết nối mạng nội bộ (LAN IP) hoặc link Cloud Tunnel tự động.
- [x] Trình phát video YouTube tự động phát bài tiếp theo khi kết thúc bài hiện tại (`onEnded`).
- [x] Hiển thị danh sách Controllers đang trực tuyến trong phòng.
- [x] Bảng hiển thị thông tin bài hát đang phát và hàng đợi sắp tới.
- [x] Hiệu ứng Danmaku: Chữ bình luận/chúc mừng bay ngang qua màn hình TV.
- [x] Hiệu ứng âm thanh tổng hợp & hạt emoji tương tác: Vỗ tay 👏, Pháo hoa 🎉, Thả tim 💖, Huýt sáo 📣.

#### 2. Màn hình Controller Điện thoại (`/controller` & `/room/[roomId]/controller`):
- [x] **Tìm kiếm thông minh:** Tìm bài hát YouTube với bộ lọc tiếng Việt, tự động thêm hậu tố Beat Karaoke.
- [x] **Mở rộng từ viết tắt (Acronym Matching):** Gõ tắt tên bài (vd: `cdns` -> Cắt Đôi Nỗi Sầu, `nhnt` -> Nơi Này Có Anh...).
- [x] **Gợi ý tìm kiếm (Search Autocomplete / Suggestions Dropdown):**
  - Tích hợp API trung gian `/api/search/suggestions`.
  - Cơ chế Debounce 280ms chống spam gọi API.
  - Dropdown popover phân loại icon nhạc/kính lúp, bôi đậm từ khóa khớp, nút điền nhanh và hỗ trợ bàn phím đầy đủ.
- [x] **Quản lý hàng đợi (Queue):** Thêm bài vào hàng đợi, nút "Ưu tiên" hát ngay bài kế tiếp, xóa bài khỏi danh sách.
- [x] **Thanh tua bài từ xa (Remote KaraokeSeekBar):** Kéo thả tua video trực tiếp từ điện thoại tới TV theo thời gian thực.
- [x] **Soundboard & Tương tác Danmaku:** Bàn phím bắn chữ lên TV kèm các nút reo hò.
- [x] **Bài tủ cá nhân (Favorites):** Lưu trữ bài hát yêu thích không giới hạn vào bộ nhớ điện thoại.
- [x] **Phân quyền Chủ phòng (VIP Host vs Khách hát):** Nhập mã PIN 4 số trên TV để mở khóa quyền điều khiển tối cao (Tua bài, Play/Pause/Skip, đổi Tone).
- [x] **Nút & Modal "Phát trên TV" (`<CastButton />` & `<CastDeviceModal />`):**
  - Đặt tại 3 vị trí: Header, bên cạnh Play/Pause ở Mini Player Bar, và Tab Bottom Navigation.
  - 3 trạng thái visual: `disconnected`, `connecting` (sóng nhấp nháy), `connected` (xanh ngọc + đèn online + tooltip).
  - Nhập mã PIN 6 ô tự động nhảy focus.
  - Quét mã QR bằng Camera thật (`html5-qrcode`).
  - Lịch sử TV kết nối gần đây, cho phép đổi tên thân thiện (vd: "TV Phòng Khách").
  - Đo độ trễ thời gian thực (**Ping**: ~15 - 35ms).
  - Tùy chọn Presentation API / Google Cast.
- [x] **Trang Controller Standalone (`/controller`):** Hoạt động độc lập khi chưa kết nối phòng, cho phép chuẩn bị danh sách bài hát trước khi kết nối TV.

#### 3. Hạ tầng & Triển khai Cloud:
- [x] Quản lý mã nguồn qua Git và đồng bộ tự động lên GitHub: `caophi09102002-cpu/karaoke`.
- [x] Tích hợp Live HTTPS Tunnel phục vụ test nhanh qua 4G/5G từ xa.
- [x] Triển khai thành công Web Service trên nền tảng Cloud **Render**.

---

### B. ĐANG TRIỂN KHAI / TỐI ƯU HÓA (In Progress)

- [ ] **Tự động Reconnect thông minh:** Khi thiết bị di động bị khóa màn hình hoặc chuyển ứng dụng, tự động kết nối lại Socket và phục hồi vai trò Chủ phòng mà không cần tải lại trang.
- [ ] **Tối ưu hóa UI Tablet / iPad:** Bổ sung giao diện 2 cột dành cho máy tính bảng chọn bài (dạng màn hình cảm ứng phòng Karaoke dịch vụ).
- [ ] **Giám sát tải RAM Server:** Cập nhật cơ chế dọn dẹp các phòng không có hoạt động quá 2 giờ.

---

### C. KẾ HOẠCH TƯƠNG LAI (Upcoming Roadmap & Backlog)

1. **Tách lời & Đổi Tone bài hát (Vocal Cut & Pitch Shifting)**: *(Chi tiết tại Phần 4 bên dưới - Để làm sau theo yêu cầu).*
2. **Chấm điểm giọng hát (Vocal Pitch Scoring)**:
   - Sử dụng Micro điện thoại thu âm giọng hát người dùng.
   - Phân tích tần số nốt (F0 Pitch Detection qua thuật toán YIN / Web Audio API) và so sánh với cao độ chuẩn của ca sĩ để chấm điểm vui nhộn (80đ, 95đ, 100đ!).
3. **Ghi âm & Tải về bài hát (Audio Recording & Share)**:
   - Cho phép người hát bấm nút ghi âm trực tiếp, xuất file MP3 lưu về điện thoại làm kỷ niệm hoặc chia sẻ lên Zalo/Facebook.
4. **Kho bài hát tuyển chọn theo chủ đề (Curated Playlists)**:
   - Phân loại danh mục bài hát có sẵn: *Karaoke Nhạc Trẻ Hot Tik Tok*, *Bolero Trữ Tình*, *Nhạc Vàng*, *Nhạc Tết*, *Remix Sôi Động*.
5. **Chế độ tiệc chống chiếm Mic (Fair Play / Anti-Spam Mode)**:
   - Giới hạn mỗi người dùng chỉ được đặt tối đa 2 bài liên tiếp để mọi người trong phòng đều có lượt hát công bằng.
6. **Tìm kiếm bài hát bằng giọng nói (Voice Search)**:
   - Bấm vào biểu tượng micro trên ô tìm kiếm để nói tên bài hát thay vì phải gõ phím.

---

## 4. Kế Hoạch Cho Tính Năng Đổi Tone & Tách Lời (Tone & Vocal Splitter)

> ⚠️ **Ghi chú quyết định:** Tính năng này **được tạm hoãn để làm sau** theo yêu cầu của bạn. Tài liệu này lưu trữ sẵn giải pháp kỹ thuật để kích hoạt ngay khi cần.

### 4.1. Hiện trạng:
- File xử lý [src/lib/karaoke-audio-processor.ts](file:///d:/Nghi%C3%AAn%20c%E1%BB%A9u/App%20KARAOKE/src/lib/karaoke-audio-processor.ts) đã có sẵn thuật toán Web Audio DSP (Granular Delay Pitch Shifter và Channel Splitter).
- Do video phát qua IFrame YouTube của Google bị chặn bảo mật CORS của trình duyệt, mã Javascript ngoài trang không thể can thiệp trực tiếp vào âm thanh của IFrame nếu không có nguồn stream trung gian.

### 4.2. Phương án triển khai khi quay lại thực hiện:
* **Phương án A - Backend Audio Stream Proxy (Khuyên dùng):**
  - Xây dựng 1 API endpoint backend `/api/audio-stream?id=...` sử dụng công cụ bóc tách stream âm thanh YouTube.
  - Phía TV Host: Render thẻ `<audio crossorigin="anonymous" src="/api/audio-stream?id=...">` chạy đồng bộ với video hình ảnh.
  - Đấu nối thẻ `<audio>` vào `KaraokeAudioProcessor`. Khi đó, toàn bộ nút Tone `[-4] đến [+4]` và nút Beat/Ca sĩ trên điện thoại sẽ tác động vật lý lên âm thanh phát ra loa 100%!
* **Phương án B - Smart Tone Match (Tự nhiên nhất, không tốn tài nguyên):**
  - Khi người dùng bấm chọn "Tone Nữ" hoặc "Tone Nam", hệ thống tự động tìm kiếm bản phối tương ứng trên YouTube và chuyển bài mà không cần xử lý thuật toán phức tạp.

---

## 5. Quy Chuẩn Sự Kiện Socket.IO (Event Specifications)

| Tên sự kiện | Chiều truyền | Dữ liệu kèm theo | Tác dụng |
| :--- | :---: | :--- | :--- |
| `client:join-room` | Client ➔ Server | `{ roomId, role, nickname, userId, pin }` | Gia nhập phòng hát với vai trò Host hoặc Controller. |
| `room-joined` | Server ➔ Client | `{ success, room, role, controllerRole, hostPin }` | Xác nhận gia nhập thành công. |
| `server:sync-state` | Server ➔ Room | `{ roomId, currentSong, queue, isPlaying, controllersCount... }` | Đồng bộ toàn bộ trạng thái phòng khi có thay đổi. |
| `client:control` | Client ➔ Server | `{ roomId, action: 'play'\|'pause'\|'skip'..., userId }` | Điều khiển phát nhạc từ xa (Yêu cầu quyền Chủ phòng). |
| `client:add-queue` | Client ➔ Server | `{ roomId, song, isPriority, requestedBy }` | Thêm bài hát vào danh sách chờ hoặc ưu tiên lên đầu. |
| `client:seek-to` | Client ➔ Server | `{ roomId, targetTime }` | Lệnh tua video từ xa từ thanh SeekBar. |
| `client:send-reaction`| Client ➔ Server | `{ roomId, type: 'text'\|'emoji', content, senderName }` | Gửi hiệu ứng tương tác / chữ Danmaku bay lên TV. |
| `client:claim-admin` | Client ➔ Server | `{ roomId, pin, userId }` | Nhập mã PIN 4 số để nâng quyền thành Chủ phòng VIP. |
| `client:leave-room` | Client ➔ Server | `{ roomId }` | Ngắt kết nối và rời khỏi phòng hiện tại. |
| `ping` / `pong` | Hai chiều | `{ timestamp }` ➔ `{ latencyMs }` | Đo độ trễ kết nối thời gian thực. |

---

## 6. Sổ Tay Khắc Phục Lỗi (Troubleshooting & FAQs)

### 6.1. Điện thoại không kết nối được vào máy tính khi test nội bộ
* **Nguyên nhân:** Mạng Wi-Fi của Windows đang ở chế độ `Public network`, Tường lửa Windows Defender tự động chặn các thiết bị khác kết nối vào cổng `3000`.
* **Cách khắc phục:**
  1. Vào *Windows Settings -> Network & internet -> Wi-Fi -> bấm vào tên Wi-Fi đang kết nối -> Đổi sang **Private network***.
  2. Hoặc mở PowerShell với quyền Administrator chạy lệnh mở cổng:
     ```powershell
     netsh advfirewall firewall add rule name="Karaoke 3000" dir=in action=allow protocol=TCP localport=3000
     ```

### 6.2. Lỗi Render Deploy thất bại (Next.js 16 Dynamic Route Interrupted)
* **Nguyên nhân:** Next.js 16 biên dịch tĩnh (prerender) bị lỗi khi gặp dynamic route không có Suspense boundary.
* **Cách khắc phục:**
  - Luôn đảm bảo các component sử dụng `params` được bọc bên trong `<React.Suspense fallback={...}>`.

### 6.3. Lỗi Git 403 Permission Denied khi Push lên GitHub
* **Nguyên nhân:** Máy tính lưu thông tin đăng nhập của một tài khoản GitHub khác trong *Windows Credential Manager*.
* **Cách khắc phục:**
  - Sử dụng GitHub Personal Access Token (Classic) có tích chọn quyền **`repo`**.
  - Đẩy code bằng lệnh: `git -c credential.helper= push origin main`.
