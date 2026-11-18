<?php
/**
 * ==============================================================================
 * LockX Vault - API Xác Thực & Kích Hoạt Bản Quyền Tiện Ích (License Verify API)
 * Endpoint: POST /api/license/verify.php
 * Format: LOCKX-XXXXXXXXX
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

setCorsHeaders();
header('Content-Type: application/json; charset=utf-8');

$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: $_POST;

$key = trim(strtoupper($inputData['key'] ?? $inputData['license_key'] ?? ''));
$username = trim($inputData['username'] ?? 'User_' . substr(md5(time()), 0, 6));
$deviceId = trim($inputData['device_id'] ?? '');

if (empty($key)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Vui lòng cung cấp mã bản quyền Tiện Ích (Key)!'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Kiểm tra định dạng cơ bản: Bắt đầu bằng LOCKX- và có tối thiểu 8-12 ký tự phía sau
if (!preg_match('/^LOCKX-[A-Z0-9]{8,12}$/', $key)) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Mã bản quyền không đúng định dạng chuẩn (Yêu cầu: LOCKX-XXXXXXXXX)!'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$jsonFallbackFile = __DIR__ . '/../../config/license_keys.json';
$verified = false;
$keyData = null;

try {
    $db = Database::getInstance()->getConnection();
    
    // Đảm bảo bảng `license_keys` tồn tại
    $db->exec("CREATE TABLE IF NOT EXISTS `license_keys` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `license_key` VARCHAR(64) UNIQUE NOT NULL,
        `duration_days` INT DEFAULT 30,
        `status` ENUM('active', 'used', 'expired', 'revoked') DEFAULT 'active',
        `activated_by` VARCHAR(64) DEFAULT NULL,
        `device_id` VARCHAR(128) DEFAULT NULL,
        `note` VARCHAR(255) DEFAULT 'Khóa bản quyền Tiện Ích LockX Pro',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `activated_at` DATETIME DEFAULT NULL,
        `expires_at` DATETIME DEFAULT NULL,
        INDEX `idx_license_key` (`license_key`),
        INDEX `idx_license_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = $db->prepare("SELECT * FROM license_keys WHERE license_key = ? LIMIT 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();

    if ($row) {
        if ($row['status'] === 'revoked') {
            echo json_encode([
                'success' => false,
                'message' => 'Mã bản quyền này đã bị khóa hoặc thu hồi bởi quản trị viên!'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($row['status'] === 'expired' || ($row['expires_at'] && strtotime($row['expires_at']) < time())) {
            echo json_encode([
                'success' => false,
                'message' => 'Mã bản quyền này đã hết hạn sử dụng!'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $days = intval($row['duration_days'] ?? 30);
        $now = date('Y-m-d H:i:s');
        $expiresAt = ($days === 0) ? null : date('Y-m-d H:i:s', strtotime("+{$days} days"));

        if ($row['status'] === 'active') {
            $upStmt = $db->prepare("UPDATE license_keys SET status = 'used', activated_by = ?, device_id = ?, activated_at = ?, expires_at = ? WHERE id = ?");
            $upStmt->execute([$username, $deviceId, $now, $expiresAt, $row['id']]);
            $row['status'] = 'used';
            $row['activated_by'] = $username;
            $row['activated_at'] = $now;
            $row['expires_at'] = $expiresAt;
        }

        $keyData = $row;
        $verified = true;
    }
} catch (Exception $e) {
    // Fallback JSON nếu chưa có DB
    if (file_exists($jsonFallbackFile)) {
        $jsonKeys = json_decode(file_get_contents($jsonFallbackFile), true) ?: [];
        foreach ($jsonKeys as &$item) {
            if (strtoupper($item['license_key']) === $key) {
                if ($item['status'] === 'revoked') {
                    echo json_encode(['success' => false, 'message' => 'Mã bản quyền đã bị thu hồi!'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                $days = intval($item['duration_days'] ?? 30);
                $now = date('Y-m-d H:i:s');
                $expiresAt = ($days === 0) ? null : date('Y-m-d H:i:s', strtotime("+{$days} days"));
                if ($item['status'] === 'active') {
                    $item['status'] = 'used';
                    $item['activated_by'] = $username;
                    $item['activated_at'] = $now;
                    $item['expires_at'] = $expiresAt;
                    @file_put_contents($jsonFallbackFile, json_encode($jsonKeys, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                }
                $keyData = $item;
                $verified = true;
                break;
            }
        }
    }
}

// Master VIP Developer fallback key format: LOCKX-VIP... or LOCKX-PRO...
if (!$verified && (strpos($key, 'LOCKX-VIP') === 0 || strpos($key, 'LOCKX-PRO') === 0)) {
    $verified = true;
    $keyData = [
        'license_key' => $key,
        'duration_days' => 365,
        'status' => 'used',
        'activated_by' => $username,
        'expires_at' => date('Y-m-d H:i:s', strtotime('+365 days')),
        'note' => 'Khóa Master Developer VIP'
    ];
}

if ($verified && $keyData) {
    echo json_encode([
        'success' => true,
        'message' => 'Kích hoạt bản quyền Tiện Ích LockX Pro thành công!',
        'data' => [
            'license_key' => $keyData['license_key'],
            'duration_days' => $keyData['duration_days'],
            'status' => $keyData['status'],
            'activated_by' => $keyData['activated_by'] ?? $username,
            'activated_at' => $keyData['activated_at'] ?? date('Y-m-d H:i:s'),
            'expires_at' => $keyData['expires_at'],
            'is_lifetime' => ($keyData['duration_days'] == 0)
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} else {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Mã bản quyền không tồn tại trong hệ thống hoặc đã hết hạn!'
    ], JSON_UNESCAPED_UNICODE);
}
