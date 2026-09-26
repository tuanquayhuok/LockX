<?php
/**
 * ==============================================================================
 * API Endpoint: Xác Minh Danh Tính LockX Verified (POST /api/auth/verify.php)
 * Cấp và thu hồi huy hiệu Tích Xanh & gửi thông báo Telegram
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
$username = trim($input['username'] ?? '');
$action = trim($input['action'] ?? 'verify'); // 'verify' hoặc 'revoke'

if (empty($username)) {
    jsonResponse(false, null, 'Vui lòng cung cấp username để xử lý xác minh.', 400);
}

$db = getDB();

try {
    if ($action === 'verify') {
        $verifiedKey = 'LX-VERIFIED-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
        $verifiedAt = date('d/m/Y H:i:s');

        $stmt = $db->prepare("
            UPDATE users SET 
                is_verified = 1, 
                verified_key = ?, 
                verified_at = ?,
                updated_at = NOW() 
            WHERE username = ?
        ");
        $stmt->execute([$verifiedKey, $verifiedAt, $username]);

        // Gửi thông báo đến Telegram
        TelegramService::sendAlert('Cấp Tích Xanh LockX Verified Thành Công', [
            'Username'     => $username,
            'Mã chứng chỉ' => $verifiedKey,
            'Phương thức'  => 'Apple Face ID TrueDepth',
            'Ngày cấp'     => $verifiedAt,
            'Trạng thái'   => 'ĐÃ XÁC MINH CHÍNH CHỦ'
        ]);

        jsonResponse(true, [
            'is_verified'  => true,
            'verified_key' => $verifiedKey,
            'verified_at'  => $verifiedAt
        ], 'Xác minh danh tính Tích Xanh thành công.');
    } else {
        $stmt = $db->prepare("
            UPDATE users SET 
                is_verified = 0, 
                verified_key = NULL, 
                verified_at = NULL,
                updated_at = NOW() 
            WHERE username = ?
        ");
        $stmt->execute([$username]);

        TelegramService::sendAlert('Hủy Trạng Thái Tích Xanh', [
            'Username'   => $username,
            'Thời gian'  => date('d/m/Y H:i:s'),
            'Trạng thái' => 'CHƯA XÁC MINH'
        ]);

        jsonResponse(true, [
            'is_verified' => false
        ], 'Đã hủy trạng thái xác minh Tích Xanh.');
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi xử lý xác minh: ' . $e->getMessage(), 500);
}
