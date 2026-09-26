<?php
/**
 * ==============================================================================
 * API Endpoint: Lấy danh sách thông báo gửi từ Web Server về App
 * GET /api/notifications/list.php?username=xxx&since=xxx
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$username = trim($_GET['username'] ?? '');
$cleanUser = ltrim($username, '@');
$since = intval($_GET['since'] ?? 0);

try {
    $db = Database::getInstance()->getConnection();

    // Tự động tạo bảng app_notifications nếu chưa có
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

    $query = "SELECT * FROM app_notifications WHERE (recipient = 'all' OR recipient = ?)";
    $params = [$cleanUser];

    if ($since > 0) {
        $sinceDate = date('Y-m-d H:i:s', $since);
        $query .= " AND created_at > ?";
        $params[] = $sinceDate;
    }

    $query .= " ORDER BY id DESC LIMIT 20";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Chuyển format thời gian sang timestamp để App dễ xử lý
    foreach ($list as &$item) {
        $item['timestamp'] = strtotime($item['created_at']);
        if (!empty($item['data'])) {
            $item['payload'] = json_decode($item['data'], true);
        }
    }

    jsonResponse(true, ['notifications' => $list], 'Lấy danh sách thông báo thành công.');
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi kết nối cơ sở dữ liệu: ' . $e->getMessage(), 500);
}
