<?php
/**
 * ==============================================================================
 * Webhook Cổng Thanh Toán Thẻ Quốc Tế (Visa / Mastercard / Stripe / PayOS)
 * Phương thức: POST /api/payment/webhook_card.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

setCorsHeaders();

$rawInput = file_get_contents('php://input');
$data     = json_decode($rawInput, true) ?: $_POST;

$orderId = trim($data['order_id'] ?? ($data['data']['order_id'] ?? ($data['orderCode'] ?? '')));
$status  = trim($data['status'] ?? ($data['event'] ?? 'completed'));
$amount  = (int)($data['amount'] ?? 0);

if (empty($orderId)) {
    jsonResponse(false, null, 'Không tìm thấy mã đơn hàng trong payload webhook.', 400);
}

$db = null;
try {
    $db = getDB();
    if ($db) {
        $stmt = $db->prepare("SELECT * FROM `storage_orders` WHERE `id` = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if ($order) {
            $stmt = $db->prepare("UPDATE `storage_orders` SET `status` = 'completed', `paid_at` = NOW() WHERE `id` = ?");
            $stmt->execute([$orderId]);

            // Ghi nhật ký vào webhooks_log
            $logStmt = $db->prepare("
                INSERT INTO `webhooks_log` (`event_type`, `source`, `headers`, `payload`, `response_code`, `is_processed`, `ip_address`, `created_at`)
                VALUES ('card_webhook_received', 'card_gateway', ?, ?, 200, 1, ?, NOW())
            ");
            $logStmt->execute([
                json_encode(getallheaders(), JSON_UNESCAPED_UNICODE),
                $rawInput ?: json_encode($data),
                getClientIp()
            ]);

            // Gửi Telegram thông báo
            try {
                TelegramService::sendAlert('💳 WEBHOOK THẺ QUỐC TẾ XÁC THỰC THÀNH CÔNG', [
                    'Mã Đơn'    => $orderId,
                    'Tài Khoản' => $order['username'],
                    'Gói/Thẻ'   => $order['plan_name'],
                    'Số Tiền'   => number_format($amount ?: $order['amount'], 0, ',', '.') . 'đ',
                    'Cổng TT'   => 'Visa / Mastercard Webhook'
                ]);
            } catch (Exception $e) {}

            jsonResponse(true, ['order_id' => $orderId, 'status' => 'completed'], 'Kích hoạt thẻ VIP thành công qua Webhook!');
        }
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi Webhook: ' . $e->getMessage(), 500);
}

jsonResponse(true, ['message' => 'Đã tiếp nhận webhook thẻ.'], 'Card webhook processed.');
