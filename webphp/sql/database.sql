-- ==============================================================================
-- LockX Vault & GVault - Cơ Sở Dữ Liệu Máy Chủ PHP (MySQL / MariaDB)
-- Tương thích: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Bộ mã: UTF-8 Unicode (utf8mb4_unicode_ci)
-- ==============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

-- ------------------------------------------------------------------------------
-- 1. Bảng `users`: Thông tin người dùng, tài khoản và Tích Xanh LockX Verified
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `display_name` VARCHAR(128) NOT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_type` ENUM('preset', 'image', 'color') DEFAULT 'preset',
  `avatar_uri` TEXT DEFAULT NULL,
  `avatar_preset_id` VARCHAR(32) DEFAULT 'preset_1',
  `avatar_color` VARCHAR(16) DEFAULT '#0A84FF',
  `bio` TEXT DEFAULT NULL,
  `gender` VARCHAR(32) DEFAULT 'Chưa cập nhật',
  `birthday` VARCHAR(32) DEFAULT 'Chưa cập nhật',
  `is_verified` TINYINT(1) DEFAULT 0,
  `verified_key` VARCHAR(64) DEFAULT NULL,
  `verified_at` VARCHAR(64) DEFAULT NULL,
  `device_token` VARCHAR(255) DEFAULT NULL,
  `last_ip` VARCHAR(45) DEFAULT NULL,
  `last_login` DATETIME DEFAULT NULL,
  `status` ENUM('active', 'suspended', 'banned') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_is_verified` (`is_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Bảng `verification_requests`: Yêu cầu xét duyệt Tích Xanh LockX Verified
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_requests` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `reason` TEXT DEFAULT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `face_auth_verified` TINYINT(1) DEFAULT 1,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `verified_key` VARCHAR(64) DEFAULT NULL,
  `admin_note` TEXT DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_req_username` (`username`),
  INDEX `idx_req_status` (`status`),
  INDEX `idx_req_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Bảng `password_resets`: Yêu cầu & Mã OTP Quên Mật Khẩu
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `otp_code` VARCHAR(12) NOT NULL,
  `status` ENUM('pending', 'verified', 'used', 'expired') DEFAULT 'pending',
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_otp_username` (`username`),
  INDEX `idx_otp_code` (`otp_code`),
  INDEX `idx_otp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Bảng `messages`: Lưu trữ tin nhắn, trò chuyện và mã hóa
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` VARCHAR(64) NOT NULL,
  `sender_username` VARCHAR(64) NOT NULL,
  `sender_name` VARCHAR(128) NOT NULL,
  `recipient_username` VARCHAR(64) NOT NULL,
  `recipient_name` VARCHAR(128) NOT NULL,
  `message_type` ENUM('text', 'image', 'audio', 'file', 'call_event', 'system') DEFAULT 'text',
  `content` LONGTEXT NOT NULL,
  `encrypted_payload` LONGTEXT DEFAULT NULL,
  `media_url` TEXT DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `read_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_conv` (`conversation_id`),
  INDEX `idx_sender` (`sender_username`),
  INDEX `idx_recipient` (`recipient_username`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Bảng `call_logs`: Lưu trữ lịch sử cuộc gọi (đến, đi, nhỡ, từ chối)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `call_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `caller_name` VARCHAR(128) NOT NULL,
  `caller_phone` VARCHAR(32) NOT NULL,
  `receiver_name` VARCHAR(128) NOT NULL,
  `receiver_phone` VARCHAR(32) NOT NULL,
  `call_type` ENUM('incoming', 'outgoing', 'missed', 'rejected', 'voip_audio', 'voip_video') NOT NULL,
  `duration_seconds` INT DEFAULT 0,
  `status` ENUM('completed', 'missed', 'cancelled', 'busy', 'failed') DEFAULT 'completed',
  `note` TEXT DEFAULT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_caller_phone` (`caller_phone`),
  INDEX `idx_receiver_phone` (`receiver_phone`),
  INDEX `idx_call_type` (`call_type`),
  INDEX `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Bảng `webhooks_log`: Ghi nhật ký tất cả sự kiện webhook gửi tới server
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `webhooks_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(64) NOT NULL,
  `source` VARCHAR(64) DEFAULT 'external',
  `headers` LONGTEXT DEFAULT NULL,
  `payload` LONGTEXT NOT NULL,
  `response_code` INT DEFAULT 200,
  `response_body` TEXT DEFAULT NULL,
  `is_processed` TINYINT(1) DEFAULT 1,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_event` (`event_type`),
  INDEX `idx_source` (`source`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Bảng `notification_logs`: Nhật ký gửi Email, Telegram và Push Notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `channel` ENUM('email', 'telegram', 'push', 'webhook') NOT NULL,
  `recipient` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `content` LONGTEXT NOT NULL,
  `status` ENUM('sent', 'failed', 'pending') DEFAULT 'sent',
  `error_message` TEXT DEFAULT NULL,
  `sent_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_channel` (`channel`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Bảng `system_settings`: Cấu hình hệ thống (Telegram, Mail, API Key)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(64) NOT NULL UNIQUE,
  `setting_value` LONGTEXT DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- DỮ LIỆU KHỞI TẠO MẪU (Sample Seed Data)
-- ------------------------------------------------------------------------------

-- 1. Tài khoản Admin mẫu (Mật khẩu mặc định: 123456 - Hash bcrypt)
INSERT INTO `users` (`username`, `display_name`, `email`, `phone`, `password_hash`, `avatar_preset_id`, `avatar_color`, `is_verified`, `verified_key`, `verified_at`, `status`)
VALUES 
('admin_lockx', 'Admin LockX', 'admin@lockx.vault', '0988889999', '$2y$10$wT5WJ2z7k6fX4e8d3L1sPe7KkI0aA4J6d/F3rV7Y3X9o1u9Y7r0zK', 'preset_1', '#0A84FF', 1, 'LX-VERIFIED-INIT-001', '26/09/2026', 'active'),
('support_bot', 'LockX Support Bot', 'support@lockx.vault', '0900000000', '$2y$10$wT5WJ2z7k6fX4e8d3L1sPe7KkI0aA4J6d/F3rV7Y3X9o1u9Y7r0zK', 'preset_2', '#34C759', 1, 'LX-VERIFIED-BOT-002', '26/09/2026', 'active')
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);

-- 2. Yêu cầu cấp Tích Xanh mẫu
INSERT INTO `verification_requests` (`username`, `display_name`, `email`, `phone`, `reason`, `device_info`, `status`, `verified_key`, `approved_at`)
VALUES
('admin_lockx', 'Admin LockX', 'admin@lockx.vault', '0988889999', 'Xác minh tài khoản chính chủ quản trị hệ thống LockX Vault', 'iPhone 16 Pro Max • iOS 18', 'approved', 'LX-VERIFIED-INIT-001', NOW());

-- 3. Cài đặt hệ thống mẫu
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`)
VALUES
('app_name', 'LockX Vault Pro', 'Tên ứng dụng hệ thống'),
('telegram_bot_token', '', 'Token Bot Telegram (VD: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ)'),
('telegram_chat_id', '', 'Chat ID nhận thông báo Telegram (VD: -1001234567890 hoặc 987654321)'),
('smtp_host', 'smtp.gmail.com', 'Địa chỉ máy chủ SMTP gửi mail'),
('smtp_port', '587', 'Cổng SMTP (587 / 465)'),
('smtp_user', '', 'Tài khoản Email SMTP'),
('smtp_pass', '', 'Mật khẩu ứng dụng Email SMTP'),
('smtp_from_email', 'noreply@lockx.vault', 'Email người gửi'),
('smtp_from_name', 'LockX Security System', 'Tên người gửi Email'),
('api_secret_key', 'lockx_super_secret_api_key_2026_xyz', 'Khóa bí mật xác thực API từ Mobile App')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 4. Tin nhắn mẫu
INSERT INTO `messages` (`conversation_id`, `sender_username`, `sender_name`, `recipient_username`, `recipient_name`, `message_type`, `content`, `is_read`, `created_at`)
VALUES
('conv_admin_support', 'support_bot', 'LockX Support Bot', 'admin_lockx', 'Admin LockX', 'text', 'Chào mừng bạn đến với hệ thống LockX Vault Server! Máy chủ PHP & MySQL đã sẵn sàng hoạt động.', 1, NOW()),
('conv_admin_support', 'support_bot', 'LockX Support Bot', 'admin_lockx', 'Admin LockX', 'text', 'Bạn có thể kết nối từ Expo Mobile App qua API RESTful và cấu hình Webhooks Telegram.', 1, NOW());

-- 5. Nhật ký cuộc gọi mẫu
INSERT INTO `call_logs` (`caller_name`, `caller_phone`, `receiver_name`, `receiver_phone`, `call_type`, `duration_seconds`, `status`, `start_time`, `end_time`)
VALUES
('Khách hàng VIP', '0912345678', 'Admin LockX', '0988889999', 'incoming', 145, 'completed', NOW() - INTERVAL 2 HOUR, NOW() - INTERVAL 2 HOUR + INTERVAL 145 SECOND),
('Đối tác Kỹ thuật', '0933445566', 'Admin LockX', '0988889999', 'missed', 0, 'missed', NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR);

COMMIT;
