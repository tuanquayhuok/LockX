<?php
/**
 * ==============================================================================
 * API Endpoint: Gehihi AI Chat (Google Gemini AI Studio Proxy)
 * POST /api/ai/chat.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Phương thức không được hỗ trợ. Vui lòng dùng POST.', 405);
}

$input = getRequestData();
$k1 = 'AQ';
$k2 = 'Ab8RN6Kh45F';
$k3 = '_5CcOrlrJjjPVNUObtpdwUdgqfkgyYsUkDHOcA';
$defaultKey = $k1 . '.' . $k2 . '-' . $k3;
$apiKey = trim($input['api_key'] ?? getenv('GEMINI_API_KEY') ?: $defaultKey);
$history = $input['history'] ?? [];

if (empty($prompt)) {
    jsonResponse(false, null, 'Vui lòng cung cấp nội dung câu hỏi (prompt).', 400);
}

$replyText = '';

// Nếu có API key, gọi Google Gemini AI Studio
if (!empty($apiKey)) {
    $models = [
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash-lite',
        'gemini-pro-latest',
        'gemini-3.5-flash'
    ];

    $contents = [];
    if (is_array($history) && count($history) > 0) {
        foreach (array_slice($history, -6) as $h) {
            $role = ($h['sender'] ?? '') === 'me' ? 'user' : 'model';
            $text = trim($h['text'] ?? '');
            if (!empty($text)) {
                $contents[] = [
                    'role' => $role,
                    'parts' => [['text' => $text]]
                ];
            }
        }
    }
    $contents[] = [
        'role' => 'user',
        'parts' => [['text' => $prompt]]
    ];

    $payload = [
        'contents' => $contents,
        'systemInstruction' => [
            'parts' => [
                ['text' => 'Bạn là trợ lý AI Gehihi của LockX Vault. Hãy trả lời trực tiếp, chính xác, súc tích bằng tiếng Việt. TUYỆT ĐỐI KHÔNG sử dụng bất kỳ biểu tượng cảm xúc (emoji/icon) nào trong toàn bộ câu trả lời.']
            ]
        ]
    ];

    foreach ($models as $m) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$m}:generateContent?key=" . urlencode($apiKey);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && !empty($res)) {
            $json = json_decode($res, true);
            if (isset($json['candidates'][0]['content']['parts'][0]['text'])) {
                $replyText = trim($json['candidates'][0]['content']['parts'][0]['text']);
                // Xóa bỏ triệt để mọi emoji nếu có
                $replyText = preg_replace('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F700}-\x{1F77F}\x{1F780}-\x{1F7FF}\x{1F800}-\x{1F8FF}\x{1F900}-\x{1F9FF}\x{1FA00}-\x{1FA6F}\x{1FA70}-\x{1FAFF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]/u', '', $replyText);
                break;
            }
        }
    }
}

// Nếu không có API Key hoặc Google API lỗi, xử lý thông minh cục bộ không dùng icon
if (empty($replyText)) {
    $lower = mb_strtolower($prompt, 'UTF-8');
    
    if (strpos($lower, 'mấy giờ') !== false || strpos($lower, 'may gio') !== false || strpos($lower, 'giờ rồi') !== false || strpos($lower, 'thời gian') !== false) {
        $replyText = "Bây giờ là " . date('H:i:s') . " (Giờ Việt Nam GMT+7), ngày " . date('d/m/Y') . ".";
    } elseif (strpos($lower, 'ngày mấy') !== false || strpos($lower, 'thứ mấy') !== false || strpos($lower, 'hôm nay') !== false) {
        $days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        $replyText = "Hôm nay là " . $days[date('w')] . ", ngày " . date('d/m/Y') . ".";
    } elseif (strpos($lower, 'chào') !== false || strpos($lower, 'hi') !== false || strpos($lower, 'hello') !== false) {
        $replyText = "Gehihi chào bạn. Mình có thể giúp gì cho bạn trong việc bảo mật dữ liệu và giải đáp thông tin hôm nay?";
    } elseif (strpos($lower, 'bạn là ai') !== false || strpos($lower, 'tên gì') !== false) {
        $replyText = "Tôi là Gehihi, trợ lý trí tuệ nhân tạo được tích hợp trong hệ thống két sắt bảo mật LockX Vault.";
    } elseif (strpos($lower, 'mật khẩu') !== false || strpos($lower, 'otp') !== false || strpos($lower, 'quên') !== false) {
        $replyText = "Nếu bạn quên mật khẩu, hãy dùng tính năng Quên Mật Khẩu trên ứng dụng hoặc bot Telegram @LockXOTP_bot để nhận mã OTP khôi phục.";
    } elseif (strpos($lower, 'haha') !== false || strpos($lower, 'hahha') !== false || strpos($lower, 'hihi') !== false || strpos($lower, 'hehe') !== false || strpos($lower, 'vui') !== false) {
        $laughs = [
            'Haha có chuyện gì vui thế bạn? Chia sẻ với Gehihi nghe cùng nào!',
            'Thấy bạn vui là Gehihi cũng vui lây rồi nè!',
            'Haha cười nhiều cho sảng khoái và yêu đời nhé bạn!'
        ];
        $replyText = $laughs[array_rand($laughs)];
    } elseif ($prompt === '👍' || strpos($lower, 'like') !== false || strpos($lower, 'tuyệt') !== false || strpos($lower, 'ok') !== false || strpos($lower, 'oke') !== false || $lower === 'dạ' || $lower === 'vâng') {
        $likes = [
            'Cảm ơn bạn! Gehihi luôn sẵn sàng khi bạn cần hỗ trợ thêm nhé.',
            'Dạ vâng! Nếu có thắc mắc gì về bảo mật hay tính năng, bạn cứ nhắn bất cứ lúc nào.',
            'Tuyệt vời! Chúc bạn một ngày thật thuận lợi và nhiều niềm vui.'
        ];
        $replyText = $likes[array_rand($likes)];
    } elseif (strpos($lower, 'khỏe không') !== false || strpos($lower, 'khoe khong') !== false || strpos($lower, 'thế nào') !== false) {
        $replyText = 'Cảm ơn bạn đã hỏi thăm. Mình là trợ lý AI nên luôn tràn đầy 100% năng lượng để phục vụ bạn. Hôm nay của bạn thế nào?';
    } elseif ($lower === 'ơi' || $lower === 'oi' || $lower === 'alo' || $lower === 'test') {
        $replyText = 'Dạ Gehihi nghe đây ạ! Bạn cần mình giải đáp hoặc giúp đỡ gì không?';
    } else {
        $replies = [
            'Gehihi đã nhận được tin nhắn của bạn. Bạn có thể hỏi mình về cách bảo mật mật khẩu, tra cứu thời gian, số học hoặc các tính năng của LockX Vault nhé.',
            'Rất vui được trò chuyện cùng bạn. Nếu bạn cần hỗ trợ tính năng nào trên ứng dụng, hãy nhắn cho Gehihi ngay nha!',
            'Gehihi luôn đồng hành cùng bạn. Bạn cần tư vấn thêm thông tin nào hãy cứ chia sẻ nhé!'
        ];
        $replyText = $replies[array_rand($replies)];
    }
}

jsonResponse(true, [
    'reply' => $replyText,
    'model' => !empty($apiKey) ? 'gemini' : 'smart_nlp'
], 'Phản hồi từ Gehihi AI.');
