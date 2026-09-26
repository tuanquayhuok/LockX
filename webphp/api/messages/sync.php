<?php
/**
 * ==============================================================================
 * API Endpoint: Đồng Bộ Hàng Loạt Tin Nhắn (POST /api/messages/sync.php)
 * Cho phép Mobile App gửi danh sách tin nhắn offline lên server
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();
$messages = $input['messages'] ?? [];

if (!is_array($messages) || empty($messages)) {
    jsonResponse(false, null, 'Dữ liệu mảng tin nhắn (messages) không hợp lệ hoặc đang rỗng.', 400);
}

$db = getDB();
$savedCount = 0;
$errors = [];

$stmt = $db->prepare("
    INSERT INTO messages (
        conversation_id, sender_username, sender_name, 
        recipient_username, recipient_name, message_type, 
        content, encrypted_payload, media_url, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
");

foreach ($messages as $idx => $msg) {
    try {
        $convId    = $msg['conversation_id'] ?? 'conv_default';
        $sender    = $msg['sender_username'] ?? 'anonymous';
        $sName     = $msg['sender_name'] ?? $sender;
        $recipient = $msg['recipient_username'] ?? 'admin';
        $rName     = $msg['recipient_name'] ?? $recipient;
        $mType     = $msg['message_type'] ?? 'text';
        $content   = $msg['content'] ?? '';
        $enc       = $msg['encrypted_payload'] ?? null;
        $media     = $msg['media_url'] ?? null;
        $isRead    = !empty($msg['is_read']) ? 1 : 0;
        $createdAt = $msg['created_at'] ?? date('Y-m-d H:i:s');

        $stmt->execute([$convId, $sender, $sName, $recipient, $rName, $mType, $content, $enc, $media, $isRead, $createdAt]);
        $savedCount++;
    } catch (Exception $e) {
        $errors[] = "Lỗi tại chỉ mục {$idx}: " . $e->getMessage();
    }
}

jsonResponse(true, [
    'total_received' => count($messages),
    'total_saved'    => $savedCount,
    'errors'         => $errors
], "Đã đồng bộ thành công {$savedCount}/" . count($messages) . " tin nhắn.");
