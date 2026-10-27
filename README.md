# App KARAOKE - Next.js & Socket.IO Real-time Architecture

Dự án Next.js (App Router) với TypeScript và Tailwind CSS, tích hợp **Custom Server (`server.ts`)** cùng **Socket.IO** để phục vụ ứng dụng Karaoke thời gian thực.

---

## 1. Cấu trúc Dự án

```
d:/Nghiên cứu/App KARAOKE/
├── server.ts                  # Custom Server tích hợp Next.js + Socket.IO
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Trang chủ giới thiệu dự án
│   │   ├── test-socket/
│   │   │   └── page.tsx       # Trang kiểm thử tương tác Socket.IO
│   │   └── globals.css        # Tailwind CSS styles
│   ├── lib/
│   │   └── socket.ts          # Client-side Socket.IO singleton
│   ├── server/
│   │   └── rooms.ts           # In-memory Room State Manager (Lưu trên RAM)
│   └── types/
│       └── socket.ts          # Định nghĩa kiểu dữ liệu TypeScript cho Rooms & Events
├── package.json
└── tsconfig.json
```

---

## 2. Quản lý Trạng thái Phòng (In-memory Rooms State trên RAM)

Trạng thái các phòng được quản lý trong RAM máy chủ thông qua class `RoomManager` (`src/server/rooms.ts`), cấu trúc dữ liệu:

```typescript
export interface RoomState {
  roomId: string;          // Mã định danh phòng (VD: "KARAOKE-01")
  host: string | null;     // Socket ID của thiết bị Host (Màn hình chính/TV)
  controllers: string[];   // Danh sách Socket IDs của các thiết bị Controller (Điện thoại chọn bài)
  createdAt: number;       // Thời gian tạo phòng
  lastActiveAt: number;    // Thời gian hoạt động gần nhất
}
```

### Các tính năng xử lý phòng:
- **Tạo & Truy vấn phòng nhanh chóng**: Sử dụng `Map<string, RoomState>` trên RAM.
- **Phân vai trò (Roles)**:
  - `host`: Thiết bị màn hình hiển thị bài hát, video karaoke.
  - `controller`: Thiết bị người dùng điều khiển, tìm kiếm bài hát, chọn bài, ưu tiên bài.
- **Tự động dọn dẹp khi ngắt kết nối (Auto Cleanup)**: Khi thiết bị ngắt kết nối (`disconnect`), server tự động gỡ `socketId` khỏi danh sách `controllers` hoặc hủy quyền `host`. Nếu phòng không còn ai, phòng sẽ tự động được giải phóng khỏi RAM.

---

## 3. Các sự kiện Socket.IO cơ bản

### A. Sự kiện `ping-pong`
- **Client gửi**: `socket.emit("ping", { timestamp: Date.now(), message: "ping" })`
- **Server phản hồi**: `socket.emit("pong", { clientTimestamp, serverTimestamp, latencyMs, message: "pong" })`
- **Mục đích**: Đo đạc độ trễ Round-Trip Time (RTT) và kiểm tra tình trạng kết nối.

### B. Sự kiện `join-room`
- **Client gửi**:
  ```typescript
  socket.emit("join-room", {
    roomId: "KARAOKE-01",
    role: "host" | "controller",
    nickname?: string
  });
  ```
- **Server phản hồi cho client**:
  - `room-joined`: Trả về dữ liệu chi tiết của phòng và vai trò của người tham gia.
- **Server phát sóng cho toàn bộ phòng**:
  - `room-updated`: Gửi dữ liệu phòng mới nhất đến tất cả Host và Controllers trong cùng phòng để đồng bộ UI theo thời gian thực.

### C. Sự kiện bổ sung
- `leave-room`: Cho phép client chủ động rời khỏi phòng hiện tại.
- `get-room-state`: Cho phép lấy trạng thái phòng bất kỳ lúc nào.
- `disconnect`: Xử lý ngắt kết nối an toàn.

---

## 4. Trang kiểm thử: `/test-socket`

Truy cập đường dẫn: **`http://localhost:3000/test-socket`**

Giao diện trực quan bao gồm:
1. **Thanh trạng thái kết nối**: Hiển thị Socket ID, trạng thái kết nối (Live pulse), Transport protocol (`websocket`/`polling`), độ trễ RTT (ms).
2. **Khu vực kiểm tra Ping - Pong**:
   - Nút bấm `Gửi 'PING' ngay` có hiệu ứng tương tác.
   - Hiển thị kết quả Pong, timestamp của client/server và độ trễ.
   - Công tắc **Tự động Ping (Auto-Ping)** mỗi 2 giây.
3. **Khu vực kiểm tra Quản lý Phòng (Rooms State)**:
   - Nhập mã phòng hoặc sinh mã ngẫu nhiên.
   - Chọn vai trò **Host (Màn hình chính)** hoặc **Controller (Điện thoại)**.
   - Thẻ hiển thị trực quan trạng thái phòng hiện tại trên RAM (Host ID, số lượng và danh sách Controllers IDs).
4. **Live Socket Event Logger**: Bảng ghi thời gian thực tất cả các sự kiện Socket đến và đi.

---

## 5. Hướng dẫn Chạy Dự án

```bash
# 1. Cài đặt thư viện (nếu chưa cài)
npm install

# 2. Khởi động Custom Server ở chế độ phát triển
npm run dev

# 3. Mở trình duyệt truy cập:
# Trang chủ:    http://localhost:3000
# Trang test:   http://localhost:3000/test-socket
```
