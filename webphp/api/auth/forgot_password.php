<?php
/**
 * ==============================================================================
 * API Endpoint: Yêu Cầu Quên Mật Khẩu & Tạo Mã OTP (POST /api/auth/forgot_password.php)
 * Sinh mã OTP 6 số, gửi qua Email và đẩy thông báo duyệt về Telegram
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';
require_once __DIR__ . '/../../helpers/mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();
$account = trim($input['username'] ?? $input['account'] ?? $input['email'] ?? '');

if (empty($account)) {
    jsonResponse(false, null, 'Vui lòng cung cấp username hoặc địa chỉ email của bạn.', 400);
}

$db = getDB();

try {
    // 1. Tìm user theo username hoặc email
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1");
    $stmt->execute([$account, $account]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, null, 'Không tìm thấy tài khoản tương ứng với thông tin đã cung cấp.', 404);
    }

    $username    = $user['username'];
    $displayName = $user['display_name'];
    $email       = $user['email'];
    $clientIp    = getClientIp();

    // 2. Tạo mã OTP ngẫu nhiên 6 số bảo mật
    $otpCode = str_pad(strval(random_int(100000, 999999)), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', time() + 15 * 60); // 15 phút

    // Vô hiệu hóa các OTP cũ chưa dùng
    $expireOld = $db->prepare("UPDATE password_resets SET status = 'expired' WHERE username = ? AND status = 'pending'");
    $expireOld->execute([$username]);

    // Lưu mã OTP mới vào database
    $insertStmt = $db->prepare("
        INSERT INTO password_resets (username, email, otp_code, status, ip_address, expires_at, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?, NOW())
    ");
    $insertStmt->execute([$username, $email, $otpCode, $clientIp, $expiresAt]);

    // 3. Gửi mã OTP qua Telegram Bot
    TelegramService::sendAlert('🔑 YÊU CẦU QUÊN MẬT KHẨU (MÃ OTP)', [
        'Tài khoản'      => "@{$username} ({$displayName})",
        'Mã OTP Khôi Phục' => "👉 {$otpCode} 👈 (Hiệu lực 15 phút)",
        'Email liên kết' => $email ?: 'Chưa cập nhật',
        'Địa chỉ IP'     => $clientIp,
        'Hết hạn lúc'    => date('H:i:s d/m/Y', strtotime($expiresAt))
    ]);

    // 4. Gửi mã OTP qua Email nếu có
    $emailSent = false;
    if (!empty($email)) {
        $emailHtml = "<p>Xin chào <b>{$displayName}</b>,</p>";
        $emailHtml .= "<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản <b>@{$username}</b> trên ứng dụng LockX Vault.</p>";
        $emailHtml .= "<div style='text-align: center; margin: 20px 0;'>";
        $emailHtml .= "<span style='font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0A84FF; background: #E5F2FF; padding: 10px 24px; border-radius: 12px; border: 1px dashed #0A84FF;'>{$otpCode}</span>";
        $emailHtml .= "</div>";
        $emailHtml .= "<p style='color: #8E8E93; font-size: 13px;'>Mã xác thực này có hiệu lực trong <b>15 phút</b>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>";

        $mailRes = MailerService::sendMail($email, "Mã OTP Đặt Lại Mật Khẩu LockX: {$otpCode}", $emailHtml);
        $emailSent = $mailRes['success'];
    }

    // Che bớt email để bảo mật thông tin (vd: a***@gmail.com)
    $maskedEmail = '';
    if (!empty($email)) {
        $parts = explode('@', $email);
        $name = $parts[0];
        $domain = $parts[1] ?? '';
        $maskedEmail = substr($name, 0, 1) . '***@' . $domain;
    }

    jsonResponse(true, [
        'username'     => $username,
        'email_sent'   => $emailSent,
        'masked_email' => $maskedEmail,
        'expires_in'   => '15 phút',
        // Trả về OTP trong dev mode để test nhanh nếu chưa cấu hình SMTP
        'debug_otp'    => APP_DEBUG ? $otpCode : null
    ], 'Mã xác thực OTP đã được tạo và gửi qua Telegram / Email thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi tạo yêu cầu quên mật khẩu: ' . $e->getMessage(), 500);
}
