<?php
/**
 * ==============================================================================
 * API Endpoint: Kiểm Tra Trạng Thái Đơn Hàng Thanh Toán
 * Phương thức: GET /api/payment/status.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';

$orderId = trim($_GET['order_id'] ?? '');

if (empty($orderId)) {
    jsonResponse(false, null, 'Vui lòng cung cấp mã đơn hàng.', 400);
}

try {
    $db = getDB();
    if ($db) {
        $stmt = $db->prepare("SELECT * FROM `storage_orders` WHERE `id` = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order) {
            jsonResponse(true, $order, 'Lấy trạng thái đơn hàng thành công.');
        }
    }
} catch (Exception $e) {}

jsonResponse(true, [
    'order_id' => $orderId,
    'status'   => 'pending',
    'message'  => 'Đơn hàng đang chờ thanh toán.'
], 'Trạng thái đơn hàng.');
