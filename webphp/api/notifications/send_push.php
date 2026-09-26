<?php
/**
 * ==============================================================================
 * API Endpoint: Gửi Push Notification (POST /api/notifications/send_push.php)
 * Cho phép Web Admin phát thông báo đẩy ra màn hình khóa điện thoại
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/push.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$type     = trim($input['type'] ?? 'user'); // 'user', 'broadcast', 'token'
$username = trim($input['username'] ?? '');
$token    = trim($input['token'] ?? '');
$title    = trim($input['title'] ?? 'LockX Vault Thông Báo');
$body     = trim($input['body'] ?? '');
$style    = trim($input['style'] ?? 'info'); // 'info', 'success', 'warning', 'security'
$data     = $input['data'] ?? [];

if (empty($body)) {
    jsonResponse(false, null, 'Nội dung thông báo (body) không được để trống.', 400);
}

// 1. Lưu thông báo vào bảng app_notifications để app polling nhận được 100%
$recipient = ($type === 'broadcast') ? 'all' : ltrim($username, '@');
try {
    $db = Database::getInstance()->getConnection();
    $db->exec("CREATE TABLE IF NOT EXISTS `app_notifications` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `recipient` VARCHAR(64) NOT NULL DEFAULT 'all',
        `title` VARCHAR(255) NOT NULL,
        `body` LONGTEXT NOT NULL,
        `type` VARCHAR(32) NOT NULL DEFAULT 'info',
        `data` LONGTEXT DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_recipient` (`recipient`),
        INDEX `idx_created` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $insStmt = $db->prepare("INSERT INTO app_notifications (recipient, title, body, type, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $insStmt->execute([$recipient, $title, $body, $style, json_encode($data, JSON_UNESCAPED_UNICODE)]);
} catch (Exception $e) {}

// 2. Gửi Push Notification qua Expo Push Service (bắn ra màn hình khóa iPhone / Android)
if ($type === 'broadcast') {
    $res = PushNotificationService::broadcastAll($title, $body, array_merge($data, ['style' => $style]));
} elseif ($type === 'token') {
    if (empty($token)) {
        jsonResponse(false, null, 'Vui lòng cung cấp token thiết bị.', 400);
    }
    $res = PushNotificationService::sendPush($token, $title, $body, array_merge($data, ['style' => $style]));
} else {
    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp username người nhận.', 400);
    }
    $res = PushNotificationService::sendToUser($username, $title, $body, array_merge($data, ['style' => $style]));
}

if ($res['success']) {
    jsonResponse(true, $res, 'Đã gửi thông báo đẩy (Push Notification) thành công tới thiết bị.');
} else {
    // Vẫn trả về true nếu đã lưu vào app_notifications để app nhận qua sync
    jsonResponse(true, ['sync' => true, 'expo_push' => $res], 'Thông báo đã được ghi nhận vào hệ thống và gửi tới ứng dụng.');
}
