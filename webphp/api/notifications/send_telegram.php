<?php
/**
 * ==============================================================================
 * API Endpoint: Gửi Thông Báo Telegram Trực Tiếp (POST /api/notifications/send_telegram.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$message = trim($input['message'] ?? $input['text'] ?? '');
$chatId  = trim($input['chat_id'] ?? '');
$title   = trim($input['title'] ?? '');
$fields  = $input['fields'] ?? [];

if (empty($message) && empty($title)) {
    jsonResponse(false, null, 'Vui lòng cung cấp nội dung thông báo (message) hoặc tiêu đề (title).', 400);
}

if (!empty($title) && is_array($fields)) {
    // Gửi dạng bảng Alert cao cấp
    $result = TelegramService::sendAlert($title, $fields, $chatId ?: null);
} else {
    // Gửi dạng văn bản thường
    $result = TelegramService::sendMessage($message, $chatId ?: null);
}

if ($result['success']) {
    jsonResponse(true, $result, 'Đã gửi thông báo Telegram thành công.');
} else {
    jsonResponse(false, $result, 'Gửi Telegram thất bại: ' . ($result['error'] ?? 'Không rõ'), 500);
}
