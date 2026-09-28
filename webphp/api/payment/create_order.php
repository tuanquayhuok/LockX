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

// Định nghĩa bảng giá chuẩn theo gói dung lượng
$planPrices = [
    '50GB'  => ['name' => 'Gói LockX+ Cá Nhân (50 GB)', 'amount' => 19000, 'quota_bytes' => 53687091200],
    '200GB' => ['name' => 'Gói LockX Pro Nâng Cao (200 GB)', 'amount' => 59000, 'quota_bytes' => 214748364800],
    '2TB'   => ['name' => 'Gói LockX Max Ultra (2 TB)', 'amount' => 199000, 'quota_bytes' => 2199023255552],
];

if (!isset($planPrices[$planId])) {
    jsonResponse(false, null, 'Gói dung lượng không hợp lệ hoặc miễn phí.', 400);
}

$planInfo = $planPrices[$planId];
$amount = $planInfo['amount'];
$planName = $planInfo['name'];

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
            INSERT INTO `storage_orders` (`id`, `username`, `plan_id`, `plan_name`, `amount`, `status`, `transfer_content`, `created_at`)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())
        ");
        $stmt->execute([$orderId, $username, $planId, $planName, $amount, $transferContent]);
    }
} catch (Exception $e) {}

// Gửi thông báo Telegram khi có khách tạo đơn mua dung lượng
try {
    TelegramService::sendAlert('🛒 ĐƠN HÀNG MUA DUNG LƯỢNG MỚI', [
        'Mã Đơn'     => $orderId,
        'Người Mua'  => $username,
        'Gói Mua'    => $planName,
        'Số Tiền'    => number_format($amount, 0, ',', '.') . 'đ',
        'Nội Dung CK' => $transferContent,
        'STK Nhận'   => PAYMENT_ACCOUNT_NO . ' (' . PAYMENT_BANK_NAME . ')'
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
