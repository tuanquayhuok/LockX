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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$type     = trim($input['type'] ?? 'user'); // 'user', 'broadcast', 'token'
$username = trim($input['username'] ?? '');
$token    = trim($input['token'] ?? '');
$title    = trim($input['title'] ?? 'LockX Vault Thông Báo');
$body     = trim($input['body'] ?? '');
$data     = $input['data'] ?? [];

if (empty($body)) {
    jsonResponse(false, null, 'Nội dung thông báo (body) không được để trống.', 400);
}

if ($type === 'broadcast') {
    $res = PushNotificationService::broadcastAll($title, $body, $data);
} elseif ($type === 'token') {
    if (empty($token)) {
        jsonResponse(false, null, 'Vui lòng cung cấp token thiết bị.', 400);
    }
    $res = PushNotificationService::sendPush($token, $title, $body, $data);
} else {
    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp username người nhận.', 400);
    }
    $res = PushNotificationService::sendToUser($username, $title, $body, $data);
}

if ($res['success']) {
    jsonResponse(true, $res, 'Đã gửi thông báo đẩy (Push Notification) thành công tới thiết bị.');
} else {
    jsonResponse(false, $res, 'Gửi thông báo thất bại: ' . ($res['error'] ?? 'Lỗi không xác định'), 500);
}
