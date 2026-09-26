<?php
/**
 * ==============================================================================
 * API Endpoint: Đăng Ký Người Dùng Mới (POST /api/auth/register.php)
 * Lưu thông tin tài khoản vào bảng `users` trong MySQL
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

$username    = trim($input['username'] ?? '');
$displayName = trim($input['display_name'] ?? $username);
$email       = trim($input['email'] ?? '');
$phone       = trim($input['phone'] ?? '');
$password    = trim($input['password'] ?? '');
$avatarPreset = trim($input['avatar_preset_id'] ?? 'preset_1');
$avatarColor  = trim($input['avatar_color'] ?? '#0A84FF');
$bio          = trim($input['bio'] ?? 'LockX Vault Security User');

if (empty($username) || empty($password)) {
    jsonResponse(false, null, 'Vui lòng điền đầy đủ tên đăng nhập (username) và mật khẩu.', 400);
}

if (strlen($username) < 3) {
    jsonResponse(false, null, 'Tên đăng nhập phải có ít nhất 3 ký tự.', 400);
}

$db = getDB();

try {
    // Kiểm tra xem username đã tồn tại chưa
    $checkStmt = $db->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $checkStmt->execute([$username]);
    if ($checkStmt->fetch()) {
        jsonResponse(false, null, 'Tên tài khoản này đã được sử dụng. Vui lòng chọn tên khác.', 409);
    }

    // Hash mật khẩu bằng chuẩn bcrypt an toàn
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $ipAddress    = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    // Thêm vào bảng users
    $stmt = $db->prepare("
        INSERT INTO users (
            username, display_name, email, phone, 
            password_hash, avatar_preset_id, avatar_color, 
            bio, is_verified, last_ip, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', NOW())
    ");
    $stmt->execute([
        $username, $displayName, $email, $phone,
        $passwordHash, $avatarPreset, $avatarColor,
        $bio, $ipAddress
    ]);

    $userId = $db->lastInsertId();

    // Thông báo cho Telegram Bot của Admin
    TelegramService::sendAlert('👤 NGƯỜI DÙNG MỚI ĐĂNG KÝ', [
        'ID'           => "#{$userId}",
        'Username'     => "@{$username}",
        'Tên hiển thị' => $displayName,
        'Email'        => $email ?: 'Không có',
        'Điện thoại'   => $phone ?: 'Không có',
        'IP Đăng ký'   => $ipAddress,
        'Thời gian'    => date('d/m/Y H:i:s')
    ]);

    jsonResponse(true, [
        'id'           => $userId,
        'username'     => $username,
        'display_name' => $displayName,
        'email'        => $email,
        'phone'        => $phone,
        'is_verified'  => 0,
        'status'       => 'active',
        'created_at'   => date('Y-m-d H:i:s')
    ], 'Đăng ký tài khoản thành công và đã lưu vào cơ sở dữ liệu!', 201);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi tạo tài khoản: ' . $e->getMessage(), 500);
}
