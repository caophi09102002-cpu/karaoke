export interface CuratedSong {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number;
}

export interface CuratedCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  songs: CuratedSong[];
}

export const CURATED_CATEGORIES: CuratedCategory[] = [
  {
    id: "party_remix",
    name: "Quẩy Tiệc Tùng",
    icon: "🔥",
    description: "Nhạc trẻ remix bốc lửa, quẩy tung nóc nhà",
    songs: [
      {
        youtubeId: "fn3KQh6WbH4",
        title: "Cắt Đôi Nỗi Sầu (Beat Karaoke)",
        artist: "Tăng Duy Tân",
        thumbnail: "https://i.ytimg.com/vi/fn3KQh6WbH4/hqdefault.jpg",
        durationSec: 195,
      },
      {
        youtubeId: "bO147B1p0hI",
        title: "Bật Tình Yêu Lên (Karaoke Beat)",
        artist: "Tăng Duy Tân x Hòa Minzy",
        thumbnail: "https://i.ytimg.com/vi/bO147B1p0hI/hqdefault.jpg",
        durationSec: 215,
      },
      {
        youtubeId: "vB8U52X98h4",
        title: "Ngày Mai Người Ta Lấy Chồng (Remix)",
        artist: "Thành Đạt",
        thumbnail: "https://i.ytimg.com/vi/vB8U52X98h4/hqdefault.jpg",
        durationSec: 240,
      },
      {
        youtubeId: "tV_4hH9xO7g",
        title: "Bên Trên Tầng Lầu (Karaoke Beat Chuẩn)",
        artist: "Tăng Duy Tân",
        thumbnail: "https://i.ytimg.com/vi/tV_4hH9xO7g/hqdefault.jpg",
        durationSec: 185,
      },
      {
        youtubeId: "y1h14pM6f7w",
        title: "Em Của Ngày Hôm Qua (Beat Gốc)",
        artist: "Sơn Tùng M-TP",
        thumbnail: "https://i.ytimg.com/vi/y1h14pM6f7w/hqdefault.jpg",
        durationSec: 230,
      },
    ],
  },
  {
    id: "bolero",
    name: "Bolero Bất Hủ",
    icon: "🌹",
    description: "Những tình khúc quê hương trữ tình sâu lắng",
    songs: [
      {
        youtubeId: "14bF9eQZfio",
        title: "Sầu Tím Thiệp Hồng (Tone Nam/Nữ)",
        artist: "Quang Lê x Lệ Quyên",
        thumbnail: "https://i.ytimg.com/vi/14bF9eQZfio/hqdefault.jpg",
        durationSec: 270,
      },
      {
        youtubeId: "2XyqD1rKk9A",
        title: "Duyên Phận (Karaoke Tone Nữ Chuẩn)",
        artist: "Như Quỳnh",
        thumbnail: "https://i.ytimg.com/vi/2XyqD1rKk9A/hqdefault.jpg",
        durationSec: 320,
      },
      {
        youtubeId: "p5H_o1m_J0w",
        title: "Vùng Lá Me Bay (Karaoke Beat Hay)",
        artist: "Như Quỳnh",
        thumbnail: "https://i.ytimg.com/vi/p5H_o1m_J0w/hqdefault.jpg",
        durationSec: 300,
      },
      {
        youtubeId: "8rQ0M9Wb1zE",
        title: "Con Đường Xưa Em Đi (Tone Nam Chuẩn)",
        artist: "Chế Linh",
        thumbnail: "https://i.ytimg.com/vi/8rQ0M9Wb1zE/hqdefault.jpg",
        durationSec: 290,
      },
      {
        youtubeId: "aM8n6T4X8hE",
        title: "Biển Tình (Karaoke Beat Chuẩn Âm Thanh)",
        artist: "Đàm Vĩnh Hưng",
        thumbnail: "https://i.ytimg.com/vi/aM8n6T4X8hE/hqdefault.jpg",
        durationSec: 260,
      },
    ],
  },
  {
    id: "tiktok_hits",
    name: "Nhạc Trẻ Hot Hit",
    icon: "⚡",
    description: "Các bản hit triệu view thịnh hành nhất",
    songs: [
      {
        youtubeId: "Wn1Tf2p3Q8s",
        title: "Từng Quen (Karaoke Beat Chuẩn)",
        artist: "Wren Evans",
        thumbnail: "https://i.ytimg.com/vi/Wn1Tf2p3Q8s/hqdefault.jpg",
        durationSec: 175,
      },
      {
        youtubeId: "3x9kM8P0qW4",
        title: "Nơi Này Có Anh (Beat Chuẩn M-TP)",
        artist: "Sơn Tùng M-TP",
        thumbnail: "https://i.ytimg.com/vi/3x9kM8P0qW4/hqdefault.jpg",
        durationSec: 250,
      },
      {
        youtubeId: "6jK3r7o0pT8",
        title: "Có Chàng Trai Viết Lên Cây",
        artist: "Phan Mạnh Quỳnh",
        thumbnail: "https://i.ytimg.com/vi/6jK3r7o0pT8/hqdefault.jpg",
        durationSec: 300,
      },
      {
        youtubeId: "kL9w0q4M1bE",
        title: "Ngày Đẹp Trời Để Biến Mất",
        artist: "Lou Hoàng",
        thumbnail: "https://i.ytimg.com/vi/kL9w0q4M1bE/hqdefault.jpg",
        durationSec: 235,
      },
      {
        youtubeId: "f9T1p4Q0xW8",
        title: "Hẹn Một Mai (Karaoke Beat)",
        artist: "Bùi Anh Tuấn",
        thumbnail: "https://i.ytimg.com/vi/f9T1p4Q0xW8/hqdefault.jpg",
        durationSec: 260,
      },
    ],
  },
  {
    id: "duet",
    name: "Song Ca Nam Nữ",
    icon: "👫",
    description: "Song ca ngọt ngào, kết nối cặp đôi",
    songs: [
      {
        youtubeId: "5bF3m8W0qY4",
        title: "Cơn Mưa Tình Yêu (Song Ca Chuẩn)",
        artist: "Hà Anh Tuấn x Phương Linh",
        thumbnail: "https://i.ytimg.com/vi/5bF3m8W0qY4/hqdefault.jpg",
        durationSec: 285,
      },
      {
        youtubeId: "9kP4m1W8qX0",
        title: "Xe Đạp (Karaoke Song Ca)",
        artist: "Thùy Chi x M4U",
        thumbnail: "https://i.ytimg.com/vi/9kP4m1W8qX0/hqdefault.jpg",
        durationSec: 255,
      },
      {
        youtubeId: "7kL2m9W1qP4",
        title: "Chim Trắng Mồ Côi",
        artist: "Đan Trường x Cẩm Ly",
        thumbnail: "https://i.ytimg.com/vi/7kL2m9W1qP4/hqdefault.jpg",
        durationSec: 310,
      },
      {
        youtubeId: "1wP9m3X8qY0",
        title: "Vị Ngọt Đôi Môi (Song Ca)",
        artist: "Quang Dũng x Thanh Thảo",
        thumbnail: "https://i.ytimg.com/vi/1wP9m3X8qY0/hqdefault.jpg",
        durationSec: 275,
      },
    ],
  },
  {
    id: "wedding_party",
    name: "Tiệc Cưới & Ngày Vui",
    icon: "🎉",
    description: "Không khí tưng bừng, hân hoan chúc phúc",
    songs: [
      {
        youtubeId: "2jL9m4W0qY8",
        title: "Tàu Về Quê Hương (Karaoke Remix)",
        artist: "Nhiều Nghệ Sĩ",
        thumbnail: "https://i.ytimg.com/vi/2jL9m4W0qY8/hqdefault.jpg",
        durationSec: 240,
      },
      {
        youtubeId: "6xL1m8W3qY0",
        title: "Lâu Đài Tình Ái (Karaoke Beat)",
        artist: "Đàm Vĩnh Hưng",
        thumbnail: "https://i.ytimg.com/vi/6xL1m8W3qY0/hqdefault.jpg",
        durationSec: 250,
      },
      {
        youtubeId: "4wL9m2W7qY1",
        title: "Túp Lều Lý Tưởng (Karaoke Vui Nhộn)",
        artist: "Tuấn Hưng",
        thumbnail: "https://i.ytimg.com/vi/4wL9m2W7qY1/hqdefault.jpg",
        durationSec: 210,
      },
      {
        youtubeId: "8kL3m5W9qY2",
        title: "60 Năm Cuộc Đời (Karaoke Twist)",
        artist: "Y Vân",
        thumbnail: "https://i.ytimg.com/vi/8kL3m5W9qY2/hqdefault.jpg",
        durationSec: 200,
      },
    ],
  },
];
