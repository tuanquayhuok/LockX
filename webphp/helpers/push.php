<?php
/**
 * ==============================================================================
 * LockX Vault - Dịch Vụ Gửi Push Notification Ra Màn Hình Điện Thoại (Expo Push / FCM)
 * Cho phép Web Admin phát thông báo đẩy ra ngoài màn hình khóa (Lock screen / Banner)
 * ==============================================================================
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

class PushNotificationService {

    /**
     * Gửi Push Notification đến 1 hoặc nhiều thiết bị qua Expo Push API
     * 
     * @param string|array $tokens Token Expo Push (VD: ExponentPushToken[xxxx])
     * @param string $title Tiêu đề thông báo
     * @param string $body Nội dung thông báo hiển thị ngoài màn hình
     * @param array $data Dữ liệu kèm theo khi bấm vào thông báo
     * @param string $sound Âm thanh thông báo ('default' hoặc custom)
     * @param int|null $badge Số badge trên icon app
     * @return array Kết quả gửi
     */
    public static function sendPush($tokens, $title, $body, $data = [], $sound = 'default', $badge = null) {
        if (empty($tokens)) {
            return ['success' => false, 'error' => 'Danh sách thiết bị nhận (tokens) trống.'];
        }

        if (is_string($tokens)) {
            $tokens = [$tokens];
        }

        // Lọc token hợp lệ
        $validTokens = array_values(array_filter($tokens, function($token) {
            return !empty($token) && (strpos($token, 'ExponentPushToken') !== false || strpos($token, 'ExpoPushToken') !== false || strlen($token) > 10);
        }));

        if (empty($validTokens)) {
            return ['success' => false, 'error' => 'Không có token thiết bị hợp lệ.'];
        }

        // Chuẩn bị payload theo chuẩn Expo Push Notification API
        $messages = [];
        foreach ($validTokens as $token) {
            $item = [
                'to'        => $token,
                'sound'     => $sound,
                'title'     => $title,
                'body'      => $body,
                'data'      => $data,
                'priority'  => 'high',
                'channelId' => 'default'
            ];
            if ($badge !== null) {
                $item['badge'] = $badge;
            }
            $messages[] = $item;
        }

        $apiUrl = 'https://exp.host/--/api/v2/push/send';
        $postData = json_encode($messages);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'Accept-Encoding: gzip, deflate',
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $isSuccess = ($httpCode === 200);
        $jsonResult = json_decode($response, true);

        // Ghi log vào Database
        self::logPush(implode(',', $validTokens), $title, $body, $isSuccess ? 'sent' : 'failed', $curlError ?: ($response ?? ''));

        return [
            'success'  => $isSuccess,
            'httpCode' => $httpCode,
            'result'   => $jsonResult,
            'error'    => $isSuccess ? null : ($curlError ?: 'Lỗi kết nối máy chủ Push Notification')
        ];
    }

    /**
     * Gửi Push Notification đến 1 Username cụ thể
     */
    public static function sendToUser($username, $title, $body, $data = []) {
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare("SELECT device_token FROM users WHERE username = ? AND device_token IS NOT NULL AND device_token != '' LIMIT 1");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if ($user && !empty($user['device_token'])) {
                return self::sendPush($user['device_token'], $title, $body, $data);
            }

            return ['success' => false, 'error' => "Người dùng {$username} chưa đăng ký device_token."];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Gửi Push Notification quảng bá đến tất cả người dùng
     */
    public static function broadcastAll($title, $body, $data = []) {
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->query("SELECT DISTINCT device_token FROM users WHERE device_token IS NOT NULL AND device_token != ''");
            $tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($tokens)) {
                return ['success' => false, 'error' => 'Không có thiết bị nào trong cơ sở dữ liệu.'];
            }

            return self::sendPush($tokens, $title, $body, $data);
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Ghi nhật ký vào database
     */
    private static function logPush($recipient, $subject, $content, $status, $errorMessage = null) {
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare("
                INSERT INTO notification_logs (channel, recipient, subject, content, status, error_message, sent_at)
                VALUES ('push', ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$recipient, $subject, $content, $status, $errorMessage]);
        } catch (Exception $e) {
            // bỏ qua
        }
    }
}

function sendPushToUser($username, $title, $body, $data = []) {
    return PushNotificationService::sendToUser($username, $title, $body, $data);
}

function sendPushBroadcast($title, $body, $data = []) {
    return PushNotificationService::broadcastAll($title, $body, $data);
}
