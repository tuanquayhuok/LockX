<?php
/**
 * ==============================================================================
 * API Endpoint: Kiểm Tra Trạng Thái Khóa / Cấm Tài Khoản (GET /api/auth/status.php)
 * Real-time Ban & Suspension Check
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

$username = trim($_GET['username'] ?? '');

if (empty($username)) {
    jsonResponse(false, null, 'Vui lòng cung cấp username.', 400);
}

$cleanUser = ltrim($username, '@');

$db = getDB();

try {
    $stmt = $db->prepare("SELECT id, username, display_name, status, is_verified FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$cleanUser]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, null, 'Không tìm thấy người dùng.', 404);
    }

    $status = strtolower(trim($user['status'] ?? 'active'));
    $isBanned = in_array($status, ['banned', 'suspended', 'locked', 'inactive', 'block', 'blocked']);

    $message = 'Tài khoản đang hoạt động bình thường.';
    if ($status === 'banned') {
        $message = 'Tài khoản của bạn đã bị CẤM vĩnh viễn trên hệ thống bởi Quản Trị Viên.';
    } elseif ($isBanned) {
        $message = 'Tài khoản của bạn đang bị TẠM KHÓA bởi Quản Trị Viên.';
    }

    jsonResponse(true, [
        'username'  => $user['username'],
        'status'    => $status,
        'is_banned' => $isBanned,
        'message'   => $message
    ], $message);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi kiểm tra trạng thái: ' . $e->getMessage(), 500);
}
