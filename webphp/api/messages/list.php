<?php
/**
 * ==============================================================================
 * API Endpoint: Lấy Danh Sách Tin Nhắn / Lịch Sử Chat (GET /api/messages/list.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

$conversationId = trim($_GET['conversation_id'] ?? '');
$username       = trim($_GET['username'] ?? '');
$limit          = min(100, max(1, intval($_GET['limit'] ?? 50)));
$offset         = max(0, intval($_GET['offset'] ?? 0));

$db = getDB();

try {
    if (!empty($conversationId)) {
        // Lấy tin nhắn theo cuộc hội thoại cụ thể
        $stmt = $db->prepare("
            SELECT * FROM messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC 
            LIMIT ? OFFSET ?
        ");
        $stmt->bindValue(1, $conversationId, PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $messages = $stmt->fetchAll();

        // Đánh dấu đã đọc nếu có người nhận truyền vào
        if (!empty($username)) {
            $readStmt = $db->prepare("
                UPDATE messages SET is_read = 1, read_at = NOW() 
                WHERE conversation_id = ? AND recipient_username = ? AND is_read = 0
            ");
            $readStmt->execute([$conversationId, $username]);
        }

        jsonResponse(true, [
            'conversation_id' => $conversationId,
            'count'           => count($messages),
            'messages'        => $messages
        ], 'Lấy danh sách tin nhắn thành công.');
    } elseif (!empty($username)) {
        // Lấy tất cả tin nhắn liên quan đến user (cả gửi và nhận)
        $stmt = $db->prepare("
            SELECT * FROM messages 
            WHERE sender_username = ? OR recipient_username = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ");
        $stmt->bindValue(1, $username, PDO::PARAM_STR);
        $stmt->bindValue(2, $username, PDO::PARAM_STR);
        $stmt->bindValue(3, $limit, PDO::PARAM_INT);
        $stmt->bindValue(4, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $messages = $stmt->fetchAll();

        jsonResponse(true, [
            'username' => $username,
            'count'    => count($messages),
            'messages' => $messages
        ], 'Lấy tin nhắn của người dùng thành công.');
    } else {
        // Lấy danh sách tin nhắn mới nhất toàn hệ thống
        $stmt = $db->prepare("SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $messages = $stmt->fetchAll();

        jsonResponse(true, [
            'count'    => count($messages),
            'messages' => $messages
        ], 'Lấy tin nhắn toàn hệ thống thành công.');
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi lấy tin nhắn: ' . $e->getMessage(), 500);
}
