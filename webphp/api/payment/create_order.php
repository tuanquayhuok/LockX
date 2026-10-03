<?php
/**
 * ==============================================================================
 * API Endpoint: Tạo Đơn Hàng Mua Dung Lượng Két Sắt LockX
 * Phương thức: POST / GET /api/payment/create_order.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

// Cấu hình thông tin nhận thanh toán VietQR / Ngân Hàng chính xác
define('PAYMENT_BANK_ID', 'MB');             // Mã ngân hàng: MB (MBBank)
define('PAYMENT_BANK_NAME', 'MBBank (Quân Đội)');
define('PAYMENT_ACCOUNT_NO', '20080699998386');   // Số tài khoản ngân hàng
define('PAYMENT_ACCOUNT_NAME', 'QUANG TRONG TUAN');

$input = getRequestData();
$username = trim($input['username'] ?? ($_GET['username'] ?? 'User'));
$planId = trim($input['plan_id'] ?? ($_GET['plan_id'] ?? '50GB'));

// Định nghĩa bảng giá chuẩn theo gói dung lượng & Thẻ VIP
$planPrices = [
    '50GB'      => ['name' => 'Gói LockX+ Cá Nhân (50 GB)', 'amount' => 19000, 'quota_bytes' => 53687091200],
    '200GB'     => ['name' => 'Gói LockX Pro Nâng Cao (200 GB)', 'amount' => 59000, 'quota_bytes' => 214748364800],
    '2TB'       => ['name' => 'Gói LockX Max Ultra (2 TB)', 'amount' => 199000, 'quota_bytes' => 2199023255552],
    'silver'    => ['name' => 'Thẻ VIP Bạc (Silver Card)', 'amount' => 69000, 'type' => 'vip_card'],
    'gold'      => ['name' => 'Thẻ VIP Vàng (Gold Card)', 'amount' => 199000, 'type' => 'vip_card'],
    'diamond'   => ['name' => 'Thẻ VIP Kim Cương (Diamond Card)', 'amount' => 399000, 'type' => 'vip_card'],
    'titanium'  => ['name' => 'Thẻ VIP Titanium (Titanium Card)', 'amount' => 799000, 'type' => 'vip_card'],
    'uranium'   => ['name' => 'Thẻ VIP Uranium Vô Cực (Uranium Card)', 'amount' => 1499000, 'type' => 'vip_card'],
];

$paymentMethod = trim($input['payment_method'] ?? ($_GET['payment_method'] ?? 'vietqr'));

if (isset($input['amount']) && (int)$input['amount'] > 0) {
    $amount = (int)$input['amount'];
    $planName = trim($input['plan_name'] ?? ($planPrices[$planId]['name'] ?? 'Đơn hàng LockX'));
} else if (isset($planPrices[$planId])) {
    $planInfo = $planPrices[$planId];
    $amount = $planInfo['amount'];
    $planName = $planInfo['name'];
} else {
    jsonResponse(false, null, 'Gói dung lượng hoặc thẻ VIP không hợp lệ.', 400);
}

// Tạo mã đơn hàng duy nhất: LX + 6 số ngẫu nhiên
$orderId = 'LX' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 6));
$transferContent = 'LOCKX ' . $orderId . ' ' . preg_replace('/[^A-Za-z0-9]/', '', $username);

// Sinh liên kết VietQR chuẩn Napas 24/7 (tương thích mọi app ngân hàng Việt Nam)
$qrUrl = 'https://img.vietqr.io/image/' . PAYMENT_BANK_ID . '-' . PAYMENT_ACCOUNT_NO . '-compact2.png'
    . '?amount=' . $amount
    . '&addInfo=' . urlencode($transferContent)
    . '&accountName=' . urlencode(PAYMENT_ACCOUNT_NAME);

// Lưu vào cơ sở dữ liệu nếu có kết nối MySQL
try {
    $db = getDB();
    if ($db) {
        $db->exec("
            CREATE TABLE IF NOT EXISTS `storage_orders` (
                `id` VARCHAR(64) PRIMARY KEY,
                `username` VARCHAR(64) NOT NULL,
                `plan_id` VARCHAR(32) NOT NULL,
                `plan_name` VARCHAR(128) NOT NULL,
                `amount` INT NOT NULL,
                `status` ENUM('pending', 'waiting_verification', 'completed', 'cancelled') DEFAULT 'pending',
                `transfer_content` VARCHAR(128) NOT NULL,
                `payment_method` VARCHAR(32) DEFAULT 'vietqr',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `paid_at` DATETIME DEFAULT NULL,
                INDEX `idx_order_user` (`username`),
                INDEX `idx_order_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $stmt = $db->prepare("
            INSERT INTO `storage_orders` (`id`, `username`, `plan_id`, `plan_name`, `amount`, `status`, `transfer_content`, `payment_method`, `created_at`)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW())
        ");
        $stmt->execute([$orderId, $username, $planId, $planName, $amount, $transferContent, $paymentMethod]);
    }
} catch (Exception $e) {}

// Gửi thông báo Telegram khi có khách tạo đơn mua dung lượng hoặc Thẻ VIP
try {
    TelegramService::sendAlert('🛒 ĐƠN HÀNG MỚI ĐƯỢC TẠO', [
        'Mã Đơn'         => $orderId,
        'Người Mua'      => $username,
        'Gói / Thẻ VIP'  => $planName,
        'Phương Thức'    => strtoupper($paymentMethod),
        'Số Tiền'        => number_format($amount, 0, ',', '.') . 'đ',
        'Nội Dung CK'    => $transferContent,
        'STK Nhận'       => PAYMENT_ACCOUNT_NO . ' (' . PAYMENT_BANK_NAME . ')'
    ]);
} catch (Exception $e) {}

$orderData = [
    'order_id'         => $orderId,
    'username'         => $username,
    'plan_id'          => $planId,
    'plan_name'        => $planName,
    'amount'           => $amount,
    'amount_formatted' => number_format($amount, 0, ',', '.') . 'đ',
    'status'           => 'pending',
    'transfer_content' => $transferContent,
    'qr_url'           => $qrUrl,
    'bank_info'        => [
        'bank_code'    => PAYMENT_BANK_ID,
        'bank_name'    => PAYMENT_BANK_NAME,
        'account_no'   => PAYMENT_ACCOUNT_NO,
        'account_name' => PAYMENT_ACCOUNT_NAME,
    ],
    'created_at'       => date('Y-m-d H:i:s')
];

jsonResponse(true, $orderData, 'Tạo đơn hàng thanh toán gói dung lượng thành công.');
