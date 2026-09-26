<?php
/**
 * ==============================================================================
 * API Endpoint: Admin Phê Duyệt / Từ Chối Tích Xanh (POST /api/auth/verify_action.php)
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';
require_once __DIR__ . '/../../helpers/mailer.php';
require_once __DIR__ . '/../../helpers/push.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$requestId = intval($input['request_id'] ?? 0);
$username  = trim($input['username'] ?? '');
$action    = trim($input['action'] ?? 'approve'); // 'approve' hoặc 'reject'
$adminNote = trim($input['admin_note'] ?? '');

$db = getDB();

try {
    // Tìm yêu cầu theo request_id hoặc username
    if ($requestId > 0) {
        $stmt = $db->prepare("SELECT * FROM verification_requests WHERE id = ? LIMIT 1");
        $stmt->execute([$requestId]);
    } else {
        $stmt = $db->prepare("SELECT * FROM verification_requests WHERE username = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$username]);
    }

    $req = $stmt->fetch();

    if (!$req) {
        jsonResponse(false, null, 'Không tìm thấy yêu cầu xác minh phù hợp.', 404);
    }

    $targetUsername = $req['username'];
    $targetEmail    = $req['email'];
    $targetName     = $req['display_name'];

    if ($action === 'approve') {
        $verifiedKey = 'LX-VERIFIED-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
        $now = date('d/m/Y H:i:s');

        // 1. Cập nhật bảng verification_requests
        $upReqStmt = $db->prepare("
            UPDATE verification_requests SET 
                status = 'approved', 
                verified_key = ?, 
                admin_note = ?, 
                approved_at = NOW() 
            WHERE id = ?
        ");
        $upReqStmt->execute([$verifiedKey, $adminNote ?: 'Đã được quản trị viên phê duyệt', $req['id']]);

        // 2. Cập nhật bảng users để kích hoạt Tích Xanh
        $upUserStmt = $db->prepare("
            UPDATE users SET 
                is_verified = 1, 
                verified_key = ?, 
                verified_at = ? 
            WHERE username = ?
        ");
        $upUserStmt->execute([$verifiedKey, $now, $targetUsername]);

        // 3. Gửi thông báo Telegram
        TelegramService::sendAlert('🎉 ĐÃ DUYỆT TÍCH XANH LOCKX VERIFIED', [
            'ID Yêu cầu'   => "#{$req['id']}",
            'Username'     => "@{$targetUsername}",
            'Tên hiển thị' => $targetName,
            'Mã chứng chỉ' => $verifiedKey,
            'Ngày cấp'     => $now,
            'Trạng thái'   => '🟢 ĐÃ XÁC MINH CHÍNH CHỦ'
        ]);

        // 4. Gửi Email thông báo (Nếu có email)
        if (!empty($targetEmail)) {
            $emailHtml = "<p>Xin chào <b>{$targetName}</b>,</p>";
            $emailHtml .= "<p>Yêu cầu xác minh danh tính <b>LockX Verified (Tích Xanh)</b> của bạn đã được quản trị viên phê duyệt thành công!</p>";
            $emailHtml .= "<p><b>Mã chứng nhận bảo mật:</b> <code>{$verifiedKey}</code><br><b>Thời gian:</b> {$now}</p>";
            MailerService::sendMail($targetEmail, 'Chúc Mừng: Tài Khoản Đã Được Cấp Tích Xanh LockX Verified', $emailHtml);
        }

        // 5. Gửi Push Notification ra màn hình điện thoại bên ngoài
        PushNotificationService::sendToUser(
            $targetUsername,
            '🛡️ Phê Duyệt Tích Xanh Thành Công',
            "Xin chúc mừng {$targetName}! Hồ sơ của bạn đã được Quản trị viên cấp Tích Xanh LockX Verified.",
            ['action' => 'verified_approved', 'cert_key' => $verifiedKey]
        );

        jsonResponse(true, [
            'request_id'   => $req['id'],
            'username'     => $targetUsername,
            'status'       => 'approved',
            'verified_key' => $verifiedKey,
            'verified_at'  => $now
        ], 'Đã phê duyệt và cấp Tích Xanh thành công cho người dùng.');

    } else {
        // Từ chối yêu cầu
        $upReqStmt = $db->prepare("
            UPDATE verification_requests SET 
                status = 'rejected', 
                admin_note = ? 
            WHERE id = ?
        ");
        $upReqStmt->execute([$adminNote ?: 'Yêu cầu không đủ điều kiện xác thực', $req['id']]);

        // Gửi thông báo Telegram
        TelegramService::sendAlert('❌ ĐÃ TỪ CHỐI YÊU CẦU TÍCH XANH', [
            'ID Yêu cầu' => "#{$req['id']}",
            'Username'   => "@{$targetUsername}",
            'Lý do'      => $adminNote ?: 'Chưa đạt tiêu chí bảo mật',
            'Trạng thái' => '🔴 ĐÃ TỪ CHỐI'
        ]);

        // Gửi Push Notification thông báo từ chối
        PushNotificationService::sendToUser(
            $targetUsername,
            '⚠️ Thông Báo Xác Minh LockX',
            "Yêu cầu cấp Tích Xanh của bạn chưa được phê duyệt. Lý do: " . ($adminNote ?: 'Chưa đạt tiêu chuẩn'),
            ['action' => 'verified_rejected']
        );

        jsonResponse(true, [
            'request_id' => $req['id'],
            'username'   => $targetUsername,
            'status'     => 'rejected'
        ], 'Đã từ chối yêu cầu cấp Tích Xanh.');
    }

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi xử lý duyệt yêu cầu: ' . $e->getMessage(), 500);
}
