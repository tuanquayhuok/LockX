# 🛡️ LockX Vault & GVault - PHP Backend & Webhooks Server

Hệ thống máy chủ RESTful API & Webhooks được viết hoàn toàn bằng **PHP thuần & PDO MySQL**, chuyên dụng để kết nối với ứng dụng di động **LockX Vault (GVault Expo)**.

---

## 📂 Cấu Trúc Thư Mục `webphp`

```
webphp/
├── config/
│   ├── config.php          # File cấu hình chính (DB, Telegram Token, Chat ID, SMTP, API Key)
│   └── database.php        # Kết nối cơ sở dữ liệu PDO an toàn (Prepared Statements)
├── helpers/
│   ├── auth.php            # Helper xác thực quyền truy cập API Key / Bearer Token
│   ├── mailer.php          # Helper gửi Email HTML định dạng Apple iOS 18
│   ├── response.php        # Helper phản hồi chuẩn JSON RESTful API & lấy IP client
│   └── telegram.php        # Helper tích hợp Bot Telegram (Gửi tin nhắn, bảng cảnh báo)
├── api/
│   ├── auth/
│   │   ├── login.php       # API Đăng nhập / Tự tạo tài khoản & cấp token
│   │   ├── profile.php     # API Lấy & cập nhật hồ sơ cá nhân
│   │   └── verify.php      # API Xác minh Tích Xanh LockX Verified
│   ├── messages/
│   │   ├── send.php        # API Lưu & gửi tin nhắn chat mới (Đẩy cảnh báo Telegram)
│   │   ├── list.php        # API Lấy lịch sử tin nhắn trò chuyện
│   │   └── sync.php        # API Đồng bộ hàng loạt tin nhắn offline
│   ├── calls/
│   │   ├── log.php         # API Ghi nhận nhật ký cuộc gọi (Đến/Đi/Nhỡ)
│   │   └── list.php        # API Lấy danh sách lịch sử cuộc gọi
│   ├── webhooks/
│   │   ├── handler.php     # API Nhận Webhooks từ hệ thống ngoài & phân luồng
│   │   └── telegram.php    # API Webhook 2 chiều nhận lệnh từ Bot Telegram
│   └── notifications/
│       ├── send_mail.php   # API Gửi Email thông báo trực tiếp
│       └── send_telegram.php # API Gửi cảnh báo Telegram trực tiếp
├── sql/
│   └── database.sql        # File mã nguồn SQL import cơ sở dữ liệu MySQL / MariaDB
├── .htaccess               # Cấu hình bảo mật Apache, chống truy cập file nhạy cảm & bật CORS
├── index.php               # Giao diện Dashboard quản trị & Tài liệu API trực quan
└── README.md               # Hướng dẫn chi tiết cài đặt và triển khai
```

---

## 🚀 Hướng Dẫn Cài Đặt Lên Hosting (cPanel, DirectAdmin, Hostinger, VPS, XAMPP)

### Bước 1: Tạo Database & Import CSDL
1. Đăng nhập vào **cPanel / DirectAdmin / phpMyAdmin** trên hosting của bạn.
2. Tạo một cơ sở dữ liệu mới (ví dụ: `lockx_vault`).
3. Chọn tab **Import** và tải lên file: [`webphp/sql/database.sql`](file:///D:/GVault-Expo/webphp/sql/database.sql).
4. Nhấn **Go / Thực hiện** để tạo đầy đủ các bảng: `users`, `messages`, `call_logs`, `webhooks_log`, `notification_logs`, `system_settings`.

---

### Bước 2: Cấu Hình Kết Nối [`config/config.php`](file:///D:/GVault-Expo/webphp/config/config.php)
Mở file `webphp/config/config.php` và điền các thông tin:

```php
// 1. Cấu hình Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'tên_database_của_bạn');
define('DB_USER', 'user_database_của_bạn');
define('DB_PASS', 'mật_khẩu_database_của_bạn');

// 2. Cấu hình Telegram Bot (Tùy chọn)
define('TELEGRAM_BOT_TOKEN', '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ');
define('TELEGRAM_CHAT_ID', '987654321'); // Chat ID cá nhân hoặc Group

// 3. Cấu hình Email SMTP (Nếu muốn gửi mail)
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'email_của_bạn@gmail.com');
define('SMTP_PASS', 'mật_khẩu_ứng_dụng_gmail');
```

---

### Bước 3: Tải Thư Mục `webphp` Lên Hosting
1. Nén toàn bộ thư mục `webphp` thành file `.zip`.
2. Tải lên thư mục gốc `public_html/` hoặc `public_html/api/` trên hosting.
3. Giải nén.
4. Mở trình duyệt truy cập: `https://tenmiencuaban.com/webphp/` để kiểm tra Dashboard và tài liệu API.

---

### Bước 4: Kích Hoạt Bot Telegram 2 Chiều (Tùy chọn)
Để nhận lệnh trực tiếp từ Telegram (như `/status`, `/stats`, `/messages`, `/calls`):
1. Chat với `@BotFather` trên Telegram để tạo Bot và lấy **Bot Token**.
2. Thiết lập Webhook bằng cách mở đường link sau trên trình duyệt:
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://tenmiencuaban.com/webphp/api/webhooks/telegram.php
   ```
3. Sau khi cài xong, bạn chỉ cần nhắn `/start` cho bot trên Telegram để bắt đầu tương tác!

---

## 📱 Kết Nối Từ Mobile App (Expo React Native)

Trong ứng dụng Mobile React Native:
```typescript
const BASE_API_URL = 'https://tenmiencuaban.com/webphp/api';

// 1. Gửi tin nhắn
await fetch(`${BASE_API_URL}/messages/send.php`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sender_username: 'admin_lockx',
    recipient_username: 'partner_01',
    content: 'Tin nhắn từ LockX Mobile App',
  }),
});

// 2. Ghi nhật ký cuộc gọi
await fetch(`${BASE_API_URL}/calls/log.php`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    caller_name: 'Khách hàng',
    caller_phone: '0988889999',
    receiver_name: 'Admin',
    receiver_phone: '0911112222',
    call_type: 'incoming',
    duration_seconds: 45,
  }),
});

// 3. Kích hoạt Tích Xanh LockX Verified
await fetch(`${BASE_API_URL}/auth/verify.php`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin_lockx',
    action: 'verify',
  }),
});
```
