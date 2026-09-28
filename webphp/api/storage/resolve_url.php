<?php
/**
 * ==============================================================================
 * API Endpoint: Phân Tích & Lấy Thông Tin Tệp Thật Từ URL (MediaFire, Direct URL, Drive...)
 * Phương thức: POST / GET /api/storage/resolve_url.php
 * ==============================================================================
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../helpers/response.php';

$input = getRequestData();
$url = trim($input['url'] ?? ($_GET['url'] ?? ''));

if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
    jsonResponse(false, null, 'Vui lòng cung cấp đường dẫn URL hợp lệ.', 400);
}

// Hàm trích xuất tên tệp thông minh từ URL
function parseFilenameFromUrl($rawUrl) {
    $clean = strtok($rawUrl, '?');
    $clean = strtok($clean, '#');
    $decoded = urldecode($clean);
    $parts = explode('/', $decoded);
    
    // Tìm đoạn có phần mở rộng tệp
    for ($i = count($parts) - 1; $i >= 0; $i--) {
        $p = trim($parts[$i]);
        if (strpos($p, '.') !== false && substr($p, -1) !== '.') {
            return $p;
        }
    }
    return '';
}

$inferredName = parseFilenameFromUrl($url);
$realSize = 0;
$directUrl = $url;
$mimeType = 'application/octet-stream';

// 1. Xử lý đặc biệt nếu là link MediaFire (cào link tải trực tiếp và dung lượng thật)
if (strpos($url, 'mediafire.com') !== false) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $html = curl_exec($ch);
    curl_close($ch);

    if ($html) {
        // Tìm link tải trực tiếp trong thẻ a id="downloadButton" hoặc class="input popsok"
        if (preg_match('/href="([^"]+download[^"]+)"/i', $html, $m)) {
            $directUrl = $m[1];
        } elseif (preg_match('/aria-label="Download file"\s+href="([^"]+)"/i', $html, $m)) {
            $directUrl = $m[1];
        }

        // Tìm tên tệp trong thẻ class="filename" hoặc title
        if (preg_match('/<div class="filename"[^>]*>([^<]+)<\/div>/i', $html, $m)) {
            $inferredName = trim($m[1]);
        }

        // Tìm dung lượng tệp (vd: 12.5 MB)
        if (preg_match('/class="details"[^>]*>.*?<span>\(([^\)]+)\)<\/span>/is', $html, $m)) {
            $sizeStr = trim($m[1]);
            // Convert to bytes
            if (preg_match('/([0-9\.]+)\s*(KB|MB|GB)/i', $sizeStr, $sm)) {
                $num = floatval($sm[1]);
                $unit = strtoupper($sm[2]);
                if ($unit === 'KB') $realSize = (int)($num * 1024);
                if ($unit === 'MB') $realSize = (int)($num * 1024 * 1024);
                if ($unit === 'GB') $realSize = (int)($num * 1024 * 1024 * 1024);
            }
        }
    }
}

// 2. Nếu chưa có dung lượng thật, gửi HEAD request để lấy Content-Length & Content-Disposition
if ($realSize <= 0) {
    $ch = curl_init($directUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    $head = curl_exec($ch);
    $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $contentLength = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($contentLength > 0) {
        $realSize = (int)$contentLength;
    }
    if ($contentType) {
        $mimeType = $contentType;
    }
    if (empty($inferredName) && $effectiveUrl) {
        $inferredName = parseFilenameFromUrl($effectiveUrl);
    }
}

if (empty($inferredName)) {
    $inferredName = 'Tep_Tai_Ve_' . substr(md5($url), 0, 6) . '.bin';
}

// Format dung lượng
function formatBytes($bytes) {
    if ($bytes <= 0) return '0 KB';
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1024 * 1024) return round($bytes / 1024, 1) . ' KB';
    if ($bytes < 1024 * 1024 * 1024) return round($bytes / (1024 * 1024), 1) . ' MB';
    return round($bytes / (1024 * 1024 * 1024), 2) . ' GB';
}

$ext = pathinfo($inferredName, PATHINFO_EXTENSION) ?: 'bin';

$result = [
    'original_url'    => $url,
    'direct_url'      => $directUrl,
    'filename'        => $inferredName,
    'extension'       => strtolower($ext),
    'size'            => $realSize > 0 ? $realSize : 8388608, // fallback ~8 MB if unknown
    'size_formatted'  => $realSize > 0 ? formatBytes($realSize) : '8.0 MB',
    'mime_type'       => $mimeType,
];

jsonResponse(true, $result, 'Phân tích tệp thành công.');
