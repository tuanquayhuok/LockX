<?php
/**
 * ==============================================================================
 * API Endpoint: Quản Trị Viên Đổi / Cấp Mật Khẩu Cho Người Dùng (POST /api/users/change_password.php)
 * Hỗ trợ băm mật khẩu bcrypt, ghi nhật ký, tùy chọn gửi thông báo Push & Telegram
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';
require_once __DIR__ . '/../../helpers/push.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$userId      = intval($input['user_id'] ?? 0);
$username    = trim($input['username'] ?? '');
$newPassword = trim($input['new_password'] ?? $input['password'] ?? '');
$notifyUser  = !empty($input['notify_user']); // Gửi thông báo Push cho user

if ($userId <= 0 && empty($username)) {
    jsonResponse(false, null, 'Vui lòng cung cấp user_id hoặc username của người dùng cần đổi mật khẩu.', 400);
}

if (empty($newPassword)) {
    jsonResponse(false, null, 'Vui lòng cung cấp mật khẩu mới.', 400);
}

if (strlen($newPassword) < 6) {
    jsonResponse(false, null, 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.', 400);
}

$db = getDB();

try {
    // 1. Tìm thông tin người dùng
    if ($userId > 0) {
        $stmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
    } else {
        $cleanUser = ltrim($username, '@');
        $stmt = $db->prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
        $stmt->execute([$cleanUser]);
    }

    $targetUser = $stmt->fetch();
    if (!$targetUser) {
        jsonResponse(false, null, 'Không tìm thấy người dùng trong hệ thống.', 404);
    }

    $targetUsername = $targetUser['username'];
    $targetDisplayName = $targetUser['display_name'] ?: $targetUsername;

    // 2. Băm mật khẩu mới bằng BCRYPT an toàn
    $passHash = password_hash($newPassword, PASSWORD_DEFAULT);

    $upStmt = $db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
    $upStmt->execute([$passHash, $targetUser['id']]);

    // 3. Nếu bật tùy chọn thông báo Push cho người dùng
    if ($notifyUser) {
        $notifTitle = '🔐 Mật Khẩu Tài Khoản Đã Được Cấp Mới';
        $notifBody = "Quản trị viên đã cấp mật khẩu mới cho tài khoản @{$targetUsername}: {$newPassword}. Vui lòng đăng nhập lại để đảm bảo an toàn.";

        // Lưu vào bảng app_notifications
        try {
            $db->exec("CREATE TABLE IF NOT EXISTS `app_notifications` (
                `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                `recipient` VARCHAR(64) NOT NULL DEFAULT 'all',
                `title` VARCHAR(255) NOT NULL,
                `body` LONGTEXT NOT NULL,
                `type` VARCHAR(32) NOT NULL DEFAULT 'info',
                `data` LONGTEXT DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_recipient` (`recipient`),
                INDEX `idx_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $notifStmt = $db->prepare("INSERT INTO app_notifications (recipient, title, body, type, created_at) VALUES (?, ?, ?, 'security', NOW())");
            $notifStmt->execute([$targetUsername, $notifTitle, $notifBody]);
        } catch (Exception $e) {}

        // Bắn Push Notification ra màn hình điện thoại
        PushNotificationService::sendToUser(
            $targetUsername,
            $notifTitle,
            $notifBody,
            ['action' => 'password_reset_by_admin', 'username' => $targetUsername]
        );
    }

    // 4. Báo cáo Telegram bot
    TelegramService::sendAlert('🔑 QUẢN TRỊ VIÊN ĐÃ ĐỔI MẬT KHẨU USER', [
        'Tài khoản'    => "@{$targetUsername}",
        'Tên hiển thị' => $targetDisplayName,
        'Mật khẩu mới' => $newPassword,
        'Thông báo'    => $notifyUser ? 'Đã gửi Push tới người dùng' : 'Không gửi Push',
        'Thời gian'    => date('d/m/Y H:i:s')
    ]);

    jsonResponse(true, [
        'user_id'      => $targetUser['id'],
        'username'     => $targetUsername,
        'display_name' => $targetDisplayName,
        'new_password' => $newPassword,
        'notified'     => $notifyUser,
        'updated_at'   => date('Y-m-d H:i:s')
    ], "Đã cấp mật khẩu mới thành công cho người dùng @{$targetUsername}.");

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống khi cập nhật mật khẩu: ' . $e->getMessage(), 500);
}
