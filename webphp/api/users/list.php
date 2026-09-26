<?php
/**
 * ==============================================================================
 * API Endpoint: Lấy Danh Sách Người Dùng (GET /api/users/list.php)
 * Cho phép Admin quản lý danh sách Users, Tích Xanh và Trạng Thái
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng GET.', 405);
}

$limit  = max(1, min(100, intval($_GET['limit'] ?? 50)));
$page   = max(1, intval($_GET['page'] ?? 1));
$offset = ($page - 1) * $limit;
$search = trim($_GET['search'] ?? '');
$status = trim($_GET['status'] ?? '');

$db = getDB();

try {
    $where = ["1=1"];
    $params = [];

    if (!empty($search)) {
        $where[] = "(username LIKE ? OR display_name LIKE ? OR email LIKE ? OR phone LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
    }

    if (!empty($status)) {
        $where[] = "status = ?";
        $params[] = $status;
    }

    $whereSql = implode(' AND ', $where);

    // Đếm tổng số
    $countStmt = $db->prepare("SELECT COUNT(*) FROM users WHERE {$whereSql}");
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    // Lấy dữ liệu (ẩn password_hash)
    $sql = "
        SELECT id, username, display_name, email, phone, 
               avatar_preset_id, avatar_color, is_verified, 
               verified_key, verified_at, device_token, last_ip, 
               last_login, status, created_at, updated_at
        FROM users 
        WHERE {$whereSql} 
        ORDER BY id DESC 
        LIMIT {$limit} OFFSET {$offset}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();

    jsonResponse(true, [
        'total' => $total,
        'page'  => $page,
        'limit' => $limit,
        'users' => $users
    ], 'Lấy danh sách người dùng thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi truy vấn danh sách người dùng: ' . $e->getMessage(), 500);
}
