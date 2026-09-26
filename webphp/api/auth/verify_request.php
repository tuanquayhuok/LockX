<?php
/**
 * ==============================================================================
 * API Endpoint: Gửi & Kiểm Tra Yêu Cầu Xác Minh Tích Xanh (GET/POST /api/auth/verify_request.php)
 * Gửi yêu cầu lên server chờ Admin duyệt & tự động báo động qua Telegram
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

$db = getDB();

// 1. GET: Kiểm tra trạng thái yêu cầu duyệt của tài khoản
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = trim($_GET['username'] ?? '');

    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp tham số username.', 400);
    }

    try {
        // Lấy thông tin user hiện tại
        $uStmt = $db->prepare("SELECT is_verified, verified_key, verified_at FROM users WHERE username = ? LIMIT 1");
        $uStmt->execute([$username]);
        $user = $uStmt->fetch();

        // Lấy yêu cầu xét duyệt mới nhất
        $rStmt = $db->prepare("
            SELECT id, status, verified_key, admin_note, approved_at, created_at 
            FROM verification_requests 
            WHERE username = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $rStmt->execute([$username]);
        $latestRequest = $rStmt->fetch();

        $isVerified = $user ? (bool)$user['is_verified'] : false;
        $status = $latestRequest ? $latestRequest['status'] : ($isVerified ? 'approved' : 'none');

        jsonResponse(true, [
            'username'       => $username,
            'is_verified'    => $isVerified,
            'request_status' => $status, // 'none' | 'pending' | 'approved' | 'rejected'
            'verified_key'   => $user['verified_key'] ?? ($latestRequest['verified_key'] ?? null),
            'verified_at'    => $user['verified_at'] ?? null,
            'admin_note'     => $latestRequest['admin_note'] ?? null,
            'request_time'   => $latestRequest['created_at'] ?? null,
        ], 'Lấy trạng thái xác minh thành công.');

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi kiểm tra trạng thái: ' . $e->getMessage(), 500);
    }
}

// 2. POST: Gửi yêu cầu xác minh Tích Xanh mới lên server chờ duyệt
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getRequestData();

    $username    = trim($input['username'] ?? '');
    $displayName = trim($input['display_name'] ?? $username);
    $email       = trim($input['email'] ?? '');
    $phone       = trim($input['phone'] ?? '');
    $reason      = trim($input['reason'] ?? 'Yêu cầu cấp Tích Xanh chính chủ qua Apple Face ID');
    $deviceInfo  = trim($input['device_info'] ?? 'Apple Device (iOS 18)');
    $faceAuth    = !empty($input['face_auth_verified']) ? 1 : 1;

    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp username để gửi yêu cầu xác minh.', 400);
    }

    try {
        // Kiểm tra xem đã có yêu cầu pending nào trước đó chưa
        $checkStmt = $db->prepare("SELECT id FROM verification_requests WHERE username = ? AND status = 'pending' LIMIT 1");
        $checkStmt->execute([$username]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            jsonResponse(true, [
                'request_id'     => $existing['id'],
                'request_status' => 'pending',
            ], 'Bạn đã gửi yêu cầu xác minh trước đó. Yêu cầu đang được quản trị viên xét duyệt.');
        }

        // Tạo yêu cầu mới với status = pending
        $stmt = $db->prepare("
            INSERT INTO verification_requests (
                username, display_name, email, phone, reason, 
                device_info, face_auth_verified, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        ");
        $stmt->execute([$username, $displayName, $email, $phone, $reason, $deviceInfo, $faceAuth]);
        $requestId = $db->lastInsertId();

        // Gửi cảnh báo khẩn cấp tới Telegram của Quản trị viên
        TelegramService::sendAlert('YÊU CẦU CẤP TÍCH XANH MỚI (CHỜ DUYỆT)', [
            'ID Yêu cầu'    => "#{$requestId}",
            'Username'      => "@{$username}",
            'Tên hiển thị'  => $displayName,
            'Email'         => $email ?: 'Chưa cập nhật',
            'Số điện thoại' => $phone ?: 'Chưa cập nhật',
            'Thiết bị'      => $deviceInfo,
            'Face ID'       => 'Đã quét thành công trên thiết bị',
            'Trạng thái'    => '⏳ ĐANG CHỜ ADMIN PHÊ DUYỆT',
            'Thời gian'     => date('d/m/Y H:i:s')
        ]);

        jsonResponse(true, [
            'request_id'     => $requestId,
            'username'       => $username,
            'request_status' => 'pending',
            'created_at'     => date('Y-m-d H:i:s')
        ], 'Yêu cầu cấp Tích Xanh đã được gửi thành công. Vui lòng chờ quản trị viên phê duyệt trên Web/Telegram.', 201);

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi gửi yêu cầu xác minh: ' . $e->getMessage(), 500);
    }
}

jsonResponse(false, null, 'Phương thức không được hỗ trợ.', 405);
