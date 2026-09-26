<?php
/**
 * ==============================================================================
 * LockX Vault - Helper Phản Hồi JSON & Xử Lý Dữ Liệu Đầu Vào (Response Helper)
 * ==============================================================================
 */

require_once __DIR__ . '/../config/config.php';

// Tự động thiết lập CORS cho mọi API endpoint
setCorsHeaders();

/**
 * Trả về phản hồi JSON chuẩn RESTful API
 *
 * @param bool $success Trạng thái thành công hay thất bại
 * @param mixed $data Dữ liệu trả về (mảng, đối tượng, danh sách)
 * @param string $message Thông điệp ngắn gọn
 * @param int $httpCode HTTP status code (200, 201, 400, 401, 403, 404, 500)
 */
function jsonResponse($success, $data = null, $message = '', $httpCode = 200) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($httpCode);

    $response = [
        'success'   => (bool)$success,
        'message'   => $message,
        'code'      => $httpCode,
        'timestamp' => date('Y-m-d H:i:s'),
        'data'      => $data
    ];

    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Lấy dữ liệu gửi lên từ Request (hỗ trợ cả JSON raw body và $_POST thông thường)
 *
 * @return array
 */
function getRequestData() {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode($rawInput, true);

    if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
        return array_merge($_POST, $jsonData);
    }

    return !empty($_POST) ? $_POST : [];
}

/**
 * Lấy địa chỉ IP thực của Client
 *
 * @return string
 */
function getClientIp() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
