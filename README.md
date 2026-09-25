# 🛡️ LockX — iOS 18 Security Vault & App Protection

<p align="center">
  <img src="./assets/icon.png" width="110" height="110" alt="LockX Logo" style="border-radius: 24px;" />
</p>

<p align="center">
  <b>Ứng dụng Két Sắt Mật Khẩu & Bảo Vệ Ứng Dụng Chuẩn Apple iOS 18 Human Interface Guidelines</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-000000?style=for-the-badge&logo=apple" alt="Platform" />
  <img src="https://img.shields.io/badge/Expo-SDK%2057-4630EB?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK" />
  <img src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" alt="License" />
</p>

---

## 📖 Giới Thiệu (Overview)

**LockX** là ứng dụng di động bảo mật cao cấp được xây dựng bằng **React Native** & **Expo SDK 57**, mô phỏng trải nghiệm người dùng tinh tế, mượt mà chuẩn **Apple iOS 18 HIG**.

Ứng dụng kết hợp giữa **Két sắt quản lý mật khẩu cá nhân** và **Hệ thống bảo vệ ứng dụng (App Protection)** tích hợp sinh trắc học **Face ID / Touch ID**, hỗ trợ lưu trữ cục bộ mã hóa an toàn mà không cần gửi dữ liệu nhạy cảm ra ngoài máy chủ bên thứ ba.

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 1. 🗄️ Két Sắt Mật Khẩu (Password Vault)
* **Lưu trữ đa thông tin:** Tên tài khoản, Email / Username, Mật khẩu, Server game, Ghi chú an toàn.
* **Mã hóa cục bộ:** Toàn bộ thông tin được bảo vệ bằng chuẩn bảo mật Secure Storage.
* **Tìm kiếm & Phân loại thông minh:** Bộ lọc danh mục nhanh (Game, Clone/Smurf, Mạng xã hội, Công việc).
* **Sao chép 1 chạm:** Sao chép tài khoản, mật khẩu với phản hồi Dynamic Island Toast.

### 2. 📱 Quản Lý Ứng Dụng & Thời Gian Sử Dụng (App Shield & Screen Time)
* **Bảo vệ ứng dụng nhạy cảm:** Khóa và quản lý danh sách ứng dụng (Ngân hàng, MXH, Tin nhắn).
* **Biểu đồ Screen Time Apple:** Theo dõi thời lượng sử dụng màn hình (Hôm nay / 7 ngày qua) với tỷ lệ trực quan.
* **Thư viện 50+ ứng dụng:** Hỗ trợ URL Schemes gọi app nhanh (Momo, Zalo, Facebook, TikTok...).

### 3. 👤 Hồ Sơ Cá Nhân Chuẩn Apple ID (Profile)
* **Avatar tùy biến:** Đổi ảnh đại diện từ Preset, chụp Camera, chọn từ Album hoặc bảng màu gradient.
* **Đổi mật khẩu két sắt:** Màn hình xác thực mật khẩu cũ/mới trực quan.
* **Chính sách Username an toàn:** Đổi tên người dùng có chu kỳ đếm ngược 7 ngày.
* **Quản lý thiết bị & Phiên hoạt động:** Xem lịch sử đăng nhập thiết bị thật và nút đăng xuất phiên từ xa.

### 4. ⚙️ Cài Đặt Hệ Thống Chuyên Sâu (Settings)
* **Face ID & Mật mã:** Tích hợp `expo-local-authentication`, cấu hình tự động khóa (Ngay lập tức, 1 phút, 5 phút, Tắt).
* **Giao diện & Chủ đề (Appearance):**
  * Chế độ **Sáng (Light Mode)** chuẩn iOS 18 hoặc **Tối (OLED Dark Mode)** tiết kiệm pin.
  * 5 bảng màu nhấn Tint Color: *Xanh Apple, Xanh Ngọc, Tím Cyber, Cam Sunset, Đỏ Ruby*.
  * Tùy chỉnh **Cỡ chữ** (Nhỏ, Chuẩn, Lớn) và chế độ **Chữ in đậm (Bold Text)** với thanh trượt trực quan.
* **Dữ liệu & Bộ nhớ:**
  * **Đo lường dung lượng đệm thực tế (Cache):** Dọn dẹp cache 1 chạm giải phóng bộ nhớ.
  * **Sao lưu & Khôi phục JSON:** Xuất dữ liệu ra file `.json` và nhập lại trên thiết bị mới một cách liền mạch.
  * **Kiểm tra an toàn mật khẩu (Security Audit):** Phân tích độ mạnh/yếu của các tài khoản đã lưu.
