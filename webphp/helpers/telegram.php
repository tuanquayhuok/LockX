<?php
/**
 * ==============================================================================
 * LockX Vault - Helper Tích Hợp Bot Telegram (Telegram Bot Service)
 * Hỗ trợ gửi tin nhắn cảnh báo, thông báo tin nhắn mới, nhật ký cuộc gọi
 * ==============================================================================
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

class TelegramService {

    /**
     * Lấy Bot Token (Ưu tiên bảng system_settings nếu trong config.php chưa điền)
     */
    public static function getBotToken() {
        if (!empty(TELEGRAM_BOT_TOKEN)) {
            return TELEGRAM_BOT_TOKEN;
        }
        return Database::getInstance()->getSetting('telegram_bot_token', '');
    }

    /**
     * Lấy Chat ID mặc định
     */
    public static function getDefaultChatId() {
        if (!empty(TELEGRAM_CHAT_ID)) {
            return TELEGRAM_CHAT_ID;
        }
        return Database::getInstance()->getSetting('telegram_chat_id', '');
    }

    /**
     * Gửi tin nhắn văn bản qua Telegram Bot
     *
     * @param string $message Nội dung tin nhắn (Hỗ trợ định dạng HTML: <b>, <i>, <code>, <pre>)
     * @param string|null $chatId Chat ID nhận tin (Nếu null sẽ lấy chat_id mặc định)
     * @param string $parseMode Chế độ parse ('HTML' hoặc 'Markdown')
     * @return array ['success' => bool, 'response' => mixed, 'error' => string|null]
     */
    /**
     * Gửi tin nhắn văn bản qua Telegram Bot (Có hỗ trợ Nút bấm Keyboard & Inline)
     *
     * @param string $message Nội dung tin nhắn (Hỗ trợ HTML: <b>, <i>, <code>, <pre>)
     * @param string|null $chatId Chat ID nhận tin (Nếu null sẽ lấy chat_id mặc định)
     * @param string $parseMode Chế độ parse ('HTML' hoặc 'Markdown')
     * @param array|null $replyMarkup Mảng bàn phím inline_keyboard hoặc keyboard
     * @return array ['success' => bool, 'response' => mixed, 'error' => string|null]
     */
    public static function sendMessage($message, $chatId = null, $parseMode = 'HTML', $replyMarkup = null) {
        $token = self::getBotToken();
        $targetChatId = $chatId ?: self::getDefaultChatId();

        if (empty($token) || empty($targetChatId)) {
            self::logNotification('telegram', $targetChatId ?: 'unknown', 'Telegram Message', $message, 'failed', 'Chưa cấu hình Telegram Bot Token hoặc Chat ID');
            return [
                'success' => false,
                'error'   => 'Chưa cấu hình Bot Token hoặc Chat ID trong config.php hoặc Cài đặt hệ thống.'
            ];
        }

        $apiUrl = "https://api.telegram.org/bot{$token}/sendMessage";
        $postData = [
            'chat_id'                  => $targetChatId,
            'text'                     => $message,
            'parse_mode'               => $parseMode,
            'disable_web_page_preview' => true
        ];

        if ($replyMarkup !== null) {
            $postData['reply_markup'] = json_encode($replyMarkup);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $isSuccess = ($httpCode === 200);
        $jsonResult = json_decode($result, true);

        // Ghi nhật ký vào database
        self::logNotification(
            'telegram',
            $targetChatId,
            'Telegram Notification',
            $message,
            $isSuccess ? 'sent' : 'failed',
            $isSuccess ? null : ($curlError ?: ($jsonResult['description'] ?? 'Lỗi không xác định từ Telegram'))
        );

        return [
            'success'  => $isSuccess,
            'httpCode' => $httpCode,
            'result'   => $jsonResult,
            'error'    => $isSuccess ? null : ($curlError ?: ($jsonResult['description'] ?? 'Lỗi không xác định'))
        ];
    }

    /**
     * Phản hồi sự kiện nhấn nút Inline Callback Query
     */
    public static function answerCallbackQuery($callbackQueryId, $text = null, $showAlert = false) {
        $token = self::getBotToken();
        if (empty($token) || empty($callbackQueryId)) return false;

        $apiUrl = "https://api.telegram.org/bot{$token}/answerCallbackQuery";
        $postData = ['callback_query_id' => $callbackQueryId];
        if ($text) {
            $postData['text'] = $text;
            $postData['show_alert'] = $showAlert;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        curl_close($ch);
        return true;
    }

    /**
     * Gửi bảng thông báo cảnh báo chuyên nghiệp chuẩn Apple Style tới Telegram
     *
     * @param string $title Tiêu đề cảnh báo
     * @param array $fields Mảng key => value chi tiết (VD: ['Người gửi' => 'Admin', 'Số điện thoại' => '09888...'])
     * @param string|null $chatId
     * @return array
     */
    public static function sendAlert($title, $fields = [], $chatId = null) {
        $now = date('d/m/Y H:i:s');
        $msg = "🛡️ <b>LOCKX VAULT NOTIFICATION</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "📌 <b>" . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . "</b>\n\n";

        foreach ($fields as $key => $value) {
            $msg .= "• <b>" . htmlspecialchars($key, ENT_QUOTES, 'UTF-8') . ":</b> " . htmlspecialchars($value, ENT_QUOTES, 'UTF-8') . "\n";
        }

        $msg .= "\n⏱️ <i>Thời gian: {$now}</i>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━";

        return self::sendMessage($msg, $chatId, 'HTML');
    }

    /**
     * Ghi nhật ký gửi thông báo vào database
     */
    private static function logNotification($channel, $recipient, $subject, $content, $status, $errorMessage = null) {
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare("
                INSERT INTO notification_logs (channel, recipient, subject, content, status, error_message, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$channel, $recipient, $subject, $content, $status, $errorMessage]);
        } catch (Exception $e) {
            // Tránh văng lỗi nếu DB tạm thời bận
        }
    }
}

// Function helper nhanh
function sendTelegramMessage($text, $chatId = null) {
    return TelegramService::sendMessage($text, $chatId);
}

function sendTelegramAlert($title, $fields = [], $chatId = null) {
    return TelegramService::sendAlert($title, $fields, $chatId);
}
