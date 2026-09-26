<?php
/**
 * ==============================================================================
 * LockX Vault - Kết Nối Cơ Sở Dữ Liệu PDO Chuẩn An Toàn (Database Connection)
 * ==============================================================================
 */

require_once __DIR__ . '/config.php';

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
            ];

            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Khi không kết nối được database, trả về thông báo lỗi dạng JSON rõ ràng
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Không thể kết nối cơ sở dữ liệu MySQL: ' . (APP_DEBUG ? $e->getMessage() : 'Vui lòng kiểm tra cấu hình trong config/config.php'),
                'code'    => 500,
                'timestamp' => date('Y-m-d H:i:s')
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            exit();
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->pdo;
    }

    // Helper: Lấy cấu hình hệ thống từ bảng system_settings
    public function getSetting($key, $default = '') {
        try {
            $stmt = $this->pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            return $row ? $row['setting_value'] : $default;
        } catch (Exception $e) {
            return $default;
        }
    }

    // Helper: Cập nhật cấu hình hệ thống
    public function setSetting($key, $value, $description = '') {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO system_settings (setting_key, setting_value, description) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
            ");
            return $stmt->execute([$key, $value, $description]);
        } catch (Exception $e) {
            return false;
        }
    }
}

// Function helper nhanh để lấy PDO connection
function getDB() {
    return Database::getInstance()->getConnection();
}
