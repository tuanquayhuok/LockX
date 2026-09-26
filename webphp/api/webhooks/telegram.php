<?php
/**
 * ==============================================================================
 * LockX Vault - Telegram Bot Webhook 2 Chiều Chuẩn Giao Diện Đẹp (Nút Bấm Trực Quan)
 * Tự động đồng bộ với Web aecongnghe.online & Mobile App GVault
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

// Hàm gửi tin nhắn Telegram kèm Nút bấm Inline Keyboard trực tiếp
function sendTelegramWithButtons($chatId, $text, $inlineButtons = null, $replyButtons = null) {
    $token = defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : '';
    if (empty($token) || empty($chatId)) return false;

    $apiUrl = "https://api.telegram.org/bot{$token}/sendMessage";
    $postData = [
        'chat_id'                  => $chatId,
        'text'                     => $text,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => true
    ];

    if ($inlineButtons !== null) {
        $postData['reply_markup'] = json_encode(['inline_keyboard' => $inlineButtons]);
    } elseif ($replyButtons !== null) {
        $postData['reply_markup'] = json_encode([
            'keyboard' => $replyButtons,
            'resize_keyboard' => true,
            'one_time_keyboard' => false
        ]);
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true);
}

function answerCallback($callbackId, $text = null) {
    $token = defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : '';
    if (empty($token) || empty($callbackId)) return false;

    $apiUrl = "https://api.telegram.org/bot{$token}/answerCallbackQuery";
    $postData = ['callback_query_id' => $callbackId];
    if ($text) $postData['text'] = $text;

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

// Bảng nút bấm Inline chuẩn đẹp
function getMainMenuButtons() {
    return [
        [
            ['text' => '🔑 Quên Mật Khẩu (OTP)', 'callback_data' => 'btn_otp'],
            ['text' => '🛡️ Duyệt Tích Xanh', 'callback_data' => 'btn_verify']
        ],
        [
            ['text' => '👥 Quản Lý Users', 'callback_data' => 'btn_users'],
            ['text' => '📊 Thống Kê Server', 'callback_data' => 'btn_stats']
        ],
        [
            ['text' => '💬 Tin Nhắn Chat', 'callback_data' => 'btn_messages'],
            ['text' => '📞 Nhật Ký Cuộc Gọi', 'callback_data' => 'btn_calls']
        ],
        [
            ['text' => '🌐 Mở Web Dashboard (aecongnghe.online)', 'url' => 'https://aecongnghe.online/']
        ]
    ];
}

// Nhận dữ liệu webhook
$rawInput = file_get_contents('php://input');
$update   = json_decode($rawInput, true);

if (!$update) {
    http_response_code(200);
    echo "OK - Telegram Webhook Active";
    exit();
}

$db = getDB();

// ==============================================================================
// 1. XỬ LÝ KHI NGƯỜI DÙNG BẤM NÚT TRÊN MENU (CALLBACK QUERY)
// ==============================================================================
if (isset($update['callback_query'])) {
    $cb       = $update['callback_query'];
    $cbId     = $cb['id'];
    $chatId   = $cb['message']['chat']['id'] ?? '';
    $action   = $cb['data'] ?? '';
    $fromName = $cb['from']['first_name'] ?? 'Admin';

    answerCallback($cbId);

    // 1.1. Bấm Quên Mật Khẩu (OTP)
    if ($action === 'btn_otp') {
        $msg = "🔑 <b>QUÊN MẬT KHẨU - YÊU CẦU MÃ OTP</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "Vui lòng nhập tên tài khoản (username) của bạn để nhận mã OTP xác thực:\n\n";
        $msg .= "👉 Gõ theo cú pháp: <code>/otp username</code>\n";
        $msg .= "<i>(Ví dụ: <code>/otp trongtuangoat</code> hoặc <code>/otp anhkhoadz</code>)</i>\n\n";
        $msg .= "⏱️ <i>Mã OTP 6 số chỉ cấp riêng cho tài khoản của bạn và có hiệu lực trong 2 phút.</i>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━";

        sendTelegramWithButtons($chatId, $msg, [
            [
                ['text' => '🔙 Menu Chính', 'callback_data' => 'btn_main']
            ]
        ]);
    }

    // 1.2. Bấm Duyệt Cấp Tích Xanh
    elseif ($action === 'btn_verify') {
        try {
            $stmt = $db->query("SELECT * FROM verification_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5");
            $reqs = $stmt->fetchAll();

            $msg = "🛡️ <b>DANH SÁCH HỒ SƠ CHỜ DUYỆT TÍCH XANH:</b>\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";

            $buttons = [];
            if (empty($reqs)) {
                $msg .= "🟢 <i>Hiện không có yêu cầu nào chờ duyệt. Tất cả hồ sơ đã xử lý xong!</i>\n";
            } else {
                foreach ($reqs as $idx => $r) {
                    $num = $idx + 1;
                    $t = date('H:i d/m', strtotime($r['created_at']));
                    $msg .= "<b>{$num}. #{$r['id']} - @{$r['username']} ({$r['display_name']})</b>\n";
                    $msg .= "• Thiết bị: {$r['device_info']}\n• Lúc: {$t}\n\n";

                    $buttons[] = [
                        ['text' => "✓ Duyệt #{$r['id']} (@{$r['username']})", 'callback_data' => "approve_{$r['id']}"],
                        ['text' => "✕ Từ chối #{$r['id']}", 'callback_data' => "reject_{$r['id']}"]
                    ];
                }
            }

            $buttons[] = [
                ['text' => '🔙 Quay Lại Menu Chính', 'callback_data' => 'btn_main'],
                ['text' => '🌐 Duyệt Trên Web', 'url' => 'https://aecongnghe.online/']
            ];

            sendTelegramWithButtons($chatId, $msg, $buttons);
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // Duyệt tích xanh trực tiếp
    elseif (strpos($action, 'approve_') === 0) {
        $reqId = intval(substr($action, 8));
        try {
            $stmt = $db->prepare("SELECT * FROM verification_requests WHERE id = ?");
            $stmt->execute([$reqId]);
            $req = $stmt->fetch();
            if ($req) {
                $key = 'LX-VERIFIED-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
                $now = date('d/m/Y H:i:s');
                $db->prepare("UPDATE verification_requests SET status = 'approved', verified_key = ?, approved_at = NOW(), admin_note = 'Duyệt qua Bot' WHERE id = ?")->execute([$key, $reqId]);
                $db->prepare("UPDATE users SET is_verified = 1, verified_key = ?, verified_at = ? WHERE username = ?")->execute([$key, $now, $req['username']]);
                
                $msg = "🎉 <b>ĐÃ DUYỆT CẤP TÍCH XANH THÀNH CÔNG!</b>\n";
                $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
                $msg .= "• Tài khoản: @{$req['username']} ({$req['display_name']})\n";
                $msg .= "• Mã chứng chỉ: <code>{$key}</code>\n";
                $msg .= "• Trạng thái: 🟢 ĐÃ XÁC MINH CHÍNH CHỦ\n";
                $msg .= "━━━━━━━━━━━━━━━━━━━━";
                sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
            }
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi duyệt: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // Từ chối tích xanh
    elseif (strpos($action, 'reject_') === 0) {
        $reqId = intval(substr($action, 7));
        try {
            $db->prepare("UPDATE verification_requests SET status = 'rejected', admin_note = 'Từ chối qua Bot' WHERE id = ?")->execute([$reqId]);
            sendTelegramWithButtons($chatId, "❌ Đã từ chối yêu cầu cấp Tích Xanh ID #{$reqId}.", getMainMenuButtons());
        } catch (Exception $e) {}
    }

    // 1.3. Bấm Quản Lý Users
    elseif ($action === 'btn_users') {
        try {
            $users = $db->query("SELECT id, username, display_name, is_verified, status FROM users ORDER BY id DESC LIMIT 8")->fetchAll();
            $msg = "👥 <b>DANH SÁCH NGƯỜI DÙNG HỆ THỐNG:</b>\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
            foreach ($users as $u) {
                $tick = $u['is_verified'] ? ' [✓ Tích Xanh]' : '';
                $st = $u['status'] === 'active' ? '🟢' : '🔴';
                $msg .= "• {$st} <b>@{$u['username']}</b> ({$u['display_name']}){$tick}\n";
            }
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
            sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // 1.4. Bấm Thống Kê Server
    elseif ($action === 'btn_stats') {
        try {
            $u = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
            $v = $db->query("SELECT COUNT(*) FROM users WHERE is_verified = 1")->fetchColumn();
            $p = $db->query("SELECT COUNT(*) FROM verification_requests WHERE status = 'pending'")->fetchColumn();
            $m = $db->query("SELECT COUNT(*) FROM messages")->fetchColumn();
            $c = $db->query("SELECT COUNT(*) FROM call_logs")->fetchColumn();
            $o = $db->query("SELECT COUNT(*) FROM password_resets")->fetchColumn();

            $msg = "📊 <b>THỐNG KÊ MÁY CHỦ LOCKX VAULT</b>\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
            $msg .= "👥 <b>Người dùng:</b> {$u} (✓ Đã cấp tích: {$v})\n";
            $msg .= "⏳ <b>Chờ duyệt Tích Xanh:</b> {$p} hồ sơ\n";
            $msg .= "🔑 <b>Yêu cầu OTP quên MK:</b> {$o} lượt\n";
            $msg .= "💬 <b>Tin nhắn chat E2EE:</b> {$m} tin\n";
            $msg .= "📞 <b>Nhật ký cuộc gọi:</b> {$c} cuộc\n";
            $msg .= "🖥️ <b>Máy chủ:</b> PHP " . phpversion() . " • MySQL OK 🟢\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━";
            sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // 1.5. Bấm Tin Nhắn
    elseif ($action === 'btn_messages') {
        try {
            $msgs = $db->query("SELECT sender_name, recipient_name, content, created_at FROM messages ORDER BY created_at DESC LIMIT 5")->fetchAll();
            $msg = "💬 <b>5 TIN NHẮN TRÒ CHUYỆN GẦN NHẤT:</b>\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
            if (empty($msgs)) {
                $msg .= "<i>Chưa có tin nhắn nào.</i>\n";
            } else {
                foreach ($msgs as $m) {
                    $t = date('H:i d/m', strtotime($m['created_at']));
                    $text = mb_strlen($m['content']) > 45 ? mb_substr($m['content'], 0, 45) . '...' : $m['content'];
                    $msg .= "• <b>{$m['sender_name']} ➔ {$m['recipient_name']}</b> ({$t}):\n  <i>\"{$text}\"</i>\n";
                }
            }
            $msg .= "━━━━━━━━━━━━━━━━━━━━";
            sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // 1.6. Bấm Cuộc Gọi
    elseif ($action === 'btn_calls') {
        try {
            $calls = $db->query("SELECT caller_name, receiver_name, call_type, duration_seconds, start_time FROM call_logs ORDER BY start_time DESC LIMIT 5")->fetchAll();
            $msg = "📞 <b>5 CUỘC GỌI GẦN NHẤT:</b>\n";
            $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
            if (empty($calls)) {
                $msg .= "<i>Chưa có cuộc gọi nào.</i>\n";
            } else {
                foreach ($calls as $c) {
                    $t = date('H:i:s d/m', strtotime($c['start_time']));
                    $msg .= "• <b>{$c['caller_name']} ➔ {$c['receiver_name']}</b>\n  Loại: {$c['call_type']} • {$c['duration_seconds']}s ({$t})\n";
                }
            }
            $msg .= "━━━━━━━━━━━━━━━━━━━━";
            sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
        } catch (Exception $e) {
            sendTelegramWithButtons($chatId, "❌ Lỗi: " . $e->getMessage(), getMainMenuButtons());
        }
    }

    // Menu Chính
    elseif ($action === 'btn_main') {
        $msg = "🛡️ <b>BẢNG ĐIỀU KHIỂN QUẢN TRỊ LOCKX VAULT</b>\n\n👇 Vui lòng chọn chức năng bên dưới:";
        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    }

    http_response_code(200);
    echo "OK";
    exit();
}

// ==============================================================================
// 2. XỬ LÝ LỆNH CHAT VĂN BẢN TỪ NGƯỜI DÙNG (/start, /otp,...)
// ==============================================================================
$message = $update['message'] ?? null;
if (!$message) { http_response_code(200); echo "OK"; exit(); }

$chatId = $message['chat']['id'] ?? '';
$text   = trim($message['text'] ?? '');
$from   = $message['from']['first_name'] ?? 'User';

// 2.1. Lệnh /start hoặc /menu
if (strpos($text, '/start') === 0 || strpos($text, '/menu') === 0) {
    // Kiểm tra nếu có tham số deep-linking: /start otp_username hoặc /start forgot_username
    $deepParam = '';
    if (preg_match('/\/start\s+(otp_|forgot_)(.+)/i', $text, $matches)) {
        $deepParam = trim($matches[2] ?? '');
    }

    if (!empty($deepParam)) {
        $targetUsername = strtolower(ltrim($deepParam, '@'));
        $otp = sprintf("%06d", mt_rand(100000, 999999));
        $expiresAt = date('Y-m-d H:i:s', time() + 120); // 2 phút theo chuẩn app

        // Vô hiệu hóa OTP cũ
        $db->prepare("UPDATE password_resets SET status = 'expired' WHERE LOWER(username) = ? AND status = 'pending'")->execute([$targetUsername]);
        // Lưu OTP mới
        $db->prepare("INSERT INTO password_resets (username, otp_code, status, ip_address, expires_at, created_at) VALUES (?, ?, 'pending', 'telegram_bot', ?, NOW())")->execute([$targetUsername, $otp, $expiresAt]);

        $msg = "🔑 <b>MÃ OTP XÁC THỰC CHO @{$targetUsername}</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "• Tài khoản: <b>@{$targetUsername}</b>\n";
        $msg .= "• Mã OTP 6 số: <code>{$otp}</code>\n";
        $msg .= "• Hiệu lực: <b>2 phút</b> (120 giây)\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "👉 <i>Chạm vào mã <code>{$otp}</code> để sao chép, sau đó quay lại ứng dụng LockX Vault nhập vào để đổi mật khẩu.</i>";

        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    } else {
        $headerBanner = "🛡️ <b>LOCKX VAULT SECURITY BOT</b>\n";
        $headerBanner .= "━━━━━━━━━━━━━━━━━━━━\n";
        $headerBanner .= "👋 <b>Xin chào {$from}!</b>\n";
        $headerBanner .= "🛡️ <b>Vai trò:</b> Quản Trị Viên Két Sắt\n";
        $headerBanner .= "🟢 <b>Trạng thái máy chủ:</b> Đang hoạt động\n";
        $headerBanner .= "🌐 <b>Website:</b> aecongnghe.online\n";
        $headerBanner .= "━━━━━━━━━━━━━━━━━━━━\n\n";
        $headerBanner .= "👇 <b>Hệ thống đang hoạt động • Chọn chức năng bên dưới:</b>";

        sendTelegramWithButtons($chatId, $headerBanner, getMainMenuButtons());
    }
}

// 2.2. Lệnh tạo mã OTP (/otp username)
elseif (strpos($text, '/otp') === 0) {
    $parts = explode(' ', $text);
    $targetUsername = trim($parts[1] ?? '');

    if (!empty($targetUsername)) {
        $cleanUsername = strtolower(ltrim($targetUsername, '@'));
        $otp = sprintf("%06d", mt_rand(100000, 999999));
        $expiresAt = date('Y-m-d H:i:s', time() + 120); // 2 phút

        $db->prepare("UPDATE password_resets SET status = 'expired' WHERE LOWER(username) = ? AND status = 'pending'")->execute([$cleanUsername]);
        $db->prepare("INSERT INTO password_resets (username, otp_code, status, ip_address, expires_at, created_at) VALUES (?, ?, 'pending', 'telegram_bot', ?, NOW())")->execute([$cleanUsername, $otp, $expiresAt]);

        $msg = "🔑 <b>MÃ OTP XÁC THỰC CHO @{$cleanUsername}</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "• Tài khoản: <b>@{$cleanUsername}</b>\n";
        $msg .= "• Mã OTP 6 số: <code>{$otp}</code>\n";
        $msg .= "• Hiệu lực: <b>2 phút</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "👉 <i>Chạm vào mã <code>{$otp}</code> để sao chép, sau đó quay lại ứng dụng LockX Vault nhập vào để đổi mật khẩu.</i>";
        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    } else {
        $msg = "⚠️ <b>VUI LÒNG NHẬP TÊN TÀI KHOẢN!</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "Để nhận mã OTP xác thực, hãy nhập đúng cú pháp:\n";
        $msg .= "👉 <code>/otp username</code>\n\n";
        $msg .= "<i>Ví dụ: <code>/otp trongtuangoat</code></i>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━";
        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    }
}

// 2.3. Lệnh /chatid
elseif (strpos($text, '/chatid') === 0) {
    $msg = "🆔 <b>Chat ID của bạn:</b> <code>{$chatId}</code>";
    sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
}

// Mặc định: Kiểm tra nếu người dùng gõ trực tiếp username (ví dụ: trongtuangoat hoặc @trongtuangoat)
else {
    $potentialUser = strtolower(ltrim(trim($text), '@'));
    $uFound = null;
    if (!empty($potentialUser) && strlen($potentialUser) <= 32 && !preg_match('/\s/', $potentialUser)) {
        try {
            $chk = $db->prepare("SELECT username, display_name FROM users WHERE LOWER(username) = ? LIMIT 1");
            $chk->execute([$potentialUser]);
            $uFound = $chk->fetch();
        } catch (Exception $e) {}
    }

    if ($uFound) {
        $cleanUser = $uFound['username'];
        $otp = sprintf("%06d", mt_rand(100000, 999999));
        $expiresAt = date('Y-m-d H:i:s', time() + 120); // 2 phút

        $db->prepare("UPDATE password_resets SET status = 'expired' WHERE LOWER(username) = ? AND status = 'pending'")->execute([$cleanUser]);
        $db->prepare("INSERT INTO password_resets (username, otp_code, status, ip_address, expires_at, created_at) VALUES (?, ?, 'pending', 'telegram_bot', ?, NOW())")->execute([$cleanUser, $otp, $expiresAt]);

        $msg = "🔑 <b>MÃ OTP XÁC THỰC CHO @{$cleanUser}</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "• Tài khoản: <b>@{$cleanUser}</b>\n";
        $msg .= "• Mã OTP 6 số: <code>{$otp}</code>\n";
        $msg .= "• Hiệu lực: <b>2 phút</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━━━\n";
        $msg .= "👉 <i>Chạm vào mã <code>{$otp}</code> để sao chép, sau đó quay lại ứng dụng LockX Vault nhập vào để đổi mật khẩu.</i>";
        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    } else {
        $msg = "🤖 Tôi đã nhận tin nhắn: <i>\"" . htmlspecialchars($text) . "\"</i>.\n\n👇 Vui lòng chọn chức năng bên dưới hoặc gõ <code>/otp username</code> để lấy mã OTP:";
        sendTelegramWithButtons($chatId, $msg, getMainMenuButtons());
    }
}

http_response_code(200);
echo "OK";
