<?php
/**
 * ==============================================================================
 * API Endpoint: Lấy & Cập Nhật Hồ Sơ Cá Nhân (GET / POST /api/auth/profile.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = trim($_GET['username'] ?? '');

    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp tham số username.', 400);
    }

    $stmt = $db->prepare("SELECT id, username, status, display_name, email, phone, avatar_type, avatar_uri, avatar_preset_id, avatar_color, bio, gender, birthday, is_verified, verified_key, verified_at, created_at FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, null, 'Không tìm thấy thông tin người dùng.', 404);
    }

    jsonResponse(true, $user, 'Lấy thông tin hồ sơ thành công.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getRequestData();
    $username = trim($input['username'] ?? '');

    if (empty($username)) {
        jsonResponse(false, null, 'Vui lòng cung cấp username để cập nhật.', 400);
    }

    $displayName    = trim($input['display_name'] ?? '');
    $email          = trim($input['email'] ?? '');
    $phone          = trim($input['phone'] ?? '');
    $avatarType     = trim($input['avatar_type'] ?? 'preset');
    $avatarUri      = trim($input['avatar_uri'] ?? '');
    $avatarPresetId = trim($input['avatar_preset_id'] ?? 'preset_1');
    $avatarColor    = trim($input['avatar_color'] ?? '#0A84FF');
    $bio            = trim($input['bio'] ?? '');
    $gender         = trim($input['gender'] ?? 'Chưa cập nhật');
    $birthday       = trim($input['birthday'] ?? 'Chưa cập nhật');

    try {
        $stmt = $db->prepare("
            UPDATE users SET 
                display_name = COALESCE(NULLIF(?, ''), display_name),
                email = ?,
                phone = ?,
                avatar_type = ?,
                avatar_uri = ?,
                avatar_preset_id = ?,
                avatar_color = ?,
                bio = ?,
                gender = ?,
                birthday = ?,
                updated_at = NOW()
            WHERE username = ?
        ");
        $stmt->execute([
            $displayName, $email, $phone, $avatarType, $avatarUri, 
            $avatarPresetId, $avatarColor, $bio, $gender, $birthday, $username
        ]);

        $getStmt = $db->prepare("SELECT id, username, display_name, email, phone, avatar_type, avatar_uri, avatar_preset_id, avatar_color, bio, gender, birthday, is_verified, verified_key, verified_at FROM users WHERE username = ?");
        $getStmt->execute([$username]);
        $updatedUser = $getStmt->fetch();

        jsonResponse(true, $updatedUser, 'Cập nhật hồ sơ thành công.');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi cập nhật hồ sơ: ' . $e->getMessage(), 500);
    }
}

jsonResponse(false, null, 'Phương thức không được hỗ trợ.', 405);
