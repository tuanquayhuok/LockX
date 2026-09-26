<?php
/**
 * ==============================================================================
 * LockX Vault & GVault - Cấu Hình Máy Chủ PHP (Master Config)
 * ==============================================================================
 */

// Đặt múi giờ mặc định Việt Nam
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Bật / Tắt chế độ Debug (Để true khi dev/test, chuyển false khi lên production)
define('APP_DEBUG', true);

if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// ------------------------------------------------------------------------------
// CẤU HÌNH CƠ SỞ DỮ LIỆU MYSQL / MARIADB
// ------------------------------------------------------------------------------
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'lockx');
define('DB_USER', getenv('DB_USER') ?: 'lockxdata');
define('DB_PASS', getenv('DB_PASS') ?: 'Tuandeptrai2026@@@@');
define('DB_CHARSET', 'utf8mb4');

// ------------------------------------------------------------------------------
// CẤU HÌNH XÁC THỰC API & TOKEN
// ------------------------------------------------------------------------------
// Khóa bí mật API dùng để xác thực request từ Expo Mobile App (Header: X-API-KEY hoặc Bearer token)
define('API_SECRET_KEY', getenv('API_SECRET_KEY') ?: 'lockx_super_secret_api_key_2026_xyz');

// ------------------------------------------------------------------------------
// CẤU HÌNH BOT TELEGRAM
// ------------------------------------------------------------------------------
// Token bot @LockXOTP_bot & Chat ID cá nhân của bạn
define('TELEGRAM_BOT_TOKEN', getenv('TELEGRAM_BOT_TOKEN') ?: '8645033802:AAFgbz526Q1vHDjn9Bmd-a2OAkw6Vak6ELc');
define('TELEGRAM_CHAT_ID', getenv('TELEGRAM_CHAT_ID') ?: '6072481570');

// ------------------------------------------------------------------------------
// CẤU HÌNH GỬI EMAIL SMTP
// ------------------------------------------------------------------------------
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', getenv('SMTP_PORT') ?: 587);
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('SMTP_FROM_EMAIL', getenv('SMTP_FROM_EMAIL') ?: 'noreply@lockx.vault');
define('SMTP_FROM_NAME', getenv('SMTP_FROM_NAME') ?: 'LockX Vault Security');

// ------------------------------------------------------------------------------
// CẤU HÌNH CORS (CHO PHÉP APP MOBILE & WEB GỌI API)
// ------------------------------------------------------------------------------
function setCorsHeaders() {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-KEY, X-Requested-With");
    header("Access-Control-Max-Age: 86400");

    // Xử lý pre-flight request của trình duyệt (OPTIONS)
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}
