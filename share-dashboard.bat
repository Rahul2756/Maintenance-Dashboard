@echo off
echo ===================================================
echo Starting NH-334 Dashboard Production Server & Tunnel
echo ===================================================
echo.
start "NH-334 Server" /min node "%~dp0nh334-dpr-dashboard\server.cjs"
timeout /t 2 /nobreak >nul
echo Dashboard running locally at http://localhost:5173
echo.
echo Starting Public Cloudflare Tunnel...
"C:\Users\NandanHarishKarati\cloudflared.exe" tunnel --url http://127.0.0.1:5173
pause

