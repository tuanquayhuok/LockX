<?php
/**
 * ==============================================================================
 * API Endpoint: Lưu & Gửi Tin Nhắn Mới (POST /api/messages/send.php)
 * Lưu trữ vào MySQL, hỗ trợ mã hóa E2EE và tự động đẩy cảnh báo Telegram
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

$senderUsername    = trim($input['sender_username'] ?? '');
$senderName        = trim($input['sender_name'] ?? $senderUsername);
$recipientUsername = trim($input['recipient_username'] ?? '');
$recipientName     = trim($input['recipient_name'] ?? $recipientUsername);
$content           = trim($input['content'] ?? '');
$messageType       = trim($input['message_type'] ?? 'text');
$encryptedPayload  = trim($input['encrypted_payload'] ?? '');
$mediaUrl          = trim($input['media_url'] ?? '');
$conversationId    = trim($input['conversation_id'] ?? '');

// Nếu không có conversation_id, tạo tự động dựa trên 2 username sắp xếp theo alphabet
if (empty($conversationId) && !empty($senderUsername) && !empty($recipientUsername)) {
    $pair = [$senderUsername, $recipientUsername];
    sort($pair);
    $conversationId = 'conv_' . md5($pair[0] . '_' . $pair[1]);
}

if (empty($senderUsername) || empty($recipientUsername) || (empty($content) && empty($encryptedPayload))) {
    jsonResponse(false, null, 'Vui lòng cung cấp đầy đủ: người gửi (sender), người nhận (recipient) và nội dung tin nhắn.', 400);
}

$db = getDB();

try {
    $stmt = $db->prepare("
        INSERT INTO messages (
            conversation_id, sender_username, sender_name, 
            recipient_username, recipient_name, message_type, 
            content, encrypted_payload, media_url, is_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
    ");
    $stmt->execute([
        $conversationId, $senderUsername, $senderName,
        $recipientUsername, $recipientName, $messageType,
        $content, $encryptedPayload, $mediaUrl
    ]);

    $messageId = $db->lastInsertId();

    // Lấy bản ghi vừa tạo
    $getStmt = $db->prepare("SELECT * FROM messages WHERE id = ?");
    $getStmt->execute([$messageId]);
    $createdMessage = $getStmt->fetch();

    // Tùy chọn: Tự động gửi cảnh báo tin nhắn mới tới Telegram
    $previewText = mb_strlen($content) > 100 ? mb_substr($content, 0, 100) . '...' : $content;
    TelegramService::sendAlert('Tin Nhắn Mới Trên LockX Vault', [
        'Người gửi'   => "{$senderName} (@{$senderUsername})",
        'Người nhận'  => "{$recipientName} (@{$recipientUsername})",
        'Loại'        => $messageType,
        'Nội dung'    => !empty($content) ? $previewText : '[Tin nhắn mã hóa E2EE]',
        'Thời gian'   => date('d/m/Y H:i:s')
    ]);

    jsonResponse(true, $createdMessage, 'Tin nhắn đã được lưu và gửi thành công.', 201);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi khi lưu tin nhắn: ' . $e->getMessage(), 500);
}
