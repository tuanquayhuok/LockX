<?php
/**
 * ==============================================================================
 * LockX Vault - Helper Gửi Email Tự Động (Email Notification Service)
 * Hỗ trợ định dạng HTML cao cấp chuẩn Apple giao diện Dark/Light
 * ==============================================================================
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

class MailerService {

    /**
     * Gửi email HTML tới người nhận
     *
     * @param string $to Địa chỉ email người nhận
     * @param string $subject Tiêu đề email
     * @param string $htmlBody Nội dung HTML
     * @param string|null $fromEmail Email người gửi (tùy chọn)
     * @param string|null $fromName Tên người gửi (tùy chọn)
     * @return array ['success' => bool, 'message' => string]
     */
    public static function sendMail($to, $subject, $htmlBody, $fromEmail = null, $fromName = null) {
        $fromEmail = $fromEmail ?: SMTP_FROM_EMAIL;
        $fromName  = $fromName ?: SMTP_FROM_NAME;

        // Bọc nội dung trong template HTML hiện đại chuẩn Apple
        $fullHtml = self::buildHtmlTemplate($subject, $htmlBody);

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $headers .= "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$fromEmail}>\r\n";
        $headers .= "Reply-To: {$fromEmail}\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

        $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";

        // Gửi qua hàm mail() chuẩn của PHP trên Linux/cPanel/DirectAdmin/VPS
        $sent = @mail($to, $encodedSubject, $fullHtml, $headers);

        // Ghi nhật ký vào database
        self::logNotification(
            'email',
            $to,
            $subject,
            $htmlBody,
            $sent ? 'sent' : 'failed',
            $sent ? null : 'Lỗi gửi mail qua hàm PHP mail(). Vui lòng kiểm tra cấu hình Sendmail/Postfix trên hosting.'
        );

        return [
            'success' => (bool)$sent,
            'message' => $sent ? 'Email đã được gửi thành công.' : 'Không thể gửi email qua máy chủ hiện tại.'
        ];
    }

    /**
     * Tạo template Email HTML phong cách Apple sang trọng
     */
    public static function buildHtmlTemplate($title, $bodyContent) {
        $year = date('Y');
        return <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title}</title>
    <style>
        body { margin: 0; padding: 0; background-color: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1C1C1E; }
        .container { max-width: 600px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E5E5EA; }
        .header { background: #000000; padding: 24px 30px; text-align: center; }
        .header h1 { color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { color: #8E8E93; margin: 4px 0 0; font-size: 13px; }
        .badge { display: inline-block; background: #0A84FF; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; margin-top: 6px; }
        .content { padding: 30px; line-height: 1.6; font-size: 15px; }
        .card { background: #F8F9FA; border-radius: 12px; padding: 16px 20px; margin: 18px 0; border: 1px solid #E9ECEF; }
        .footer { background: #F2F2F7; padding: 18px 30px; text-align: center; font-size: 12px; color: #8E8E93; border-top: 1px solid #E5E5EA; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ LockX Vault Security</h1>
            <p>Hệ thống cảnh báo & thông báo bảo mật đa tầng</p>
            <span class="badge">LOCKX VERIFIED</span>
        </div>
        <div class="content">
            <h2 style="font-size: 18px; color: #000000; margin-top: 0;">{$title}</h2>
            <div class="card">
                {$bodyContent}
            </div>
            <p style="font-size: 13px; color: #6C6C70;">
                Thông báo này được gửi tự động từ máy chủ LockX Vault. Vui lòng không chia sẻ thông tin mật mã cho bất kỳ ai.
            </p>
        </div>
        <div class="footer">
            © {$year} LockX Security System. Tất cả các quyền được bảo lưu.
        </div>
    </div>
</body>
</html>
HTML;
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
        } catch (Exception $e) {}
    }
}

// Function helper nhanh
function sendSystemEmail($to, $subject, $htmlContent) {
    return MailerService::sendMail($to, $subject, $htmlContent);
}
