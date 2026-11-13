const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PORT = 5173;
const DIST_DIR = path.resolve(__dirname, 'dist');
const DIST_DATA_DIR = path.join(DIST_DIR, 'data');
const PUBLIC_DATA_DIR = path.resolve(__dirname, 'public', 'data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(JSON.stringify(payload));
}

function handleUploadMetadata(res) {
  try {
    const metaCandidates = [
      path.join(DIST_DATA_DIR, 'upload_metadata.json'),
      path.join(PUBLIC_DATA_DIR, 'upload_metadata.json')
    ];
    for (const metaPath of metaCandidates) {
      if (fs.existsSync(metaPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        fs.createReadStream(metaPath).pipe(res);
        return;
      }
    }

    const excelPath = path.join(DIST_DATA_DIR, 'final_sheet.xlsx');
    if (fs.existsSync(excelPath)) {
      const stats = fs.statSync(excelPath);
      return sendJson(res, 200, {
        originalName: 'final_sheet.xlsx',
        filename: 'final_sheet.xlsx',
        uploadedAt: stats.mtime.toISOString(),
        formattedDate: '10-Nov-2026 17:56',
        size: stats.size,
        status: 'active'
      });
    }

    return sendJson(res, 200, {
      originalName: 'final_sheet.xlsx',
      filename: 'final_sheet.xlsx',
      uploadedAt: new Date().toISOString(),
      formattedDate: '10-Nov-2026 17:56',
      size: 0,
      status: 'active'
    });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
}

function handleUploadExcel(req, res) {
  const rawFilename = req.headers['x-filename'] || 'final_sheet.xlsx';
  const originalName = decodeURIComponent(String(rawFilename));
  const chunks = [];

  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const tempPath = path.join(DIST_DATA_DIR, 'final_sheet.tmp.xlsx');
    try {
      const buffer = Buffer.concat(chunks);
      if (!buffer || buffer.length < 500) {
        return sendJson(res, 400, {
          success: false,
          error: 'Empty or corrupt file payload received (under 500 bytes). Upload aborted.'
        });
      }

      fs.mkdirSync(DIST_DATA_DIR, { recursive: true });
      fs.writeFileSync(tempPath, buffer);

      let wb;
      try {
        wb = XLSX.read(buffer, { type: 'buffer' });
      } catch (parseErr) {
        if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {}
        return sendJson(res, 400, {
          success: false,
          error: 'Invalid Excel file format: ' + parseErr.message
        });
      }

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {}
        return sendJson(res, 400, { success: false, error: 'Workbook contains no worksheets.' });
      }

      const lowerSheets = wb.SheetNames.map((s) => s.toLowerCase().trim());
      const hasWorkProgram = lowerSheets.some((s) => s.includes('work program'));
      const hasChainage = lowerSheets.some(
        (s) => s.includes('chainage log') || s.includes('chainage') || s.includes('dpr')
      );

      if (!hasWorkProgram && !hasChainage) {
        if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {}
        return sendJson(res, 400, {
          success: false,
          error: `Workbook validation failed: Missing required sheets ('Work Program' or 'Chainage Log'). Sheets present: [${wb.SheetNames.join(', ')}].`
        });
      }

      fs.writeFileSync(path.join(DIST_DATA_DIR, 'final_sheet.xlsx'), buffer);
      if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {}

      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayStr = String(now.getDate()).padStart(2, '0');
      const monStr = months[now.getMonth()];
      const yrStr = now.getFullYear();
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const metadata = {
        originalName,
        filename: 'final_sheet.xlsx',
        uploadedAt: now.toISOString(),
        formattedDate: `${dayStr}-${monStr}-${yrStr} ${timeStr}`,
        size: buffer.length,
        status: 'active',
        sheetCount: wb.SheetNames.length,
        sheets: wb.SheetNames
      };

      const metaJson = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(path.join(DIST_DATA_DIR, 'upload_metadata.json'), metaJson, 'utf-8');

      // Keep public/data synchronized as well
      if (fs.existsSync(PUBLIC_DATA_DIR)) {
        fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'final_sheet.xlsx'), buffer);
        fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'upload_metadata.json'), metaJson, 'utf-8');
      }

      console.log(`[Excel Upload] Saved ${originalName} -> final_sheet.xlsx (${buffer.length} bytes)`);
      return sendJson(res, 200, {
        success: true,
        message: 'Workbook validated and saved to final_sheet.xlsx successfully.',
        metadata
      });
    } catch (innerErr) {
      if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch {}
      return sendJson(res, 500, {
        success: false,
        error: 'Server error processing workbook: ' + innerErr.message
      });
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (req.method === 'GET' && pathname === '/api/upload-metadata') {
    return handleUploadMetadata(res);
  }

  if (req.method === 'POST' && pathname === '/api/upload-excel') {
    return handleUploadExcel(req, res);
  }

  let filePath = path.join(DIST_DIR, pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isDynamicOrHtml = ext === '.html' || pathname.startsWith('/data/');

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': isDynamicOrHtml ? 'no-store, no-cache, must-revalidate' : 'public, max-age=31536000, immutable'
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NH-334 Dashboard Production Server listening on http://0.0.0.0:${PORT}`);
});
