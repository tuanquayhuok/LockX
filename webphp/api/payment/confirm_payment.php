<?php
/**
 * ==============================================================================
 * API Endpoint: Xác Nhận & Kiểm Tra Thanh Toán Thực Tế
 * Phương thức: POST / GET /api/payment/confirm_payment.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

$input = getRequestData();
$orderId = trim($input['order_id'] ?? ($_GET['order_id'] ?? ''));
$username = trim($input['username'] ?? ($_GET['username'] ?? 'User'));
$planId = trim($input['plan_id'] ?? ($_GET['plan_id'] ?? '50GB'));
$adminApprove = !empty($input['admin_approve'] ?? ($_GET['admin_approve'] ?? ''));

if (empty($orderId)) {
    jsonResponse(false, null, 'Vui lòng cung cấp mã đơn hàng (order_id).', 400);
}

$planLabels = [
    '50GB'      => '50 GB',
    '200GB'     => '200 GB',
    '2TB'       => '2.0 TB',
    'silver'    => 'Thẻ VIP Bạc (Silver)',
    'gold'      => 'Thẻ VIP Vàng (Gold)',
    'diamond'   => 'Thẻ VIP Kim Cương (Diamond)',
    'titanium'  => 'Thẻ VIP Titanium',
    'uranium'   => 'Thẻ VIP Uranium Vô Cực',
];

$quotaLabel = $planLabels[$planId] ?? ($existingOrder['plan_name'] ?? $planId);

$db = null;
$existingOrder = null;
try {
    $db = getDB();
    if ($db) {
        $stmt = $db->prepare("SELECT * FROM `storage_orders` WHERE `id` = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $existingOrder = $stmt->fetch();
    }
} catch (Exception $e) {}

// Nếu đơn hàng đã được Webhook Ngân Hàng hoặc Quản Trị Viên phê duyệt
if ($existingOrder && $existingOrder['status'] === 'completed') {
    jsonResponse(true, [
        'order_id'       => $orderId,
        'username'       => $username,
        'plan_id'        => $planId,
        'quota_label'    => $quotaLabel,
        'status'         => 'completed',
        'verified'       => true,
        'paid_at'        => $existingOrder['paid_at'] ?: date('Y-m-d H:i:s'),
        'message'        => 'Giao dịch chuyển khoản đã được xác thực thành công. Gói ' . $quotaLabel . ' đã kích hoạt!'
    ], 'Giao dịch đã hoàn tất.');
}

// Nếu quản trị viên / test mode phê duyệt trực tiếp
if ($adminApprove) {
    if ($db) {
        $stmt = $db->prepare("UPDATE `storage_orders` SET `status` = 'completed', `paid_at` = NOW() WHERE `id` = ?");
        $stmt->execute([$orderId]);
    }
    jsonResponse(true, [
        'order_id'       => $orderId,
        'username'       => $username,
        'plan_id'        => $planId,
        'quota_label'    => $quotaLabel,
        'status'         => 'completed',
        'verified'       => true,
        'paid_at'        => date('Y-m-d H:i:s'),
        'message'        => 'Quản trị viên đã phê duyệt thanh toán. Gói ' . $quotaLabel . ' đã kích hoạt!'
    ], 'Kích hoạt thành công.');
}

// Nếu người dùng mới chỉ bấm nút mà tiền chưa vào tài khoản thực tế
// Chuyển trạng thái sang `waiting_verification` (Đang chờ đối soát sao kê ngân hàng)
if ($db) {
    try {
        $stmt = $db->prepare("UPDATE `storage_orders` SET `status` = 'waiting_verification' WHERE `id` = ? AND `status` = 'pending'");
        $stmt->execute([$orderId]);
    } catch (Exception $e) {}
}

// Gửi cảnh báo Telegram để kiểm tra sao kê thực tế
try {
    TelegramService::sendAlert('🔔 KHÁCH BÁO ĐÃ CHUYỂN KHOẢN (CHỜ ĐỐI SOÁT)', [
        'Mã Đơn'     => $orderId,
        'Tài Khoản'  => $username,
        'Gói Mua'    => $quotaLabel,
        'STK Nhận'   => '20080699998386 (MBBank)',
        'Trạng Thái' => 'Chờ tiền vào tài khoản thực tế để mở khóa'
    ]);
} catch (Exception $e) {}

// Phản hồi chưa được kích hoạt vì chưa nhận được tiền thực tế
jsonResponse(false, [
    'order_id'       => $orderId,
    'username'       => $username,
    'plan_id'        => $planId,
    'quota_label'    => $quotaLabel,
    'status'         => 'waiting_verification',
    'verified'       => false,
    'account_no'     => '20080699998386',
    'message'        => 'Hệ thống chưa nhận được tiền chuyển khoản tương ứng trên STK 20080699998386. Vui lòng hoàn tất chuyển khoản và chờ hệ thống đối soát giao dịch.'
], 'Chưa nhận được thanh toán thực tế.', 200);
