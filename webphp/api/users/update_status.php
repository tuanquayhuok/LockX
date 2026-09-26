<?php
/**
 * ==============================================================================
 * API Endpoint: Cập Nhật Trạng Thái Người Dùng (POST /api/users/update_status.php)
 * Cho phép Admin: active (hoạt động), suspended (tạm khóa), banned (cấm)
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

$userId   = intval($input['user_id'] ?? 0);
$username = trim($input['username'] ?? '');
$status   = trim($input['status'] ?? 'active'); // active, suspended, banned

if (!in_array($status, ['active', 'suspended', 'banned'])) {
    jsonResponse(false, null, 'Trạng thái không hợp lệ (chỉ chấp nhận: active, suspended, banned).', 400);
}

if ($userId <= 0 && empty($username)) {
    jsonResponse(false, null, 'Vui lòng cung cấp user_id hoặc username.', 400);
}

$db = getDB();

try {
    if ($userId > 0) {
        $stmt = $db->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$status, $userId]);
    } else {
        $stmt = $db->prepare("UPDATE users SET status = ? WHERE username = ?");
        $stmt->execute([$status, $username]);
    }

    TelegramService::sendAlert('⚙️ CẬP NHẬT TRẠNG THÁI TÀI KHOẢN', [
        'User'       => $userId > 0 ? "ID: #{$userId}" : "@{$username}",
        'Trạng thái' => strtoupper($status),
        'Thời gian'  => date('d/m/Y H:i:s')
    ]);

    jsonResponse(true, [
        'status'     => $status,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'Đã cập nhật trạng thái người dùng thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi cập nhật trạng thái: ' . $e->getMessage(), 500);
}
