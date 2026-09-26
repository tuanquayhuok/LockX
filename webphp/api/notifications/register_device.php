<?php
/**
 * ==============================================================================
 * API Endpoint: Đăng Ký Token Thiết Bị (POST /api/notifications/register_device.php)
 * Dùng để App gửi Push Token (Expo / APNs / FCM) lên máy chủ PHP
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$username    = trim($input['username'] ?? '');
$deviceToken = trim($input['device_token'] ?? $input['push_token'] ?? '');
$deviceInfo  = trim($input['device_info'] ?? '');

if (empty($username) || empty($deviceToken)) {
    jsonResponse(false, null, 'Thiếu thông tin username hoặc device_token.', 400);
}

$db = getDB();

try {
    // Cập nhật device_token cho user
    $stmt = $db->prepare("UPDATE users SET device_token = ?, last_ip = ? WHERE username = ?");
    $stmt->execute([$deviceToken, $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1', $username]);

    jsonResponse(true, [
        'username'     => $username,
        'device_token' => $deviceToken,
        'registered_at'=> date('Y-m-d H:i:s')
    ], 'Đăng ký nhận thông báo đẩy thành công!');
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi lưu thông tin thiết bị: ' . $e->getMessage(), 500);
}
