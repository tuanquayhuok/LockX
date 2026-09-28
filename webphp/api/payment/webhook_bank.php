<?php
/**
 * ==============================================================================
 * Webhook Tự Động Nhận Tiền Ngân Hàng (Tương thích Sepay, Casso, MBBank API)
 * Phương thức: POST /api/payment/webhook_bank.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

$input = getRequestData();

// Hỗ trợ cấu trúc webhook của Sepay, Casso hoặc POST tự do
$content = $input['content'] ?? ($input['description'] ?? ($input['transfer_content'] ?? ''));
$amount  = (int)($input['transferAmount'] ?? ($input['amount'] ?? 0));
$subAcc  = $input['subAccount'] ?? ($input['accountNumber'] ?? '');

if (empty($content)) {
    jsonResponse(false, null, 'Không tìm thấy nội dung giao dịch.', 400);
}

// Tìm mã đơn hàng dạng LX...... trong nội dung chuyển khoản
preg_match('/LX[A-Za-z0-9]{6,8}/i', $content, $matches);
$orderId = !empty($matches[0]) ? strtoupper($matches[0]) : null;

$db = null;
try {
    $db = getDB();
    if ($db && $orderId) {
        $stmt = $db->prepare("SELECT * FROM `storage_orders` WHERE `id` = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        if ($order) {
            $stmt = $db->prepare("UPDATE `storage_orders` SET `status` = 'completed', `paid_at` = NOW() WHERE `id` = ?");
            $stmt->execute([$orderId]);

            // Gửi thông báo Telegram giao dịch thành công
            try {
                TelegramService::sendAlert('💰 NHẬN TIỀN THÀNH CÔNG TỪ NGÂN HÀNG', [
                    'Mã Đơn'    => $orderId,
                    'Tài Khoản' => $order['username'],
                    'Gói Mua'   => $order['plan_name'],
                    'Số Tiền'   => number_format($amount ?: $order['amount'], 0, ',', '.') . 'đ',
                    'STK Nhận'  => '20080699998386',
                    'Nội Dung'  => $content
                ]);
            } catch (Exception $e) {}

            jsonResponse(true, ['order_id' => $orderId, 'status' => 'completed'], 'Kích hoạt đơn hàng thành công qua Webhook!');
        }
    }
} catch (Exception $e) {}

jsonResponse(true, ['message' => 'Đã nhận webhook, nội dung: ' . $content], 'Webhook processed.');
