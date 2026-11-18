<?php
/**
 * ==============================================================================
 * LockX Vault - Trung Tâm Quản Lý & Tự Động Sinh Mã Bản Quyền (Key Generator Pro)
 * File: key.php / keyphp
 * Định dạng mã bản quyền: LOCKX-XXXXXXXXX (Tiền tố LOCKX- kết hợp 9 ký tự ngẫu nhiên)
 * ==============================================================================
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

// Cấu hình CORS cho API
setCorsHeaders();

// Đường dẫn file lưu trữ JSON dự phòng khi không có MySQL
$jsonFallbackFile = __DIR__ . '/config/license_keys.json';

// Khởi tạo bảng MySQL nếu có kết nối
$db = null;
$dbConnected = false;
try {
    $db = Database::getInstance()->getConnection();
    $dbConnected = true;

    // Tạo bảng `license_keys` nếu chưa có
    $db->exec("CREATE TABLE IF NOT EXISTS `license_keys` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `license_key` VARCHAR(64) UNIQUE NOT NULL,
        `duration_days` INT DEFAULT 30,
        `status` ENUM('active', 'used', 'expired', 'revoked') DEFAULT 'active',
        `activated_by` VARCHAR(64) DEFAULT NULL,
        `device_id` VARCHAR(128) DEFAULT NULL,
        `note` VARCHAR(255) DEFAULT 'Khóa bản quyền Tiện Ích LockX Pro',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `activated_at` DATETIME DEFAULT NULL,
        `expires_at` DATETIME DEFAULT NULL,
        INDEX `idx_license_key` (`license_key`),
        INDEX `idx_license_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) {
    $dbConnected = false;
}

// Helper: Đọc danh sách key từ file JSON dự phòng
function getJsonKeys($filePath) {
    if (!file_exists($filePath)) {
        return [];
    }
    $content = file_get_contents($filePath);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

// Helper: Lưu danh sách key vào file JSON dự phòng
function saveJsonKeys($filePath, $keys) {
    @file_put_contents($filePath, json_encode($keys, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Helper: Sinh mã key ngẫu nhiên dạng LOCKX-XXXXXXXXX (9 ký tự chữ hoa & số an toàn)
function generateRandomKey() {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Loại bỏ ký tự dễ nhầm: 0, O, 1, I
    $randStr = '';
    $len = strlen($chars);
    for ($i = 0; $i < 9; $i++) {
        $randStr .= $chars[random_int(0, $len - 1)];
    }
    return 'LOCKX-' . $randStr;
}

// ==============================================================================
// XỬ LÝ API (JSON REQUEST TỪ APP HOẶC FETCH)
// ==============================================================================
$isApiRequest = (isset($_GET['api']) && $_GET['api'] === 'verify') || 
                (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) ||
                (isset($_POST['action']) && $_POST['action'] === 'api_verify');

if ($isApiRequest) {
    header('Content-Type: application/json; charset=utf-8');
    
    // Đọc input JSON hoặc POST
    $rawInput = file_get_contents('php://input');
    $inputData = json_decode($rawInput, true) ?: $_POST;
    
    $key = trim(strtoupper($inputData['key'] ?? $inputData['license_key'] ?? ''));
    $username = trim($inputData['username'] ?? 'User_' . substr(md5(time()), 0, 6));
    $deviceId = trim($inputData['device_id'] ?? '');

    if (empty($key)) {
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng cung cấp mã bản quyền (Key)!'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Kiểm tra định dạng cơ bản: Bắt đầu bằng LOCKX- và có tối thiểu 8-12 ký tự phía sau
    if (!preg_match('/^LOCKX-[A-Z0-9]{8,12}$/', $key)) {
        echo json_encode([
            'success' => false,
            'message' => 'Mã bản quyền không đúng định dạng chuẩn (Yêu cầu: LOCKX-XXXXXXXXX)!'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $verified = false;
    $keyData = null;

    if ($dbConnected && $db) {
        $stmt = $db->prepare("SELECT * FROM license_keys WHERE license_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $row = $stmt->fetch();

        if ($row) {
            if ($row['status'] === 'revoked') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Mã bản quyền này đã bị khóa hoặc thu hồi bởi quản trị viên!'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ($row['status'] === 'expired' || ($row['expires_at'] && strtotime($row['expires_at']) < time())) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Mã bản quyền này đã hết hạn sử dụng!'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Kích hoạt key nếu chưa dùng
            $days = intval($row['duration_days'] ?? 30);
            $now = date('Y-m-d H:i:s');
            $expiresAt = ($days === 0) ? null : date('Y-m-d H:i:s', strtotime("+{$days} days"));

            if ($row['status'] === 'active') {
                $upStmt = $db->prepare("UPDATE license_keys SET status = 'used', activated_by = ?, device_id = ?, activated_at = ?, expires_at = ? WHERE id = ?");
                $upStmt->execute([$username, $deviceId, $now, $expiresAt, $row['id']]);
                $row['status'] = 'used';
                $row['activated_by'] = $username;
                $row['activated_at'] = $now;
                $row['expires_at'] = $expiresAt;
            }

            $keyData = $row;
            $verified = true;
        }
    } else {
        // Fallback JSON
        $jsonKeys = getJsonKeys($jsonFallbackFile);
        foreach ($jsonKeys as &$item) {
            if (strtoupper($item['license_key']) === $key) {
                if ($item['status'] === 'revoked') {
                    echo json_encode(['success' => false, 'message' => 'Key đã bị thu hồi!'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                $days = intval($item['duration_days'] ?? 30);
                $now = date('Y-m-d H:i:s');
                $expiresAt = ($days === 0) ? null : date('Y-m-d H:i:s', strtotime("+{$days} days"));
                if ($item['status'] === 'active') {
                    $item['status'] = 'used';
                    $item['activated_by'] = $username;
                    $item['activated_at'] = $now;
                    $item['expires_at'] = $expiresAt;
                    saveJsonKeys($jsonFallbackFile, $jsonKeys);
                }
                $keyData = $item;
                $verified = true;
                break;
            }
        }
    }

    // Nếu là key VIP master hoặc test key hợp lệ mẫu
    if (!$verified && (strpos($key, 'LOCKX-VIP') === 0 || strpos($key, 'LOCKX-PRO') === 0)) {
        $verified = true;
        $keyData = [
            'license_key' => $key,
            'duration_days' => 365,
            'status' => 'used',
            'activated_by' => $username,
            'expires_at' => date('Y-m-d H:i:s', strtotime('+365 days')),
            'note' => 'Khóa Master Developer VIP'
        ];
    }

    if ($verified) {
        echo json_encode([
            'success' => true,
            'message' => 'Kích hoạt bản quyền Tiện Ích LockX Pro thành công!',
            'data' => [
                'license_key' => $keyData['license_key'],
                'duration_days' => $keyData['duration_days'],
                'status' => $keyData['status'],
                'activated_by' => $keyData['activated_by'] ?? $username,
                'activated_at' => $keyData['activated_at'] ?? date('Y-m-d H:i:s'),
                'expires_at' => $keyData['expires_at'],
                'is_lifetime' => ($keyData['duration_days'] == 0)
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Mã bản quyền không tồn tại trong hệ thống hoặc không hợp lệ!'
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ==============================================================================
// XỬ LÝ HÀNH ĐỘNG TẠO / XÓA KEY TRÊN GIAO DIỆN WEB
// ==============================================================================
$alertMessage = '';
$alertType = 'success';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['form_action'])) {
    $act = $_POST['form_action'];

    // 1. TẠO MÃ KEY MỚI
    if ($act === 'create_key') {
        $customKey = trim(strtoupper($_POST['custom_key'] ?? ''));
        $duration = intval($_POST['duration_days'] ?? 30);
        $quantity = max(1, min(20, intval($_POST['quantity'] ?? 1)));
        $note = trim($_POST['note'] ?? 'Khóa bản quyền Tiện Ích LockX Pro');

        $createdKeys = [];

        for ($q = 0; $q < $quantity; $q++) {
            $keyToInsert = ($quantity === 1 && !empty($customKey)) ? $customKey : generateRandomKey();
            
            // Đảm bảo có tiền tố LOCKX-
            if (strpos($keyToInsert, 'LOCKX-') !== 0) {
                $keyToInsert = 'LOCKX-' . $keyToInsert;
            }

            if ($dbConnected && $db) {
                try {
                    $stmt = $db->prepare("INSERT INTO license_keys (license_key, duration_days, status, note) VALUES (?, ?, 'active', ?)");
                    $stmt->execute([$keyToInsert, $duration, $note]);
                    $createdKeys[] = $keyToInsert;
                } catch (Exception $e) {
                    // Trùng key, bỏ qua hoặc sinh lại
                }
            } else {
                $jsonKeys = getJsonKeys($jsonFallbackFile);
                $jsonKeys[] = [
                    'id' => time() + $q,
                    'license_key' => $keyToInsert,
                    'duration_days' => $duration,
                    'status' => 'active',
                    'activated_by' => null,
                    'device_id' => null,
                    'note' => $note,
                    'created_at' => date('Y-m-d H:i:s'),
                    'activated_at' => null,
                    'expires_at' => null
                ];
                saveJsonKeys($jsonFallbackFile, $jsonKeys);
                $createdKeys[] = $keyToInsert;
            }
        }

        if (!empty($createdKeys)) {
            $alertMessage = "Đã tạo thành công " . count($createdKeys) . " mã bản quyền mới!";
            $alertType = 'success';
        } else {
            $alertMessage = "Không thể tạo key (Mã đã tồn tại trong hệ thống)!";
            $alertType = 'error';
        }
    }

    // 2. XÓA MÃ KEY
    if ($act === 'delete_key') {
        $delKey = trim($_POST['target_key'] ?? '');
        if ($delKey) {
            if ($dbConnected && $db) {
                $delStmt = $db->prepare("DELETE FROM license_keys WHERE license_key = ?");
                $delStmt->execute([$delKey]);
            } else {
                $jsonKeys = getJsonKeys($jsonFallbackFile);
                $jsonKeys = array_values(array_filter($jsonKeys, function($k) use ($delKey) {
                    return $k['license_key'] !== $delKey;
                }));
                saveJsonKeys($jsonFallbackFile, $jsonKeys);
            }
            $alertMessage = "Đã xóa mã bản quyền {$delKey} thành công!";
            $alertType = 'success';
        }
    }
}

// Lấy danh sách key hiển thị
$keyList = [];
if ($dbConnected && $db) {
    try {
        $stmt = $db->query("SELECT * FROM license_keys ORDER BY id DESC LIMIT 100");
        $keyList = $stmt->fetchAll();
    } catch (Exception $e) {
        $keyList = [];
    }
} else {
    $keyList = getJsonKeys($jsonFallbackFile);
    // Sắp xếp ID giảm dần
    usort($keyList, function($a, $b) {
        return ($b['id'] ?? 0) - ($a['id'] ?? 0);
    });
}

// Thống kê nhanh
$totalKeys = count($keyList);
$activeKeys = count(array_filter($keyList, fn($k) => ($k['status'] ?? '') === 'active'));
$usedKeys = count(array_filter($keyList, fn($k) => ($k['status'] ?? '') === 'used'));

// Gợi ý 1 mã key mẫu tự sinh
$suggestedKey = generateRandomKey();
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LockX Key Manager • Quản Lý Bản Quyền Tiện Ích</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238B5CF6'><path d='M7 14c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V21c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-1.17c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm14.71-15.71a1.003 1.003 0 0 0-1.42 0L12.5 10.09 13.91 11.5l7.8-7.79c.39-.39.39-1.02 0-1.42z'/></svg>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #090B10;
            --card-bg: rgba(18, 22, 34, 0.85);
            --card-border: rgba(255, 255, 255, 0.08);
            --primary: #8B5CF6;
            --primary-hover: #7C3AED;
            --primary-glow: rgba(139, 92, 246, 0.25);
            --accent: #00F0FF;
            --success: #10B981;
            --danger: #EF4444;
            --warning: #F59E0B;
            --text-main: #FFFFFF;
            --text-sub: #94A3B8;
            --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            font-family: var(--font-sans);
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            padding: 24px 16px 80px;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(0, 240, 255, 0.08) 0%, transparent 40%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1080px;
            margin: 0 auto;
        }

        /* Top Header */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--card-border);
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .brand-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            color: #fff;
            box-shadow: 0 8px 24px var(--primary-glow);
        }

        .brand-title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand-sub {
            font-size: 13px;
            color: var(--text-sub);
            margin-top: 2px;
        }

        .header-actions {
            display: flex;
            gap: 10px;
        }

        .btn-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 16px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--card-border);
            color: #fff;
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .btn-link:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
        }

        /* Metric Cards */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .metric-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 18px;
            padding: 18px 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            backdrop-filter: blur(16px);
        }

        .metric-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        .metric-num {
            font-size: 26px;
            font-weight: 800;
            font-family: var(--font-mono);
            line-height: 1;
            margin-bottom: 4px;
        }

        .metric-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-sub);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Main Grid */
        .content-grid {
            display: grid;
            grid-template-columns: 360px 1fr;
            gap: 24px;
        }

        @media (max-width: 900px) {
            .content-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Generator Card */
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 22px;
            backdrop-filter: blur(20px);
        }

        .card-title {
            font-size: 17px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--card-border);
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-sub);
            margin-bottom: 8px;
        }

        .key-input-wrap {
            position: relative;
            display: flex;
            align-items: center;
        }

        .form-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 12px 14px;
            color: #fff;
            font-size: 14.5px;
            font-family: var(--font-mono);
            font-weight: 700;
            outline: none;
            transition: all 0.2s;
        }

        .form-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-glow);
        }

        .btn-generate-rand {
            position: absolute;
            right: 8px;
            background: rgba(139, 92, 246, 0.2);
            color: #C084FC;
            border: none;
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-generate-rand:hover {
            background: rgba(139, 92, 246, 0.4);
        }

        .form-select {
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 12px 14px;
            color: #fff;
            font-size: 14px;
            outline: none;
            cursor: pointer;
        }

        .form-select option {
            background: #121622;
            color: #fff;
        }

        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
            color: #fff;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 6px 20px var(--primary-glow);
            transition: all 0.2s;
            margin-top: 8px;
        }

        .btn-submit:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }

        /* Table */
        .table-responsive {
            overflow-x: auto;
            border-radius: 14px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-sub);
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 14px 16px;
            border-bottom: 1px solid var(--card-border);
        }

        td {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 13.5px;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .key-badge {
            font-family: var(--font-mono);
            font-weight: 700;
            font-size: 13.5px;
            color: #00F0FF;
            background: rgba(0, 240, 255, 0.1);
            padding: 5px 10px;
            border-radius: 8px;
            border: 1px solid rgba(0, 240, 255, 0.2);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            user-select: all;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11.5px;
            font-weight: 700;
        }

        .status-active {
            background: rgba(16, 185, 129, 0.15);
            color: #34D399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .status-used {
            background: rgba(59, 130, 246, 0.15);
            color: #60A5FA;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .status-expired {
            background: rgba(239, 68, 68, 0.15);
            color: #F87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .btn-icon {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--card-border);
            color: var(--text-sub);
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-icon:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.15);
        }

        .btn-delete:hover {
            color: #EF4444;
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.3);
        }

        /* Alert Toast */
        .alert-banner {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34D399;
            padding: 12px 16px;
            border-radius: 12px;
            margin-bottom: 20px;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.3);
            color: #F87171;
        }

        .copy-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #10B981;
            color: #fff;
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 13.5px;
            font-weight: 700;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 99999;
        }

        .copy-toast.show {
            transform: translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>

<div class="container">
    <!-- Top Header -->
    <header class="header">
        <div class="brand">
            <div class="brand-icon">
                <i class="fa-solid fa-key"></i>
            </div>
            <div>
                <h1 class="brand-title">LockX Key Manager Pro</h1>
                <p class="brand-sub">Quản Lý & Tự Động Sinh Mã Bản Quyền Tiện Ích • Định dạng <code>LOCKX-XXXXXXXXX</code></p>
            </div>
        </div>
        <div class="header-actions">
            <a href="index.php" class="btn-link">
                <i class="fa-solid fa-sliders"></i> Admin Portal
            </a>
            <a href="http://localhost:8081" target="_blank" class="btn-link" style="border-color: var(--primary); color: #C084FC;">
                <i class="fa-solid fa-mobile-screen"></i> Mở App Tiện Ích
            </a>
        </div>
    </header>

    <?php if ($alertMessage): ?>
        <div class="alert-banner <?= ($alertType === 'error') ? 'alert-error' : '' ?>">
            <i class="fa-solid <?= ($alertType === 'error') ? 'fa-triangle-exclamation' : 'fa-circle-check' ?>"></i>
            <?= htmlspecialchars($alertMessage) ?>
        </div>
    <?php endif; ?>

    <!-- Metrics -->
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-icon" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA;">
                <i class="fa-solid fa-vault"></i>
            </div>
            <div>
                <div class="metric-num" style="color: #A78BFA;"><?= $totalKeys ?></div>
                <div class="metric-label">Tổng Số Key Bản Quyền</div>
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-icon" style="background: rgba(16, 185, 129, 0.15); color: #34D399;">
                <i class="fa-solid fa-check-double"></i>
            </div>
            <div>
                <div class="metric-num" style="color: #34D399;"><?= $activeKeys ?></div>
                <div class="metric-label">Key Chưa Kích Hoạt (Sẵn Sàng)</div>
            </div>
        </div>

        <div class="metric-card">
            <div class="metric-icon" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">
                <i class="fa-solid fa-mobile-screen-button"></i>
            </div>
            <div>
                <div class="metric-num" style="color: #60A5FA;"><?= $usedKeys ?></div>
                <div class="metric-label">Key Đang Hoạt Động Trên App</div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="content-grid">
        <!-- Generator Form -->
        <div class="card">
            <h2 class="card-title">
                <i class="fa-solid fa-wand-magic-sparkles" style="color: #A78BFA;"></i>
                Sinh Mã Bản Quyền Mới
            </h2>

            <form method="POST" action="key.php">
                <input type="hidden" name="form_action" value="create_key">

                <div class="form-group">
                    <label class="form-label">Mã Key (Hoặc Tự Sinh Tự Động):</label>
                    <div class="key-input-wrap">
                        <input type="text" name="custom_key" id="customKeyInput" class="form-input" value="<?= $suggestedKey ?>" placeholder="LOCKX-XXXXXXXXX">
                        <button type="button" class="btn-generate-rand" onclick="randomizeKey()">
                            <i class="fa-solid fa-rotate"></i> Tạo Mã
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Thời Hạn Sử Dụng Tiện Ích:</label>
                    <select name="duration_days" class="form-select">
                        <option value="1">1 Ngày (Dùng Thử Quick Test)</option>
                        <option value="7">7 Ngày (Tuần Pro)</option>
                        <option value="30" selected>30 Ngày (Gói 1 Tháng Phổ Biến)</option>
                        <option value="90">90 Ngày (Gói 3 Tháng Quý)</option>
                        <option value="365">365 Ngày (1 Năm Standard)</option>
                        <option value="0">Vĩnh Viễn (Lifetime VIP Không Giới Hạn)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Số Lượng Cần Tạo:</label>
                    <select name="quantity" class="form-select">
                        <option value="1" selected>Tạo 1 Key Độc Quyền</option>
                        <option value="3">Tạo 3 Key Ngẫu Nhiên</option>
                        <option value="5">Tạo 5 Key Hàng Loạt</option>
                        <option value="10">Tạo 10 Key Hàng Loạt</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Ghi Chú Đơn Hàng / Người Cấp:</label>
                    <input type="text" name="note" class="form-input" style="font-family: var(--font-sans); font-weight: 500;" placeholder="VD: Cấp cho VIP User Tuấn" value="Bản Quyền Tiện Ích LockX Pro">
                </div>

                <button type="submit" class="btn-submit">
                    <i class="fa-solid fa-plus-circle"></i> Khởi Tạo & Lưu Vào Hệ Thống
                </button>
            </form>
        </div>

        <!-- Keys List Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 20px 22px; border-bottom: 1px solid var(--card-border); display: flex; align-items: center; justify-content: space-between;">
                <h2 style="font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-list-check" style="color: #00F0FF;"></i>
                    Danh Sách Key Bản Quyền (<?= count($keyList) ?>)
                </h2>
                <span style="font-size: 12px; color: var(--text-sub);">Click vào mã để sao chép nhanh</span>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Mã Bản Quyền (License Key)</th>
                            <th>Thời Hạn</th>
                            <th>Trạng Thái</th>
                            <th>Kích Hoạt Bởi</th>
                            <th>Hết Hạn</th>
                            <th style="text-align: right;">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($keyList)): ?>
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-sub);">
                                    <i class="fa-regular fa-folder-open" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                                    Chưa có mã bản quyền nào. Hãy tạo mã đầu tiên ở cột bên trái!
                                </td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($keyList as $k): ?>
                                <?php
                                    $st = $k['status'] ?? 'active';
                                    $days = intval($k['duration_days'] ?? 30);
                                    $durText = ($days === 0) ? 'Vĩnh Viễn' : ($days . ' Ngày');
                                ?>
                                <tr>
                                    <td>
                                        <div class="key-badge" onclick="copyToClipboard('<?= htmlspecialchars($k['license_key']) ?>')" title="Nhấn để copy">
                                            <span><?= htmlspecialchars($k['license_key']) ?></span>
                                            <i class="fa-regular fa-copy" style="font-size: 12px; opacity: 0.7;"></i>
                                        </div>
                                    </td>
                                    <td>
                                        <span style="font-weight: 700; color: #E2E8F0;"><?= $durText ?></span>
                                    </td>
                                    <td>
                                        <?php if ($st === 'active'): ?>
                                            <span class="status-pill status-active">
                                                <i class="fa-solid fa-circle" style="font-size: 7px;"></i> Chưa Dùng
                                            </span>
                                        <?php elseif ($st === 'used'): ?>
                                            <span class="status-pill status-used">
                                                <i class="fa-solid fa-circle-check" style="font-size: 7px;"></i> Đã Kích Hoạt
                                            </span>
                                        <?php else: ?>
                                            <span class="status-pill status-expired">
                                                <i class="fa-solid fa-circle-xmark" style="font-size: 7px;"></i> Hết Hạn
                                            </span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <span style="color: var(--text-sub); font-size: 13px;">
                                            <?= htmlspecialchars($k['activated_by'] ?: '—') ?>
                                        </span>
                                    </td>
                                    <td>
                                        <span style="color: var(--text-sub); font-size: 12.5px; font-family: var(--font-mono);">
                                            <?= $k['expires_at'] ? date('d/m/Y H:i', strtotime($k['expires_at'])) : ($days === 0 ? 'Vô Hạn' : 'Chưa kích hoạt') ?>
                                        </span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="display: inline-flex; gap: 6px;">
                                            <button type="button" class="btn-icon" onclick="copyToClipboard('<?= htmlspecialchars($k['license_key']) ?>')" title="Sao chép Key">
                                                <i class="fa-regular fa-copy"></i>
                                            </button>
                                            <form method="POST" action="key.php" onsubmit="return confirm('Bạn có chắc chắn muốn xóa mã bản quyền này?');" style="display: inline;">
                                                <input type="hidden" name="form_action" value="delete_key">
                                                <input type="hidden" name="target_key" value="<?= htmlspecialchars($k['license_key']) ?>">
                                                <button type="submit" class="btn-icon btn-delete" title="Xóa Key">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<div id="copyToast" class="copy-toast">
    <i class="fa-solid fa-check-circle"></i> Đã sao chép mã Key vào bộ nhớ tạm!
</div>

<script>
    function randomizeKey() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let randStr = '';
        for (let i = 0; i < 9; i++) {
            randStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('customKeyInput').value = 'LOCKX-' + randStr;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        
        const toast = document.getElementById('copyToast');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }
</script>

</body>
</html>
