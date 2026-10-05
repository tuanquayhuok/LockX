const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let hihiProcess = null;
let hihiState = {
  isRunning: false,
  target: '',
  port: 80,
  threads: 100,
  duration: 30,
  method: 'http',
  requestsSent: 0,
  bytesSent: 0,
  errors: 0,
  elapsed: 0,
  logs: []
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // 1. Movie Video Player HTML endpoint: /player?m3u8=...&title=...&poster=...
  if (pathname === '/player') {
    const m3u8 = parsed.query.m3u8 || '';
    const title = parsed.query.title || 'Đang Phát Video';
    const poster = parsed.query.poster || '';
    const proxiedM3u8 = m3u8 ? `http://localhost:3333/m3u8?url=${encodeURIComponent(m3u8)}` : '';

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #videoContainer { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; }
    video { width: 100%; height: 100%; object-fit: contain; }
    .badge { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); color: #34C759; padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; border: 1px solid rgba(52,199,89,0.3); pointer-events: none; z-index: 10; display: flex; align-items: center; gap: 6px; }
    .badge .dot { width: 7px; height: 7px; border-radius: 50%; background: #34C759; box-shadow: 0 0 6px #34C759; }
    .error-box { display: none; color: #FF453A; text-align: center; padding: 20px; font-size: 13px; font-weight: 700; }
  </style>
</head>
<body>
  <div id="videoContainer">
    <div class="badge"><div class="dot"></div> HLS 1080P VIP (DIRECT STREAM)</div>
    <video id="videoPlayer" controls autoplay playsinline poster="${poster}"></video>
    <div id="errorBox" class="error-box">Không thể tải luồng phát. Vui lòng mở bằng liên kết ngoài.</div>
  </div>

  <script>
    const m3u8Url = '${proxiedM3u8}';
    const rawM3u8 = '${m3u8}';
    const video = document.getElementById('videoPlayer');

    if (Hls.isSupported() && (rawM3u8 || m3u8Url)) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, fragLoadingTimeOut: 30000, manifestLoadingTimeOut: 30000 });
      hls.loadSource(rawM3u8 || m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (m3u8Url && hls.url !== m3u8Url) hls.loadSource(m3u8Url); else hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError(); break;
            default:
              hls.destroy(); video.src = rawM3u8; break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url || rawM3u8; video.play().catch(() => {});
    } else if (rawM3u8) {
      video.src = rawM3u8;
    }
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 2. M3U8 proxy: /m3u8?url=...
  if (pathname === '/m3u8') {
    const targetUrl = parsed.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url param');
      return;
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://ghienphimz.mom/'
      }
    };

    https.get(targetUrl, options, proxyRes => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
    }).on('error', err => {
      res.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('M3U8 Proxy Error: ' + err.message);
    });
    return;
  }

  // 3. Music Search API endpoint: /music/search?q=... (CHÍNH CHỦ + AVT NGHỆ SĨ + FULL BÀI)
  if (pathname === '/music/search') {
    const q = (parsed.query.q || '').trim();
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Missing query parameter q' }));
      return;
    }

    try {
      // Step A: Lấy thông tin phòng thu chính chủ từ iTunes (Artist chính thức + Studio Album Artwork 600x600)
      let officialArtist = '';
      let officialTrack = q;
      let officialCover = '';
      let officialAlbum = '';

      try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=3`);
        if (itunesRes.ok) {
          const itunesData = await itunesRes.json();
          const first = itunesData.results?.[0];
          if (first) {
            officialTrack = first.trackName;
            officialArtist = first.artistName;
            officialCover = first.artworkUrl100 ? first.artworkUrl100.replace('100x100', '600x600') : '';
            officialAlbum = first.collectionName || 'Official Studio Single';
          }
        }
      } catch (e) {}

      // Step B: Quét YouTube ưu tiên Kênh Chính Chủ (Official Artist Channel) & MV Chính Thức
      const searchQuery = officialArtist ? `${officialArtist} ${officialTrack} official` : `${q} official mv audio`;
      const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchQuery);
      const ytRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      const html = await ytRes.text();

      let candidates = [];
      const ytDataMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (ytDataMatch) {
        try {
          const data = JSON.parse(ytDataMatch[1]);
          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
          for (const item of contents) {
            const v = item.videoRenderer;
            if (!v || !v.videoId) continue;

            const title = v.title?.runs?.[0]?.text || '';
            const channelName = v.ownerText?.runs?.[0]?.text || '';
            const duration = v.lengthText?.simpleText || 'Full Song';
            const videoThumb = v.thumbnail?.thumbnails?.pop()?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
            const views = v.shortViewCountText?.simpleText || '';
            
            // Avatar chính chủ của kênh/nghệ sĩ
            const channelAvatar = v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || '';

            // Kiểm tra tích chính chủ (Verified Artist / Official Artist Channel)
            const badges = v.ownerBadges?.map(b => b.metadataBadgeRenderer?.style || b.metadataBadgeRenderer?.tooltip) || [];
            const isVerified = badges.some(b => b && (b.includes('VERIFIED') || b.includes('Official Artist') || b.includes('Nghệ sĩ được xác minh')));

            // Tính điểm chọn link chính chủ thật
            let score = 0;
            const titleLower = title.toLowerCase();
            const channelLower = channelName.toLowerCase();
            const trackLower = (officialTrack || q).toLowerCase();
            const qLower = q.toLowerCase();

            // 1. Phải đúng tên bài hát
            if (titleLower.includes(trackLower) || titleLower.includes(qLower)) {
              score += 45;
            } else {
              score -= 30;
            }

            // 2. Kênh trùng tên ca sĩ hoặc ca sĩ chính chủ
            const artistTokens = (officialArtist || q).toLowerCase().split(/[\s-]+/).filter(t => t.length > 1);
            if (artistTokens.some(t => channelLower.includes(t))) score += 30;
            if (artistTokens.some(t => titleLower.includes(t))) score += 10;

            // 3. Có tick nốt nhạc / verified
            if (isVerified) score += 25;

            // 4. Tiêu đề Official Music Video
            if (/official|chính thức/i.test(title)) score += 10;
            if (/music video|mv|official audio|album/i.test(title)) score += 10;

            // 5. Trừ điểm nặng các kênh rác, reup, lyrics tự phát
            const isLyricOrReup = /trạm phát nhạc|lyrics|lofi|karaoke|fanmade|tiktok|speed up/i.test(channelName) || 
                                  /lofi|speed up|slowed|karaoke|đoạn nhạc|lời bài hát/i.test(title);
            if (isLyricOrReup) score -= 35;

            candidates.push({
              id: v.videoId,
              title,
              artist: officialArtist || channelName,
              channelName,
              duration,
              cover: officialCover || channelAvatar || videoThumb,
              artistAvatar: channelAvatar,
              channelAvatar,
              isVerified,
              isOfficial: isVerified || (score >= 40),
              views,
              score,
              embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&playsinline=1`,
              playerUrl: `http://localhost:3333/music/player?id=${v.videoId}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(officialArtist || channelName)}&cover=${encodeURIComponent(officialCover || channelAvatar || videoThumb)}&avatar=${encodeURIComponent(channelAvatar)}&duration=${encodeURIComponent(duration)}&verified=${isVerified ? '1' : '0'}`,
              watchUrl: `https://www.youtube.com/watch?v=${v.videoId}`
            });
          }
        } catch (e) {}
      }

      // Sắp xếp ưu tiên KÊNH CHÍNH CHỦ LÊN ĐẦU
      candidates.sort((a, b) => b.score - a.score);

      // Regex fallback nếu không bắt được JSON
      if (candidates.length === 0) {
        const videoRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
        const titleRegex = /"title":{"runs":\[{"text":"([^"]+)"/g;
        const ids = [];
        let m;
        while ((m = videoRegex.exec(html)) !== null) {
          if (!ids.includes(m[1])) ids.push(m[1]);
        }
        const titles = [];
        while ((m = titleRegex.exec(html)) !== null) {
          titles.push(m[1]);
        }
        candidates = ids.slice(0, 6).map((id, idx) => ({
          id,
          title: titles[idx] || q,
          artist: officialArtist || 'Nghệ Sĩ Việt Nam',
          channelName: 'Kênh Chính Chủ',
          duration: 'Bản Đầy Đủ',
          cover: officialCover || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          artistAvatar: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          isVerified: true,
          isOfficial: true,
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`,
          playerUrl: `http://localhost:3333/music/player?id=${id}&title=${encodeURIComponent(titles[idx] || q)}`,
          watchUrl: `https://www.youtube.com/watch?v=${id}`
        }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        officialTrack,
        officialArtist,
        officialCover,
        results: candidates
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 4. Music Vinyl & Full Audio Player HTML: /music/player?id=...
  if (pathname === '/music/player') {
    const videoId = parsed.query.id || 'boKJ5XDs_mY';
    const title = parsed.query.title || 'Bản Nhạc Full HD';
    const artist = parsed.query.artist || 'Nghệ Sĩ';
    const cover = parsed.query.cover || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const avatar = parsed.query.avatar || cover;
    const duration = parsed.query.duration || 'Bản Đầy Đủ';
    const isVerified = parsed.query.verified === '1';

    const playerHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: radial-gradient(circle at 50% 30%, #161922, #08090d);
      color: #FFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .player-card {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 14px; position: relative;
    }

    /* Top artist header with official avatar */
    .artist-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .artist-avatar {
      width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
      border: 2px solid #1DB954; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    .artist-badge-name {
      font-size: 12px; font-weight: 800; color: #E5E5EA; display: flex; align-items: center; gap: 4px;
    }
    .verified-icon {
      color: #1DB954; display: inline-flex;
    }
    
    /* Vinyl record animation */
    .vinyl-wrapper {
      position: relative; width: 105px; height: 105px; margin-bottom: 10px;
    }
    .vinyl-disk {
      width: 100%; height: 100%; border-radius: 50%;
      background: repeating-radial-gradient(#111, #111 2px, #222 3px, #111 4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.7), inset 0 0 10px rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center;
      animation: spin 10s linear infinite; animation-play-state: paused;
    }
    .vinyl-disk.playing { animation-play-state: running; }
    .vinyl-center {
      width: 44px; height: 44px; border-radius: 50%;
      background-image: url('${cover}'); background-size: cover; background-position: center;
      border: 3px solid #1DB954; box-shadow: 0 0 8px rgba(0,0,0,0.5);
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .track-info { text-align: center; margin-bottom: 8px; max-width: 90%; }
    .track-title { font-size: 13.5px; font-weight: 800; color: #FFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
    .track-artist { font-size: 11.5px; color: #1DB954; font-weight: 700; }
    
    .timeline { width: 85%; max-width: 320px; display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .time-text { font-size: 10px; color: #8E8E93; font-weight: 700; min-width: 32px; }
    .progress-bar-bg { flex: 1; height: 5px; background: rgba(255,255,255,0.15); border-radius: 3px; overflow: hidden; cursor: pointer; }
    .progress-bar-fill { height: 100%; width: 0%; background: #1DB954; transition: width 0.3s; }

    .controls { display: flex; align-items: center; gap: 18px; }
    .ctrl-btn {
      background: none; border: none; color: #FFF; cursor: pointer;
      display: flex; align-items: center; justify-content: center; outline: none;
    }
    .play-btn {
      width: 44px; height: 44px; border-radius: 50%; background: #1DB954;
      color: #FFF; box-shadow: 0 4px 14px rgba(29, 185, 84, 0.45);
    }
    .play-btn:active { transform: scale(0.95); }
    
    #ytPlayerContainer { position: absolute; width: 1px; height: 1px; opacity: 0.01; pointer-events: none; overflow: hidden; }
  </style>
</head>
<body>
  <div class="player-card">
    <div class="artist-header">
      <img src="${avatar}" class="artist-avatar" onerror="this.src='${cover}'" />
      <div class="artist-badge-name">
        ${artist}
        <span class="verified-icon" title="Nghệ sĩ chính chủ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </span>
      </div>
    </div>

    <div class="vinyl-wrapper">
      <div id="vinylDisk" class="vinyl-disk">
        <div class="vinyl-center"></div>
      </div>
    </div>

    <div class="track-info">
      <div class="track-title">${title}</div>
      <div class="track-artist">${artist} • Bản Gốc Phòng Thu</div>
    </div>

    <div class="timeline">
      <span id="currentTime" class="time-text">0:00</span>
      <div class="progress-bar-bg" id="progressBg">
        <div class="progress-bar-fill" id="progressFill"></div>
      </div>
      <span id="totalTime" class="time-text">${duration}</span>
    </div>

    <div class="controls">
      <button class="ctrl-btn" id="rwBtn" title="Lùi 10s">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.2 3.16-1.98 5.12-1.98 3.73 0 6.84 2.55 7.73 6h2.08c-.96-4.59-5.01-8-9.81-8z"/></svg>
      </button>

      <button class="ctrl-btn play-btn" id="playBtn" title="Phát / Dừng">
        <svg id="playIcon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg id="pauseIcon" style="display:none;" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </button>

      <button class="ctrl-btn" id="ffBtn" title="Tiến 10s">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 8c2.65 0 5.05.99 6.9 2.6L22 7v9h-9l3.62-3.62c-1.39-1.2-3.16-1.98-5.12-1.98-3.73 0-6.84 2.55-7.73 6H1.69c.96-4.59 5.01-8 9.81-8z"/></svg>
      </button>
    </div>

    <div id="ytPlayerContainer">
      <div id="player"></div>
    </div>
  </div>

  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    let ytPlayer = null;
    let isPlaying = false;
    let timer = null;

    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const vinylDisk = document.getElementById('vinylDisk');
    const progressFill = document.getElementById('progressFill');
    const progressBg = document.getElementById('progressBg');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');

    function formatTime(sec) {
      sec = Math.floor(sec || 0);
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    function onYouTubeIframeAPIReady() {
      ytPlayer = new YT.Player('player', {
        height: '200', width: '200',
        videoId: '${videoId}',
        playerVars: {
          autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0
        },
        events: {
          onReady: function(e) {
            e.target.playVideo();
          },
          onStateChange: function(e) {
            if (e.data === YT.PlayerState.PLAYING) {
              isPlaying = true;
              playIcon.style.display = 'none';
              pauseIcon.style.display = 'block';
              vinylDisk.classList.add('playing');
              startTicker();
              try { window.parent.postMessage({ type: 'GV_MUSIC_STATE', isPlaying: true }, '*'); } catch (err) {}
            } else {
              isPlaying = false;
              playIcon.style.display = 'block';
              pauseIcon.style.display = 'none';
              vinylDisk.classList.remove('playing');
              clearInterval(timer);
              try { window.parent.postMessage({ type: 'GV_MUSIC_STATE', isPlaying: false }, '*'); } catch (err) {}
            }
          }
        }
      });

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: ${JSON.stringify(title)},
            artist: ${JSON.stringify(artist)},
            album: "GVault Audio Hub",
            artwork: [
              { src: ${JSON.stringify(avatar || cover)}, sizes: "512x512", type: "image/jpeg" }
            ]
          });
          navigator.mediaSession.setActionHandler('play', function() { if (ytPlayer) ytPlayer.playVideo(); });
          navigator.mediaSession.setActionHandler('pause', function() { if (ytPlayer) ytPlayer.pauseVideo(); });
          navigator.mediaSession.setActionHandler('seekbackward', function() { if (ytPlayer) ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10), true); });
          navigator.mediaSession.setActionHandler('seekforward', function() { if (ytPlayer) ytPlayer.seekTo(ytPlayer.getCurrentTime() + 10, true); });
        } catch (e) {}
      }

      window.addEventListener('message', function(evt) {
        if (!evt || !evt.data || !ytPlayer) return;
        if (evt.data === 'play' || (evt.data && evt.data.action === 'play')) ytPlayer.playVideo();
        if (evt.data === 'pause' || (evt.data && evt.data.action === 'pause')) ytPlayer.pauseVideo();
        if (evt.data === 'toggle' || (evt.data && evt.data.action === 'toggle')) {
          if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
        }
      });
    }

    function startTicker() {
      clearInterval(timer);
      timer = setInterval(function() {
        if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
          const cur = ytPlayer.getCurrentTime();
          const dur = ytPlayer.getDuration();
          if (dur > 0) {
            currentTimeEl.innerText = formatTime(cur);
            totalTimeEl.innerText = formatTime(dur);
            progressFill.style.width = ((cur / dur) * 100) + '%';
          }
        }
      }, 500);
    }

    playBtn.addEventListener('click', function() {
      if (!ytPlayer) return;
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    });

    document.getElementById('rwBtn').addEventListener('click', function() {
      if (!ytPlayer || !ytPlayer.getCurrentTime) return;
      ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10), true);
    });

    document.getElementById('ffBtn').addEventListener('click', function() {
      if (!ytPlayer || !ytPlayer.getCurrentTime) return;
      ytPlayer.seekTo(ytPlayer.getCurrentTime() + 10, true);
    });

    progressBg.addEventListener('click', function(e) {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const rect = progressBg.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      const dur = ytPlayer.getDuration();
      if (dur > 0) {
        ytPlayer.seekTo(pct * dur, true);
      }
    });
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(playerHtml);
    return;
  }

  // 5. HIHI Stress Test API endpoints: /hihi/start, /hihi/stop, /hihi/status, /hihi/gui
  if (pathname === '/hihi/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const target = (data.target || '').replace('http://', '').replace('https://', '').split('/')[0].trim();
        const port = parseInt(data.port) || 80;
        const threads = Math.min(1000, Math.max(1, parseInt(data.threads) || 100));
        const duration = Math.min(600, Math.max(5, parseInt(data.duration) || 30));
        const method = (data.method || 'http').toLowerCase();

        if (!target) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Chưa nhập Target URL / Domain' }));
          return;
        }

        if (hihiProcess) {
          try { hihiProcess.kill(); } catch (e) {}
          hihiProcess = null;
        }

        hihiState = {
          isRunning: true,
          target,
          port,
          threads,
          duration,
          method,
          requestsSent: 0,
          bytesSent: 0,
          errors: 0,
          elapsed: 0,
          logs: [`[*] Khởi tạo kiểm thử chịu tải Target: ${target}:${port} (Luồng: ${threads}, Thời gian: ${duration}s, Method: ${method.toUpperCase()})`]
        };

        const hihiDir = path.join(__dirname, 'hihi');
        const pythonScript = fs.existsSync(path.join(hihiDir, 'netbench.py'))
          ? path.join(hihiDir, 'netbench.py')
          : path.join(hihiDir, 'dos.py');

        hihiProcess = spawn('python', [
          pythonScript,
          '--cli',
          '--target', target,
          '--port', String(port),
          '--threads', String(threads),
          '--duration', String(duration),
          '--method', method
        ], {
          cwd: hihiDir
        });

        hihiProcess.stdout.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('PROGRESS:')) {
              const parts = trimmed.split(':');
              if (parts.length >= 5) {
                hihiState.requestsSent = parseInt(parts[1]) || 0;
                hihiState.bytesSent = parseInt(parts[2]) || 0;
                hihiState.errors = parseInt(parts[3]) || 0;
                hihiState.elapsed = parseInt(parts[4]) || 0;
              }
            } else if (trimmed.startsWith('LOG:')) {
              hihiState.logs.push(trimmed.slice(4));
              if (hihiState.logs.length > 100) hihiState.logs.shift();
            } else {
              hihiState.logs.push(trimmed);
              if (hihiState.logs.length > 100) hihiState.logs.shift();
            }
          }
        });

        hihiProcess.stderr.on('data', (chunk) => {
          const errText = chunk.toString().trim();
          if (errText) {
            hihiState.logs.push(`[ERR] ${errText}`);
            if (hihiState.logs.length > 100) hihiState.logs.shift();
          }
        });

        hihiProcess.on('close', (code) => {
          hihiState.isRunning = false;
          hihiState.logs.push(`[✓] Tiến trình kết thúc (Code: ${code}).`);
          hihiProcess = null;
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Đã khởi động tiến trình test' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/hihi/stop') {
    if (hihiProcess) {
      try { hihiProcess.kill(); } catch (e) {}
      hihiProcess = null;
    }
    hihiState.isRunning = false;
    hihiState.logs.push('[!] Đã gửi lệnh dừng tiến trình kiểm thử.');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: 'Đã dừng' }));
    return;
  }

  if (pathname === '/hihi/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(hihiState));
    return;
  }

  if (pathname === '/hihi/gui') {
    try {
      const hihiDir = path.join(__dirname, 'hihi');
      const pythonScript = fs.existsSync(path.join(hihiDir, 'netbench.py'))
        ? path.join(hihiDir, 'netbench.py')
        : path.join(hihiDir, 'dos.py');
      const child = spawn('python', [pythonScript], {
        cwd: hihiDir,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Đã mở cửa sổ Python Tkinter GUI' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // 6. HIHI Curl -I Header Inspector endpoint: /hihi/curl
  if (pathname === '/hihi/curl') {
    const handleCurl = (rawTarget) => {
      let target = (rawTarget || '').trim();
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Chưa cung cấp domain hoặc URL để curl' }));
        return;
      }

      // Chuẩn hóa URL nếu chưa có http/https
      let url = target;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const startTime = Date.now();
      hihiState.logs.push(`[CURL -I] > curl -s -I ${url}`);
      if (hihiState.logs.length > 100) hihiState.logs.shift();

      exec(`curl.exe -s -I --max-time 10 "${url}"`, { timeout: 12000 }, (error, stdout, stderr) => {
        const timeMs = Date.now() - startTime;
        if (error && !stdout) {
          // Thử lại HTTP nếu HTTPS thất bại và user không gõ protocol
          if (!/^https?:\/\//i.test(rawTarget) && url.startsWith('https://')) {
            const httpUrl = 'http://' + target;
            hihiState.logs.push(`[CURL] Thử lại với HTTP: ${httpUrl}`);
            exec(`curl.exe -s -I --max-time 10 "${httpUrl}"`, { timeout: 12000 }, (err2, stdout2, stderr2) => {
              finishCurl(err2, stdout2, stderr2, httpUrl, Date.now() - startTime);
            });
            return;
          }
          finishCurl(error, stdout, stderr, url, timeMs);
          return;
        }
        finishCurl(null, stdout, stderr, url, timeMs);
      });
    };

    const finishCurl = (error, stdout, stderr, finalUrl, timeMs) => {
      if (error && !stdout) {
        const errMsg = stderr?.trim() || error?.message || 'Không thể kết nối đến target';
        hihiState.logs.push(`[ERR] Curl thất bại: ${errMsg}`);
        if (hihiState.logs.length > 100) hihiState.logs.shift();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: false,
          error: errMsg,
          url: finalUrl,
          timeMs
        }));
        return;
      }

      const rawHeaders = (stdout || '').trim();
      const lines = rawHeaders.split(/\r?\n/);
      let statusCode = '';
      let server = 'Unknown';
      const parsedHeaders = {};

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (i === 0 || /^HTTP\/[0-9.]+\s+[0-9]+/i.test(line)) {
          statusCode = line;
        } else {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const k = line.substring(0, colonIdx).trim().toLowerCase();
            const v = line.substring(colonIdx + 1).trim();
            parsedHeaders[k] = v;
            if (k === 'server') server = v;
          }
        }
        hihiState.logs.push(`  ${line}`);
        if (hihiState.logs.length > 100) hihiState.logs.shift();
      }

      if (parsedHeaders['server']) {
        server = parsedHeaders['server'];
      } else if (parsedHeaders['x-turbo-charged-by']) {
        server = parsedHeaders['x-turbo-charged-by'];
      } else if (parsedHeaders['cf-ray']) {
        server = 'Cloudflare';
      }

      hihiState.logs.push(`[✓] Curl hoàn tất (${statusCode || 'OK'}) trong ${timeMs}ms.`);
      if (hihiState.logs.length > 100) hihiState.logs.shift();

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        url: finalUrl,
        statusCode: statusCode || 'HTTP/1.1 200 OK',
        server,
        timeMs,
        rawHeaders,
        headers: parsedHeaders
      }));
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          handleCurl(data.target || data.url);
        } catch (e) {
          handleCurl('');
        }
      });
    } else {
      handleCurl(parsed.query?.target || parsed.query?.url);
    }
    return;
  }

  // Generic fallback
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('GVault HLS & Music Stream Proxy is running on port 3333');
});

server.listen(3333, () => {
  console.log('GVault Stream & Music Proxy listening on http://localhost:3333');
});
