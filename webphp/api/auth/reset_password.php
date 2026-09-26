<?php
/**
 * ==============================================================================
 * API Endpoint: Xác Thực OTP & Đặt Lại Mật Khẩu Mới (POST /api/auth/reset_password.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$username    = trim($input['username'] ?? '');
$otpCode     = trim($input['otp_code'] ?? $input['otp'] ?? '');
$newPassword = trim($input['new_password'] ?? $input['password'] ?? '');

if (empty($username) || empty($otpCode) || empty($newPassword)) {
    jsonResponse(false, null, 'Vui lòng cung cấp đầy đủ: Tên tài khoản (username), Mã OTP và Mật khẩu mới.', 400);
}

if (strlen($newPassword) < 6) {
    jsonResponse(false, null, 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.', 400);
}

$db = getDB();

try {
    // 1. Kiểm tra mã OTP trong bảng password_resets
    $stmt = $db->prepare("
        SELECT id, expires_at FROM password_resets 
        WHERE username = ? AND otp_code = ? AND status = 'pending' 
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmt->execute([$username, $otpCode]);
    $resetRecord = $stmt->fetch();

    if (!$resetRecord) {
        jsonResponse(false, null, 'Mã OTP không chính xác hoặc đã được sử dụng.', 400);
    }

    // Kiểm tra thời hạn hết hạn của OTP
    if (strtotime($resetRecord['expires_at']) < time()) {
        $expStmt = $db->prepare("UPDATE password_resets SET status = 'expired' WHERE id = ?");
        $expStmt->execute([$resetRecord['id']]);
        jsonResponse(false, null, 'Mã OTP đã hết hiệu lực. Vui lòng yêu cầu mã mới.', 400);
    }

    // 2. Cập nhật mật khẩu mới cho user
    $passHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $upUser = $db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE username = ?");
    $upUser->execute([$passHash, $username]);

    // 3. Đánh dấu mã OTP đã được sử dụng (used)
    $upOtp = $db->prepare("UPDATE password_resets SET status = 'used' WHERE id = ?");
    $upOtp->execute([$resetRecord['id']]);

    // 4. Gửi cảnh báo bảo mật về Telegram
    TelegramService::sendAlert('🔒 ĐỔI MẬT KHẨU THÀNH CÔNG', [
        'Tài khoản'  => "@{$username}",
        'Địa chỉ IP' => getClientIp(),
        'Thời gian'  => date('d/m/Y H:i:s'),
        'Trạng thái' => 'Mật khẩu đã được cập nhật thành công qua xác thực OTP.'
    ]);

    jsonResponse(true, [
        'username' => $username,
        'status'   => 'password_updated'
    ], 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập ngay bằng mật khẩu mới.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi đặt lại mật khẩu: ' . $e->getMessage(), 500);
}