* **Thông báo & Dynamic Island:** Hiệu ứng thông báo dạng viên thuốc rơi từ mép trên màn hình cùng âm thanh iOS chân thực.

### 5. 🌐 Hỗ Trợ Đa Ngôn Ngữ Động (Dynamic Multilingual / i18n)
Hệ thống chuyển đổi tức thì trên toàn bộ giao diện app mà không cần khởi động lại:
* 🇻🇳 **Tiếng Việt** (Mặc định)
* 🇺🇸 **English** (Tiếng Anh)
* 🇰🇷 **한국어** (Tiếng Hàn)
* 🇨🇳 **中文** (Tiếng Trung)
* 🇯🇵 **日本語** (Tiếng Nhật)
* 🇫🇷 **Français** (Tiếng Pháp)
* 🇩🇪 **Deutsch** (Tiếng Đức)

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Phiên bản |
| :--- | :--- | :--- |
| **Framework** | React Native (Expo) | Expo SDK 57 / RN 0.86 |
| **Language** | TypeScript | 6.0.x |
| **Icons** | `@expo/vector-icons` (Ionicons) | 15.1.x |
| **Storage** | `@react-native-async-storage/async-storage` | 2.2.x |
| **Biometrics** | `expo-local-authentication` | 57.0.x |
| **Notifications** | `expo-notifications` | 57.0.x |
| **Device Info** | `expo-device` | 57.0.x |
| **CI/CD** | GitHub Actions (Xcode, macOS-latest) | v4 |

---

## 📁 Cấu Trúc Thư Mục (Project Structure)

```text
LockX/
├── .github/
│   └── workflows/
│       └── build-ios.yml       # Quy trình đóng gói tự động file iOS IPA trên macOS runner
├── assets/                     # Biểu tượng app (icon), Face ID assets, hình ảnh
├── App.tsx                     # Trung tâm mã nguồn ứng dụng (State, UI, i18n, HIG components)
├── index.ts                    # Entry point đăng ký ứng dụng Expo
├── app.json                    # Cấu hình Bundle ID (com.lockx.app), Face ID permissions, URL schemes
├── package.json                # Danh sách gói phụ thuộc và scripts
├── tsconfig.json               # Cấu hình TypeScript
└── README.md                   # Tài liệu hướng dẫn dự án
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Getting Started)

### 1. Yêu cầu hệ thống (Prerequisites)
* **Node.js**: Phiên bản 18.x hoặc 20.x LTS.
* **npm** hoặc **yarn**.
* **Expo Go** trên điện thoại (iOS / Android) hoặc Xcode / Android Studio để chạy máy ảo.

### 2. Cài đặt các gói phụ thuộc
```bash
# Clone repository về máy
git clone https://github.com/tuanquayhuok/LockX.git

# Di chuyển vào thư mục dự án
cd LockX

# Cài đặt thư viện
npm install
```

### 3. Khởi chạy ứng dụng (Development)
```bash
# Khởi động Expo Metro Bundler
npx expo start

# Hoặc mở trực tiếp trên nền tảng mong muốn:
npm run ios       # Chạy trên máy ảo iOS Simulator (yêu cầu macOS & Xcode)
npm run android   # Chạy trên Android Emulator hoặc thiết bị thật qua ADB
npm run web       # Chạy trên trình duyệt Web (Chrome / Safari)
```

---

## 📦 Đóng Gói File Cài Đặt iOS (.IPA)

Dự án đã tích hợp sẵn GitHub Actions workflow tại `.github/workflows/build-ios.yml`:

1. Vào tab **Actions** trên GitHub repository: [`LockX Actions`](https://github.com/tuanquayhuok/LockX/actions).
2. Chọn workflow **📱 Build iOS IPA**.
3. Bấm nút **Run workflow** -> Chọn nhánh `main` và bấm xác nhận.
4. Quá trình build sẽ tự động chạy trên môi trường `macos-latest`, biên dịch mã nguồn qua Xcode và xuất file `LockX.ipa` trong mục **Artifacts** để tải về.
5. Cài đặt file IPA lên iPhone thông qua các công cụ sideload phổ biến:
   * **AltStore**
   * **Sideloadly**
   * **TrollStore** (nếu thiết bị có hỗ trợ)

---

## 🔒 Bản Quyền & Giấy Phép (License)

Dự án được phân phối dưới giấy phép **MIT License**. Bạn có toàn quyền sử dụng, phát triển và đóng góp cho dự án.

<p align="center">Made with ❤️ for iOS Security & Design Enthusiasts.</p>
