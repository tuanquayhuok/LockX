<?php
/**
 * ==============================================================================
 * API Endpoint: Gửi Email Thông Báo (POST /api/notifications/send_mail.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$to      = trim($input['to'] ?? '');
$subject = trim($input['subject'] ?? 'Thông báo từ LockX Vault');
$body    = trim($input['body'] ?? $input['content'] ?? '');

if (empty($to) || empty($body)) {
    jsonResponse(false, null, 'Vui lòng cung cấp địa chỉ email người nhận (to) và nội dung (body).', 400);
}

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, null, 'Địa chỉ email người nhận không hợp lệ.', 400);
}

$result = MailerService::sendMail($to, $subject, $body);

if ($result['success']) {
    jsonResponse(true, ['recipient' => $to, 'subject' => $subject], $result['message']);
} else {
    jsonResponse(false, null, $result['message'], 500);
}
