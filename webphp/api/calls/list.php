<?php
/**
 * ==============================================================================
 * API Endpoint: Lấy Danh Sách Nhật Ký Cuộc Gọi (GET /api/calls/list.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

$phone    = trim($_GET['phone'] ?? '');
$callType = trim($_GET['type'] ?? '');
$limit    = min(100, max(1, intval($_GET['limit'] ?? 50)));
$offset   = max(0, intval($_GET['offset'] ?? 0));

$db = getDB();

try {
    $conditions = [];
    $params = [];

    if (!empty($phone)) {
        $conditions[] = "(caller_phone = ? OR receiver_phone = ?)";
        $params[] = $phone;
        $params[] = $phone;
    }

    if (!empty($callType)) {
        $conditions[] = "call_type = ?";
        $params[] = $callType;
    }

    $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

    $sql = "SELECT * FROM call_logs {$whereClause} ORDER BY start_time DESC LIMIT ? OFFSET ?";
    $stmt = $db->prepare($sql);

    $paramIndex = 1;
    foreach ($params as $p) {
        $stmt->bindValue($paramIndex++, $p, PDO::PARAM_STR);
    }
    $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
    $stmt->bindValue($paramIndex++, $offset, PDO::PARAM_INT);

    $stmt->execute();
    $logs = $stmt->fetchAll();

    jsonResponse(true, [
        'count' => count($logs),
        'logs'  => $logs
    ], 'Lấy danh sách nhật ký cuộc gọi thành công.');

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi lấy nhật ký cuộc gọi: ' . $e->getMessage(), 500);
}
