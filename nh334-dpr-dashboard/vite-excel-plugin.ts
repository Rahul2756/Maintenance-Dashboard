import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export function excelUploadPlugin(): Plugin {
  return {
    name: 'vite-plugin-excel-upload',
    configureServer(server) {
      setupExcelMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      setupExcelMiddleware(server.middlewares);
    }
  };
}

function setupExcelMiddleware(middlewares: any) {
  // Resolve public/data directory path
  const rootDir = process.cwd();
  const publicDataDir = fs.existsSync(path.resolve(rootDir, 'public/data'))
    ? path.resolve(rootDir, 'public/data')
    : path.resolve(rootDir, 'nh334-dpr-dashboard/public/data');

  const targetExcelPath = path.join(publicDataDir, 'final_sheet.xlsx');
  const tempExcelPath = path.join(publicDataDir, 'final_sheet.tmp.xlsx');
  const metadataPath = path.join(publicDataDir, 'upload_metadata.json');

  middlewares.use(async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    const url = new URL(rawUrl, 'http://localhost');

    // ============================================================
    // 1. GET /api/upload-metadata
    // ============================================================
    if (req.method === 'GET' && url.pathname === '/api/upload-metadata') {
      try {
        if (fs.existsSync(metadataPath)) {
          const raw = fs.readFileSync(metadataPath, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(raw);
          return;
        }

        if (fs.existsSync(targetExcelPath)) {
          const stats = fs.statSync(targetExcelPath);
          const fallbackMeta = {
            originalName: 'final_sheet.xlsx',
            filename: 'final_sheet.xlsx',
            uploadedAt: stats.mtime.toISOString(),
            formattedDate: '01-Nov-2026',
            size: stats.size,
            status: 'active'
          };
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(JSON.stringify(fallbackMeta));
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.end(
          JSON.stringify({
            originalName: 'final_sheet.xlsx',
            filename: 'final_sheet.xlsx',
            uploadedAt: new Date().toISOString(),
            formattedDate: '01-Nov-2026',
            size: 0,
            status: 'active'
          })
        );
        return;
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }
    }

    // ============================================================
    // 2. POST /api/upload-excel
    // ============================================================
    if (req.method === 'POST' && url.pathname === '/api/upload-excel') {
      try {
        const rawFilename = req.headers['x-filename'] || 'final_sheet.xlsx';
        const originalName = decodeURIComponent(String(rawFilename));

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));

        req.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);

            // Basic size check
            if (!buffer || buffer.length < 500) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Empty or corrupt file payload received (under 500 bytes). Upload aborted.'
                })
              );
              return;
            }

            // Step 1: Write to temporary file first (temp upload protection)
            fs.writeFileSync(tempExcelPath, buffer);

            // Step 2: Validate workbook with XLSX parser
            let wb: XLSX.WorkBook;
            try {
              wb = XLSX.read(buffer, { type: 'buffer' });
            } catch (parseErr: any) {
              if (fs.existsSync(tempExcelPath)) {
                try { fs.unlinkSync(tempExcelPath); } catch {}
              }
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Invalid Excel file format: ' + parseErr.message
                })
              );
              return;
            }

            if (!wb.SheetNames || wb.SheetNames.length === 0) {
              if (fs.existsSync(tempExcelPath)) {
                try { fs.unlinkSync(tempExcelPath); } catch {}
              }
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Workbook contains no worksheets.'
                })
              );
              return;
            }

            // Validate essential sheets needed by the NH-334 dashboard
            const lowerSheets = wb.SheetNames.map(s => s.toLowerCase().trim());
            const hasWorkProgram = lowerSheets.some(s => s.includes('work program'));
            const hasChainage = lowerSheets.some(
              s => s.includes('chainage log') || s.includes('chainage') || s.includes('dpr')
            );

            if (!hasWorkProgram && !hasChainage) {
              if (fs.existsSync(tempExcelPath)) {
                try { fs.unlinkSync(tempExcelPath); } catch {}
              }
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Workbook validation failed: Missing required sheets ('Work Program' or 'Chainage Log(input)'). Sheets present: [${wb.SheetNames.join(', ')}]. Previous active workbook has been retained.`
                })
              );
              return;
            }

            // Step 3: Atomic replace: write buffer to destination target final_sheet.xlsx
            fs.writeFileSync(targetExcelPath, buffer);

            // Clean up temporary file
            if (fs.existsSync(tempExcelPath)) {
              try { fs.unlinkSync(tempExcelPath); } catch {}
            }

            // Format timestamp for display (e.g. "01-Nov-2026" or "01-Nov-2026 16:30")
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dayStr = String(now.getDate()).padStart(2, '0');
            const monStr = months[now.getMonth()];
            const yrStr = now.getFullYear();
            const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const formattedDate = `${dayStr}-${monStr}-${yrStr} ${timeStr}`;

            const metadata = {
              originalName,
              filename: 'final_sheet.xlsx',
              uploadedAt: now.toISOString(),
              formattedDate,
              size: buffer.length,
              status: 'active',
              sheetCount: wb.SheetNames.length,
              sheets: wb.SheetNames
            };

            // Save metadata to public/data/upload_metadata.json
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

            console.log(`[Excel Upload] Successfully updated ${targetExcelPath} (${buffer.length} bytes)`);

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                message: 'Workbook validated and saved to public/data/final_sheet.xlsx successfully.',
                metadata
              })
            );
          } catch (innerErr: any) {
            if (fs.existsSync(tempExcelPath)) {
              try { fs.unlinkSync(tempExcelPath); } catch {}
            }
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: 'Server error processing workbook: ' + innerErr.message + '. Previous workbook retained.'
              })
            );
          }
        });
        return;
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }
    }

    next();
  });
}

