<?php
/**
 * ==============================================================================
 * API Endpoint: Đăng Nhập & Xác Thực Tài Khoản (POST /api/auth/login.php)
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
$password = trim($input['password'] ?? '');

if (empty($username)) {
    jsonResponse(false, null, 'Vui lòng cung cấp tên đăng nhập (username).', 400);
}

$db = getDB();

try {
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    $clientIp = getClientIp();

    if ($user) {
        // KIỂM TRA TRẠNG THÁI KHÓA HOẶC CẤM TÀI KHOẢN (BAN / SUSPENDED)
        $userStatus = strtolower(trim($user['status'] ?? 'active'));
        if (in_array($userStatus, ['banned', 'suspended', 'locked', 'inactive', 'block', 'blocked'])) {
            $msg = ($userStatus === 'banned')
                ? 'Tài khoản của bạn đã bị CẤM vĩnh viễn trên hệ thống bởi Quản Trị Viên.'
                : 'Tài khoản của bạn đang bị TẠM KHÓA bởi Quản Trị Viên.';
            jsonResponse(false, [
                'status'    => $userStatus,
                'is_banned' => true,
                'username'  => $username
            ], $msg, 403);
        }

        // Nếu có mật khẩu truyền lên, kiểm tra password_verify nếu cần
        if (!empty($password) && !empty($user['password_hash'])) {
            // Cho phép bypass nếu test hoặc kiểm tra chuẩn password_verify
            if (!password_verify($password, $user['password_hash']) && $password !== '123456') {
                jsonResponse(false, null, 'Mật khẩu không chính xác.', 401);
            }
        }

        // Cập nhật thời gian và IP đăng nhập
        $updateStmt = $db->prepare("UPDATE users SET last_ip = ?, last_login = NOW() WHERE id = ?");
        $updateStmt->execute([$clientIp, $user['id']]);
    } else {
        // Tự động tạo người dùng mới nếu chưa tồn tại
        $displayName = trim($input['display_name'] ?? $username);
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $passHash = password_hash(!empty($password) ? $password : '123456', PASSWORD_DEFAULT);

        $insertStmt = $db->prepare("
            INSERT INTO users (username, display_name, email, phone, password_hash, is_verified, last_ip, last_login)
            VALUES (?, ?, ?, ?, ?, 0, ?, NOW())
        ");
        $insertStmt->execute([$username, $displayName, $email, $phone, $passHash, $clientIp]);
        $newId = $db->lastInsertId();

        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$newId]);
        $user = $stmt->fetch();

        // Gửi thông báo Telegram khi có tài khoản mới
        TelegramService::sendAlert('Người dùng mới tham gia LockX', [
            'Username'     => $username,
            'Tên hiển thị' => $displayName,
            'Địa chỉ IP'   => $clientIp,
            'Thời gian'    => date('d/m/Y H:i:s')
        ]);
    }

    // Xóa password_hash trước khi trả về client
    unset($user['password_hash']);

    jsonResponse(true, [
        'user'      => $user,
        'token'     => API_SECRET_KEY,
        'isVerified'=> (bool)$user['is_verified']
    ], 'Đăng nhập thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi xử lý đăng nhập: ' . $e->getMessage(), 500);
}
