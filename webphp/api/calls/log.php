<?php
/**
 * ==============================================================================
 * API Endpoint: Ghi Nhật Ký Cuộc Gọi (POST /api/calls/log.php)
 * Lưu trữ cuộc gọi đến/đi/nhỡ và tự động cảnh báo qua Telegram/Email
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/telegram.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.', 405);
}

$input = getRequestData();

$callerName      = trim($input['caller_name'] ?? 'Không rõ');
$callerPhone     = trim($input['caller_phone'] ?? '');
$receiverName    = trim($input['receiver_name'] ?? 'LockX User');
$receiverPhone   = trim($input['receiver_phone'] ?? '');
$callType        = trim($input['call_type'] ?? 'incoming'); // incoming, outgoing, missed, rejected, voip_audio, voip_video
$durationSeconds = intval($input['duration_seconds'] ?? 0);
$status          = trim($input['status'] ?? ($callType === 'missed' ? 'missed' : 'completed'));
$note            = trim($input['note'] ?? '');
$startTime       = trim($input['start_time'] ?? date('Y-m-d H:i:s'));
$endTime         = trim($input['end_time'] ?? date('Y-m-d H:i:s', strtotime($startTime) + $durationSeconds));

if (empty($callerPhone) && empty($receiverPhone)) {
    jsonResponse(false, null, 'Vui lòng cung cấp số điện thoại người gọi hoặc người nhận.', 400);
}

$db = getDB();

try {
    $stmt = $db->prepare("
        INSERT INTO call_logs (
            caller_name, caller_phone, receiver_name, receiver_phone, 
            call_type, duration_seconds, status, note, start_time, end_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $callerName, $callerPhone, $receiverName, $receiverPhone,
        $callType, $durationSeconds, $status, $note, $startTime, $endTime
    ]);

    $callLogId = $db->lastInsertId();

    // Lấy bản ghi vừa tạo
    $getStmt = $db->prepare("SELECT * FROM call_logs WHERE id = ?");
    $getStmt->execute([$callLogId]);
    $createdLog = $getStmt->fetch();

    // Map tên loại cuộc gọi sang tiếng Việt dễ đọc
    $typeMap = [
        'incoming'   => '📞 Cuộc gọi đến',
        'outgoing'   => '↗️ Cuộc gọi đi',
        'missed'     => '⚠️ Cuộc gọi nhỡ',
        'rejected'   => '🚫 Đã từ chối',
        'voip_audio' => '🔊 Cuộc gọi thoại VoIP',
        'voip_video' => '📹 Cuộc gọi Video'
    ];
    $typeName = $typeMap[$callType] ?? $callType;

    // Gửi thông báo Telegram khi có cuộc gọi mới hoặc cuộc gọi nhỡ
    TelegramService::sendAlert('Nhật Ký Cuộc Gọi Mới', [
        'Loại cuộc gọi'   => $typeName,
        'Người gọi'       => "{$callerName} ({$callerPhone})",
        'Người nhận'      => "{$receiverName} ({$receiverPhone})",
        'Thời lượng'      => "{$durationSeconds} giây",
        'Trạng thái'      => strtoupper($status),
        'Thời gian'       => $startTime
    ]);

    jsonResponse(true, $createdLog, 'Đã ghi nhận nhật ký cuộc gọi thành công.', 201);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi khi lưu cuộc gọi: ' . $e->getMessage(), 500);
}
