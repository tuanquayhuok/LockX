<?php
/**
 * ==============================================================================
 * API Endpoint: Xử Lý Webhooks Đa Năng (POST /api/webhooks/handler.php)
 * Nhận sự kiện từ bên ngoài / Mobile App / Hệ thống thứ 3, ghi log và điều hướng
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';
require_once __DIR__ . '/../../helpers/mailer.php';

$rawInput = file_get_contents('php://input');
$data     = json_decode($rawInput, true) ?: $_POST;
$headers  = json_encode(getallheaders(), JSON_UNESCAPED_UNICODE);
$clientIp = getClientIp();

$eventType = $data['event_type'] ?? $data['event'] ?? 'general_webhook';
$source    = $data['source'] ?? 'external_app';

$db = getDB();

try {
    // 1. Ghi nhật ký sự kiện Webhook vào database
    $logStmt = $db->prepare("
        INSERT INTO webhooks_log (event_type, source, headers, payload, response_code, is_processed, ip_address, created_at)
        VALUES (?, ?, ?, ?, 200, 1, ?, NOW())
    ");
    $logStmt->execute([$eventType, $source, $headers, $rawInput ?: json_encode($data), $clientIp]);
    $webhookId = $db->lastInsertId();

    // 2. Điều hướng và xử lý theo từng loại sự kiện (Event Dispatcher)
    switch ($eventType) {
        case 'security_alert':
        case 'unauthorized_access':
            $details = $data['details'] ?? 'Phát hiện hành vi truy cập trái phép hoặc mở khóa thất bại.';
            TelegramService::sendAlert('🚨 CẢNH BÁO BẢO MẬT KHẨN CẤP', [
                'Sự kiện'    => $eventType,
                'Nguồn'      => $source,
                'Chi tiết'   => is_array($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : $details,
                'Địa chỉ IP' => $clientIp,
                'Thời gian'  => date('d/m/Y H:i:s')
            ]);
            break;

        case 'new_message':
            $sender  = $data['sender_name'] ?? 'Người dùng';
            $content = $data['content'] ?? '[Không có nội dung]';
            TelegramService::sendAlert('Tin Nhắn Mới (Webhook)', [
                'Người gửi'  => $sender,
                'Nội dung'   => $content,
                'Thời gian'  => date('d/m/Y H:i:s')
            ]);
            break;

        case 'incoming_call':
        case 'missed_call':
            $caller = $data['caller_phone'] ?? $data['caller_name'] ?? 'Không rõ';
            TelegramService::sendAlert('Cuộc Gọi Mới (Webhook)', [
                'Loại'       => $eventType === 'missed_call' ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đến',
                'Số máy'     => $caller,
                'Thời gian'  => date('d/m/Y H:i:s')
            ]);
            break;

        case 'email_request':
            $to      = $data['to'] ?? '';
            $subject = $data['subject'] ?? 'Thông báo từ LockX Vault';
            $body    = $data['body'] ?? '';
            if (!empty($to) && !empty($body)) {
                MailerService::sendMail($to, $subject, $body);
            }
            break;

        default:
            // Tự động thông báo Telegram cho mọi sự kiện webhook bất kỳ
            TelegramService::sendAlert('Sự Kiện Webhook Nhận Được', [
                'Loại sự kiện' => $eventType,
                'Nguồn gửi'    => $source,
                'IP'           => $clientIp,
                'Thời gian'    => date('d/m/Y H:i:s')
            ]);
            break;
    }

    jsonResponse(true, [
        'webhook_id' => $webhookId,
        'event_type' => $eventType,
        'source'     => $source,
        'status'     => 'processed'
    ], 'Webhook đã được tiếp nhận và xử lý thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi xử lý Webhook: ' . $e->getMessage(), 500);
}
