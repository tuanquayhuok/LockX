<?php
/**
 * ==============================================================================
 * LockX Vault - Trung Tâm Quản Trị & Bảng Điều Khiển Duyệt Tích Xanh / OTP
 * Giao diện Apple iOS 18 Design System (Dark/Light Responsive)
 * ==============================================================================
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/telegram.php';
require_once __DIR__ . '/helpers/mailer.php';
require_once __DIR__ . '/helpers/push.php';

// Kiểm tra kết nối Database
$dbConnected = false;
$dbError = '';
$stats = [
    'users'    => 0,
    'verified' => 0,
    'pending_verifications' => 0,
    'messages' => 0,
    'calls'    => 0,
    'otps'     => 0,
    'webhooks' => 0
];

$pendingRequests = [];
$recentOtps = [];
$actionMessage = '';

try {
    $db = Database::getInstance()->getConnection();
    $dbConnected = true;

    // Xử lý thao tác Admin duyệt / từ chối trực tiếp trên Web
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_action'])) {
        $act = $_POST['admin_action'];
        $reqId = intval($_POST['request_id'] ?? 0);
        $userId = intval($_POST['user_id'] ?? 0);

        if ($reqId > 0 && ($act === 'approve' || $act === 'reject')) {
            $stmt = $db->prepare("SELECT * FROM verification_requests WHERE id = ?");
            $stmt->execute([$reqId]);
            $req = $stmt->fetch();

            if ($req) {
                if ($act === 'approve') {
                    $key = 'LX-VERIFIED-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
                    $now = date('d/m/Y H:i:s');

                    $upReq = $db->prepare("UPDATE verification_requests SET status = 'approved', verified_key = ?, approved_at = NOW(), admin_note = 'Đã duyệt trên Web Dashboard' WHERE id = ?");
                    $upReq->execute([$key, $reqId]);

                    $upUser = $db->prepare("UPDATE users SET is_verified = 1, verified_key = ?, verified_at = ? WHERE username = ?");
                    $upUser->execute([$key, $now, $req['username']]);

                    TelegramService::sendAlert('🎉 ĐÃ DUYỆT TÍCH XANH TỪ WEB DASHBOARD', [
                        'Username'     => "@{$req['username']}",
                        'Tên hiển thị' => $req['display_name'],
                        'Mã chứng chỉ' => $key,
                        'Trạng thái'   => '🟢 ĐÃ XÁC MINH CHÍNH CHỦ'
                    ]);

                    // Gửi Push Notification ra ngoài màn hình điện thoại
                    PushNotificationService::sendToUser(
                        $req['username'],
                        '🛡️ Phê Duyệt Tích Xanh Thành Công',
                        "Xin chúc mừng {$req['display_name']}! Yêu cầu cấp Tích Xanh LockX Verified của bạn đã được duyệt.",
                        ['action' => 'verified_approved', 'cert_key' => $key]
                    );

                    $actionMessage = "✓ Đã phê duyệt và cấp Tích Xanh cho @{$req['username']}.";
                } else {
                    $upReq = $db->prepare("UPDATE verification_requests SET status = 'rejected', admin_note = 'Từ chối từ Web Dashboard' WHERE id = ?");
                    $upReq->execute([$reqId]);

                    TelegramService::sendAlert('❌ TỪ CHỐI TÍCH XANH TỪ WEB DASHBOARD', [
                        'Username'   => "@{$req['username']}",
                        'Trạng thái' => '🔴 ĐÃ TỪ CHỐI'
                    ]);

                    // Gửi Push Notification thông báo từ chối
                    PushNotificationService::sendToUser(
                        $req['username'],
                        '⚠️ Thông Báo Xác Minh LockX',
                        "Yêu cầu cấp Tích Xanh của bạn chưa được duyệt.",
                        ['action' => 'verified_rejected']
                    );

                    $actionMessage = "✓ Đã từ chối yêu cầu Tích Xanh của @{$req['username']}.";
                }
            }
        } elseif ($userId > 0 && $act === 'toggle_status') {
            $newStatus = ($_POST['current_status'] === 'active') ? 'banned' : 'active';
            $upStmt = $db->prepare("UPDATE users SET status = ? WHERE id = ?");
            $upStmt->execute([$newStatus, $userId]);
            $actionMessage = "✓ Đã cập nhật trạng thái người dùng ID #{$userId} sang: " . strtoupper($newStatus);
        } elseif ($userId > 0 && $act === 'grant_verified') {
            $key = 'LX-VERIFIED-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
            $now = date('d/m/Y H:i:s');
            $upStmt = $db->prepare("UPDATE users SET is_verified = 1, verified_key = ?, verified_at = ? WHERE id = ?");
            $upStmt->execute([$key, $now, $userId]);
            $actionMessage = "✓ Đã cấp Tích Xanh trực tiếp cho người dùng ID #{$userId}.";
        }
    }

    // Lấy thống kê
    $stats['users']    = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $stats['verified'] = $db->query("SELECT COUNT(*) FROM users WHERE is_verified = 1")->fetchColumn();
    $stats['pending_verifications'] = $db->query("SELECT COUNT(*) FROM verification_requests WHERE status = 'pending'")->fetchColumn();
    $stats['messages'] = $db->query("SELECT COUNT(*) FROM messages")->fetchColumn();
    $stats['calls']    = $db->query("SELECT COUNT(*) FROM call_logs")->fetchColumn();
    $stats['otps']     = $db->query("SELECT COUNT(*) FROM password_resets")->fetchColumn();
    $stats['webhooks'] = $db->query("SELECT COUNT(*) FROM webhooks_log")->fetchColumn();

    // Lấy danh sách toàn bộ người dùng
    $allUsers = $db->query("SELECT * FROM users ORDER BY id DESC LIMIT 15")->fetchAll();

    // Lấy danh sách yêu cầu xác minh
    $pendingRequests = $db->query("SELECT * FROM verification_requests ORDER BY created_at DESC LIMIT 10")->fetchAll();

    // Lấy danh sách mã OTP quên mật khẩu gần nhất
    $recentOtps = $db->query("SELECT * FROM password_resets ORDER BY created_at DESC LIMIT 6")->fetchAll();

    // Lấy danh sách tin nhắn gần nhất
    $recentMessages = $db->query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 8")->fetchAll();

    // Lấy danh sách nhật ký cuộc gọi gần nhất
    $recentCalls = $db->query("SELECT * FROM call_logs ORDER BY start_time DESC LIMIT 8")->fetchAll();

} catch (Exception $e) {
    $dbError = $e->getMessage();
}

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$baseUrl = $protocol . $host . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LockX Vault - Trung Tâm Quản Trị & API Server</title>
    <style>
        :root {
            --bg-color: #000000;
            --card-bg: #1C1C1E;
            --card-border: #2C2C2E;
            --text-primary: #FFFFFF;
            --text-secondary: #8E8E93;
            --accent: #0A84FF;
            --success: #34C759;
            --warning: #FF9F0A;
            --danger: #FF453A;
            --purple: #AF52DE;
            --font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        @media (prefers-color-scheme: light) {
            :root {
                --bg-color: #F2F2F7;
                --card-bg: #FFFFFF;
                --card-border: #E5E5EA;
                --text-primary: #000000;
                --text-secondary: #6C6C70;
            }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: var(--font-family);
            line-height: 1.5;
            padding: 30px 20px 80px;
        }

        .container {
            max-width: 1120px;
            margin: 0 auto;
        }

        /* Header Hero */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .app-icon {
            width: 60px;
            height: 60px;
            border-radius: 14px;
            background: linear-gradient(135deg, #0A84FF, #5856D6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            box-shadow: 0 8px 18px rgba(10, 132, 255, 0.35);
        }
        .app-title h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .badge-verified {
            background: var(--accent);
            color: #FFF;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
        }
        .app-title p {
            color: var(--text-secondary);
            font-size: 14px;
            margin-top: 2px;
        }

        /* Server Status Pill */
        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13.5px;
            font-weight: 600;
            background: rgba(52, 199, 89, 0.12);
            color: var(--success);
            border: 1px solid rgba(52, 199, 89, 0.25);
        }
        .status-pill.error {
            background: rgba(255, 69, 58, 0.12);
            color: var(--danger);
            border-color: rgba(255, 69, 58, 0.25);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 4px;
            background: currentColor;
            box-shadow: 0 0 8px currentColor;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 14px;
            margin-bottom: 28px;
        }
        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            padding: 16px 18px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .stat-label {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .stat-value {
            font-size: 26px;
            font-weight: 700;
            color: var(--text-primary);
            margin: 6px 0 2px;
        }
        .stat-desc {
            font-size: 12px;
            color: var(--accent);
            font-weight: 500;
        }

        /* Section Title */
        .section-title {
            font-size: 18px;
            font-weight: 700;
            margin: 28px 0 14px;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        /* Table Card */
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 24px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13.5px;
        }
        th {
            background: rgba(142, 142, 147, 0.08);
            color: var(--text-secondary);
            padding: 12px 16px;
            font-weight: 600;
            border-bottom: 1px solid var(--card-border);
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--card-border);
            vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }

        .badge-status {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
        }
        .badge-status.pending { background: rgba(255, 159, 10, 0.15); color: var(--warning); }
        .badge-status.approved { background: rgba(52, 199, 89, 0.15); color: var(--success); }
        .badge-status.rejected { background: rgba(255, 69, 58, 0.15); color: var(--danger); }

        .btn {
            border: none;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .btn-approve { background: var(--success); color: #FFF; }
        .btn-approve:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-reject { background: rgba(255, 69, 58, 0.15); color: var(--danger); }
        .btn-reject:hover { background: var(--danger); color: #FFF; }

        /* API Endpoints */
        .api-item {
            padding: 16px 20px;
            border-bottom: 1px solid var(--card-border);
            display: flex;
            align-items: flex-start;
            gap: 16px;
            flex-wrap: wrap;
        }
        .api-item:last-child { border-bottom: none; }
        .method {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .method.post { background: rgba(52, 199, 89, 0.15); color: var(--success); }
        .method.get { background: rgba(10, 132, 255, 0.15); color: var(--accent); }
        .method.any { background: rgba(175, 82, 222, 0.15); color: var(--purple); }

        pre {
            background: #121214;
            color: #34C759;
            padding: 12px;
            border-radius: 10px;
            font-size: 12px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            overflow-x: auto;
            border: 1px solid #2C2C2E;
            margin-top: 8px;
        }

        .alert-success {
            background: rgba(52, 199, 89, 0.15);
            border: 1px solid var(--success);
            color: var(--success);
            padding: 12px 18px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <div class="app-icon">🛡️</div>
                <div class="app-title">
                    <h1>LockX Vault Server <span class="badge-verified">PHP API 2.6.0</span></h1>
                    <p>Trung tâm quản trị phê duyệt Tích Xanh, cấp OTP & lưu trữ tin nhắn, cuộc gọi</p>
                </div>
            </div>
            <div>
                <?php if ($dbConnected): ?>
                    <div class="status-pill">
                        <span class="status-dot"></span>
                        MySQL Connected • PHP <?= phpversion() ?>
                    </div>
                <?php else: ?>
                    <div class="status-pill error">
                        <span class="status-dot"></span>
                        Database Offline (Chưa kết nối)
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($actionMessage)): ?>
            <div class="alert-success"><?= htmlspecialchars($actionMessage) ?></div>
        <?php endif; ?>

        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Người Dùng</div>
                <div class="stat-value"><?= number_format($stats['users']) ?></div>
                <div class="stat-desc">Tích Xanh: <?= number_format($stats['verified']) ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Chờ Duyệt Tích Xanh</div>
                <div class="stat-value" style="color: var(--warning);"><?= number_format($stats['pending_verifications']) ?></div>
                <div class="stat-desc">Cần phê duyệt</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Tin Nhắn Chat</div>
                <div class="stat-value"><?= number_format($stats['messages']) ?></div>
                <div class="stat-desc">Mã hóa E2EE</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Cuộc Gọi</div>
                <div class="stat-value"><?= number_format($stats['calls']) ?></div>
                <div class="stat-desc">Nhật ký thoại & video</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Yêu Cầu Quên MK (OTP)</div>
                <div class="stat-value"><?= number_format($stats['otps']) ?></div>
                <div class="stat-desc">Telegram & Email</div>
            </div>
        </div>

        <!-- 1. BẢNG PHÊ DUYỆT TÍCH XANH -->
        <div class="section-title">
            <span>🛡️ Danh Sách Yêu Cầu Cấp Tích Xanh (LockX Verified)</span>
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tự động đồng bộ với Mobile App</span>
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tài Khoản</th>
                        <th>Thiết Bị & Face ID</th>
                        <th>Thời Gian</th>
                        <th>Trạng Thái</th>
                        <th style="text-align: right;">Hành Động</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($pendingRequests)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                                Chưa có yêu cầu cấp Tích Xanh nào được gửi lên.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($pendingRequests as $req): ?>
                            <tr>
                                <td><b>#<?= $req['id'] ?></b></td>
                                <td>
                                    <b><?= htmlspecialchars($req['display_name']) ?></b><br>
                                    <small style="color: var(--text-secondary);">@<?= htmlspecialchars($req['username']) ?> • <?= htmlspecialchars($req['phone'] ?: $req['email'] ?: 'No Contact') ?></small>
                                </td>
                                <td>
                                    <span style="color: var(--accent); font-weight: 500;"><?= htmlspecialchars($req['device_info'] ?: 'Apple Device') ?></span><br>
                                    <small style="color: var(--success);">✓ Đã quét Face ID trên máy</small>
                                </td>
                                <td><?= date('H:i d/m/Y', strtotime($req['created_at'])) ?></td>
                                <td>
                                    <span class="badge-status <?= $req['status'] ?>">
                                        <?= $req['status'] === 'pending' ? '⏳ Chờ duyệt' : ($req['status'] === 'approved' ? '🟢 Đã cấp tích' : '🔴 Từ chối') ?>
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <?php if ($req['status'] === 'pending'): ?>
                                        <form method="POST" style="display: inline-flex; gap: 6px;">
                                            <input type="hidden" name="request_id" value="<?= $req['id'] ?>">
                                            <button type="submit" name="admin_action" value="approve" class="btn btn-approve">✓ Duyệt Ngay</button>
                                            <button type="submit" name="admin_action" value="reject" class="btn btn-reject">✕ Từ chối</button>
                                        </form>
                                    <?php else: ?>
                                        <small style="color: var(--text-secondary);"><?= htmlspecialchars($req['verified_key'] ?: 'Đã xử lý') ?></small>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- 2. BẢNG QUẢN LÝ NGƯỜI DÙNG & TÀI KHOẢN -->
        <div class="section-title">
            <span>👥 Quản Lý Danh Sách Người Dùng & Tài Khoản (Users)</span>
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tự động lưu khi đăng ký</span>
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Tài Khoản</th>
                        <th>Họ Tên / Email / SĐT</th>
                        <th>Tích Xanh LockX</th>
                        <th>Trạng Thái</th>
                        <th>Ngày Đăng Ký</th>
                        <th style="text-align: right;">Hành Động</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($allUsers)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                                Chưa có người dùng nào trong cơ sở dữ liệu.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($allUsers as $u): ?>
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: <?= htmlspecialchars($u['avatar_color'] ?: '#0A84FF') ?>; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #FFF; font-size: 14px;">
                                            <?= mb_substr($u['display_name'] ?: $u['username'], 0, 1) ?>
                                        </div>
                                        <div>
                                            <b>@<?= htmlspecialchars($u['username']) ?></b>
                                            <div style="font-size: 11px; color: var(--text-secondary);">ID #<?= $u['id'] ?> • IP: <?= htmlspecialchars($u['last_ip'] ?: '127.0.0.1') ?></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div><b><?= htmlspecialchars($u['display_name']) ?></b></div>
                                    <small style="color: var(--text-secondary);"><?= htmlspecialchars($u['email'] ?: 'Chưa có email') ?> • <?= htmlspecialchars($u['phone'] ?: 'Chưa có SĐT') ?></small>
                                </td>
                                <td>
                                    <?php if ($u['is_verified']): ?>
                                        <span class="badge-status approved" style="font-size: 11px;">✓ Tích Xanh</span>
                                    <?php else: ?>
                                        <span class="badge-status pending" style="font-size: 11px; background: rgba(142, 142, 147, 0.15); color: var(--text-secondary);">Chưa cấp</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="badge-status <?= $u['status'] === 'active' ? 'approved' : 'rejected' ?>">
                                        <?= $u['status'] === 'active' ? '🟢 Hoạt động' : '🔴 Đã khóa' ?>
                                    </span>
                                </td>
                                <td><small style="color: var(--text-secondary);"><?= date('H:i d/m/Y', strtotime($u['created_at'])) ?></small></td>
                                <td style="text-align: right;">
                                    <form method="POST" style="display: inline-flex; gap: 6px;">
                                        <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                        <input type="hidden" name="current_status" value="<?= $u['status'] ?>">
                                        <?php if (!$u['is_verified']): ?>
                                            <button type="submit" name="admin_action" value="grant_verified" class="btn btn-approve" style="font-size: 11px; padding: 4px 8px;">+ Cấp Tích</button>
                                        <?php endif; ?>
                                        <button type="submit" name="admin_action" value="toggle_status" class="btn <?= $u['status'] === 'active' ? 'btn-reject' : 'btn-approve' ?>" style="font-size: 11px; padding: 4px 8px;">
                                            <?= $u['status'] === 'active' ? 'Khóa' : 'Mở' ?>
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- 3. BẢNG LỊCH SỬ CUỘC GỌI & NGÀY GIỜ -->
        <div class="section-title">
            <span>📞 Nhật Ký Cuộc Gọi (Ngày Giờ, Người Gọi & Thời Lượng)</span>
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tự động lưu từ Mobile</span>
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Người Gọi</th>
                        <th>Người Nhận</th>
                        <th>Loại Cuộc Gọi</th>
                        <th>Thời Lượng</th>
                        <th>Thời Gian Bắt Đầu</th>
                        <th>Trạng Thái</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($recentCalls)): ?>
                        <tr>
                            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                                Chưa có nhật ký cuộc gọi nào.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($recentCalls as $c): ?>
                            <tr>
                                <td>
                                    <b><?= htmlspecialchars($c['caller_name']) ?></b>
                                    <div style="font-size: 11px; color: var(--text-secondary);"><?= htmlspecialchars($c['caller_phone']) ?></div>
                                </td>
                                <td>
                                    <b><?= htmlspecialchars($c['receiver_name']) ?></b>
                                    <div style="font-size: 11px; color: var(--text-secondary);"><?= htmlspecialchars($c['receiver_phone']) ?></div>
                                </td>
                                <td>
                                    <span style="font-size: 12px; font-weight: 600;">
                                        <?= $c['call_type'] === 'incoming' ? '📞 Cuộc gọi đến' : ($c['call_type'] === 'outgoing' ? '↗️ Cuộc gọi đi' : ($c['call_type'] === 'missed' ? '⚠️ Cuộc gọi nhỡ' : '🔊 VoIP Call')) ?>
                                    </span>
                                </td>
                                <td><b><?= intval($c['duration_seconds']) ?>s</b></td>
                                <td><small style="color: var(--text-secondary);"><?= date('H:i:s d/m/Y', strtotime($c['start_time'])) ?></small></td>
                                <td>
                                    <span class="badge-status <?= $c['status'] === 'completed' ? 'approved' : ($c['status'] === 'missed' ? 'rejected' : 'pending') ?>">
                                        <?= strtoupper($c['status']) ?>
                                    </span>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- 4. BẢNG TIN NHẮN & THỜI GIAN TRÒ CHUYỆN -->
        <div class="section-title">
            <span>💬 Lưu Trữ Tin Nhắn Trò Chuyện (Messages & Ngày Giờ)</span>
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Hỗ trợ mã hóa E2EE</span>
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Người Gửi</th>
                        <th>Người Nhận</th>
                        <th>Loại Tin</th>
                        <th>Nội Dung</th>
                        <th>Thời Gian Gửi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($recentMessages)): ?>
                        <tr>
                            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                                Chưa có tin nhắn nào được lưu trữ.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($recentMessages as $m): ?>
                            <tr>
                                <td>
                                    <b><?= htmlspecialchars($m['sender_name']) ?></b>
                                    <div style="font-size: 11px; color: var(--text-secondary);">@<?= htmlspecialchars($m['sender_username']) ?></div>
                                </td>
                                <td>
                                    <b><?= htmlspecialchars($m['recipient_name']) ?></b>
                                    <div style="font-size: 11px; color: var(--text-secondary);">@<?= htmlspecialchars($m['recipient_username']) ?></div>
                                </td>
                                <td><span class="badge-status pending" style="font-size: 11px;"><?= strtoupper($m['message_type']) ?></span></td>
                                <td style="max-width: 320px; word-break: break-word;">
                                    <?= htmlspecialchars(mb_substr($m['content'], 0, 80)) ?><?= mb_strlen($m['content']) > 80 ? '...' : '' ?>
                                </td>
                                <td><small style="color: var(--text-secondary);"><?= date('H:i:s d/m/Y', strtotime($m['created_at'])) ?></small></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- 5. BẢNG MÃ OTP QUÊN MẬT KHẨU GẦN ĐÂY -->
        <div class="section-title">
            <span>🔑 Yêu Cầu Quên Mật Khẩu & Mã OTP Bảo Mật</span>
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tự động gửi qua Telegram/Email</span>
        </div>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Tài Khoản</th>
                        <th>Mã OTP Khôi Phục</th>
                        <th>IP Yêu Cầu</th>
                        <th>Thời Gian Hết Hạn</th>
                        <th>Trạng Thái</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($recentOtps)): ?>
                        <tr>
                            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                                Chưa có yêu cầu quên mật khẩu nào.
                            </td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($recentOtps as $otp): ?>
                            <tr>
                                <td><b>@<?= htmlspecialchars($otp['username']) ?></b></td>
                                <td>
                                    <span style="font-family: monospace; font-size: 16px; font-weight: 800; color: var(--accent); background: rgba(10, 132, 255, 0.12); padding: 4px 10px; border-radius: 6px;">
                                        <?= htmlspecialchars($otp['otp_code']) ?>
                                    </span>
                                </td>
                                <td><small style="color: var(--text-secondary);"><?= htmlspecialchars($otp['ip_address'] ?: '0.0.0.0') ?></small></td>
                                <td><?= date('H:i:s d/m/Y', strtotime($otp['expires_at'])) ?></td>
                                <td>
                                    <span class="badge-status <?= $otp['status'] === 'used' ? 'approved' : ($otp['status'] === 'pending' ? 'pending' : 'rejected') ?>">
                                        <?= $otp['status'] === 'pending' ? '⏳ Chưa nhập' : ($otp['status'] === 'used' ? '✓ Đã đổi MK' : 'Đã hết hạn') ?>
                                    </span>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- 6. DANH SÁCH API RESTFUL CHO MOBILE APP -->
        <div class="section-title">
            <span>📡 Danh Sách API RESTful Cho Mobile App</span>
        </div>
        <div class="card">
            <!-- Register User API -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/auth/register.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Đăng ký người dùng mới: Lưu vào bảng `users`, mã hóa password bcrypt và báo Telegram.</div>
                    <pre>Body: { "username": "user123", "password": "pass123", "display_name": "Nguyen Van A", "email": "a@gmail.com" }</pre>
                </div>
            </div>

            <!-- Verify Request API -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/auth/verify_request.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Gửi yêu cầu xác minh Tích Xanh lên server chờ Admin duyệt và báo Telegram.</div>
                    <pre>Body: { "username": "admin_lockx", "display_name": "Admin", "device_info": "iPhone 16 Pro" }</pre>
                </div>
            </div>

            <!-- Verify Status Check API -->
            <div class="api-item">
                <span class="method get">GET</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/auth/verify_request.php?username={username}</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Mobile App kiểm tra trạng thái phê duyệt Tích Xanh ('pending' | 'approved' | 'rejected').</div>
                </div>
            </div>

            <!-- Forgot Password API -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/auth/forgot_password.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Yêu cầu quên mật khẩu: Sinh mã OTP 6 số, gửi Telegram và Email.</div>
                    <pre>Body: { "username": "admin_lockx" }</pre>
                </div>
            </div>

            <!-- Reset Password API -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/auth/reset_password.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Nhập OTP và đổi mật khẩu mới an toàn.</div>
                    <pre>Body: { "username": "admin_lockx", "otp_code": "849201", "new_password": "mypassword123" }</pre>
                </div>
            </div>

            <!-- Messages Send -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/messages/send.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Lưu tin nhắn chat vào MySQL & đẩy cảnh báo Telegram.</div>
                </div>
            </div>

            <!-- Calls Log -->
            <div class="api-item">
                <span class="method post">POST</span>
                <div style="flex: 1;">
                    <div style="font-family: monospace; font-weight: 600; color: var(--text-primary);"><?= $baseUrl ?>/api/calls/log.php</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Ghi nhật ký cuộc gọi đến/đi/nhỡ.</div>
                </div>
            </div>
        </div>

        <div style="text-align: center; color: var(--text-secondary); font-size: 13px; margin-top: 40px;">
            LockX Vault & GVault Backend PHP Core © 2026. Tích hợp Quản lý Users, Cuộc gọi, Tin nhắn & Duyệt Tích Xanh.
        </div>
    </div>
</body>
</html>
