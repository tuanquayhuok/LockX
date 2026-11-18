import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const REA_DIR = path.join(__dirname, 'rea');
const RUNNER_SCRIPT = path.join(REA_DIR, 'run-cli.mjs');
const TMP_DIR = path.join(__dirname, 'temp_downloads');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// API Thực thi lệnh REA Terminal
app.post('/api/run', async (req, res) => {
  const { command, url, args = [] } = req.body;
  let fullArgs = [];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  // Trích xuất tự động thông minh khi người dùng dán URL Web
  if (command === 'inspect-web-page' || command === 'scrape-web-bundle') {
    if (!url) {
      sendLog('stderr', 'Lỗi: Vui lòng cung cấp URL hợp lệ!\n');
      res.end();
      return;
    }

    try {
      sendLog('stdout', `[Web Engine] Đang kết nối và tải mã nguồn từ: ${url} ...\n`);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await response.text();
      sendLog('stdout', `[Web Engine] Đã tải xong HTML (${(html.length / 1024).toFixed(1)} KB). Đang bóc tách các thẻ <script> ...\n`);

      // Tìm các script src
      const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
      const scripts = [];
      let match;
      while ((match = scriptSrcRegex.exec(html)) !== null) {
        let scriptUrl = match[1];
        if (scriptUrl.startsWith('//')) scriptUrl = 'https:' + scriptUrl;
        else if (scriptUrl.startsWith('/')) {
          const u = new URL(url);
          scriptUrl = `${u.origin}${scriptUrl}`;
        }
        scripts.push(scriptUrl);
      }

      sendLog('stdout', `[Web Engine] Tìm thấy ${scripts.length} file JavaScript/Bundle trong trang:\n`);
      scripts.forEach((s, idx) => {
        sendLog('stdout', `   ${idx + 1}. ${s}\n`);
      });

      if (scripts.length > 0) {
        const firstJs = scripts[0];
        sendLog('stdout', `\n[REA Recovery] Đang tải file JS chính để giải nén ngược: ${firstJs} ...\n`);
        const jsRes = await fetch(firstJs);
        const jsContent = await jsRes.text();
        const tmpJsFile = path.join(TMP_DIR, 'bundle.js');
        const outDir = path.join(TMP_DIR, 'recovered_src');
        if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(tmpJsFile, jsContent, 'utf-8');

        sendLog('stdout', `[REA Engine] Chạy recover-javascript-sources trên bundle (${(jsContent.length / 1024).toFixed(1)} KB) ...\n`);
        fullArgs = ['recover-javascript-sources', tmpJsFile, outDir];
      } else {
        sendLog('stdout', `[Web Engine] Trang này không dùng file JS ngoài hoặc mã nằm inline trong HTML.\n`);
        res.end();
        return;
      }
    } catch (fetchErr) {
      sendLog('stderr', `Lỗi phân tích URL: ${fetchErr.message}\n`);
      res.end();
      return;
    }
  } else if (command === 'custom') {
    const rawCmd = (req.body.rawCommand || '').trim();
    if (!rawCmd) {
      sendLog('stderr', 'Lệnh không được để trống\n');
      res.end();
      return;
    }
    const matched = rawCmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
    fullArgs = matched ? matched.map(m => m.replace(/^['"]|['"]$/g, '')) : [];
  } else if (command === 'providers') {
    fullArgs = ['providers'];
  } else if (command === 'help') {
    fullArgs = ['--help'];
  } else if (command === 'list-adb-devices') {
    fullArgs = ['list-adb-devices'];
  } else {
    fullArgs = [command, ...(url ? [url] : []), ...args];
  }

  // Spawn qua npx.cmd tsx
  const child = spawn('npx.cmd', ['tsx', RUNNER_SCRIPT, ...fullArgs], {
    cwd: REA_DIR,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.stdout.on('data', (data) => {
    sendLog('stdout', data.toString());
  });

  child.stderr.on('data', (data) => {
    sendLog('stderr', data.toString());
  });

  child.on('close', (code) => {
    sendLog('exit', code);
    res.end();
  });

  child.on('error', (err) => {
    sendLog('stderr', `Lỗi thực thi: ${err.message}\n`);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`[REA Terminal Console] Đang chạy tại http://localhost:${PORT}`);
});
