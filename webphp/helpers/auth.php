<?php
/**
 * ==============================================================================
 * LockX Vault - Helper Xác Thực Quyền Truy Cập API (Auth & Security Helper)
 * ==============================================================================
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/response.php';

class AuthHelper {

    /**
     * Xác thực API Secret Key gửi kèm từ Header hoặc Query Param
     * (Cho phép truy cập nếu key trùng khớp hoặc nếu hệ thống đang mở không bắt buộc key)
     */
    public static function requireApiKey($allowEmpty = false) {
        $configuredKey = API_SECRET_KEY;

        if ($allowEmpty && empty($configuredKey)) {
            return true;
        }

        $receivedKey = self::getProvidedApiKey();

        if (empty($receivedKey) || $receivedKey !== $configuredKey) {
            jsonResponse(false, null, 'Không có quyền truy cập: API Key không hợp lệ hoặc bị thiếu trong Request Header (X-API-KEY / Authorization Bearer).', 401);
        }

        return true;
    }

    /**
     * Trích xuất API Key từ các header chuẩn
     */
    private static function getProvidedApiKey() {
        // 1. Kiểm tra Header X-API-KEY
        if (!empty($_SERVER['HTTP_X_API_KEY'])) {
            return trim($_SERVER['HTTP_X_API_KEY']);
        }

        // 2. Kiểm tra Header Authorization: Bearer <key>
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
                return trim($matches[1]);
            }
        }

        // 3. Kiểm tra Query String: ?api_key=...
        if (!empty($_GET['api_key'])) {
            return trim($_GET['api_key']);
        }

        return null;
    }
}
