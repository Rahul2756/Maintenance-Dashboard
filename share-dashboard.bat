@echo off
echo ===================================================
echo Starting NH-334 Dashboard Public Share Tunnel...
echo ===================================================
echo.
echo Make sure the dev server is running on port 5173 (e.g. npm run dev in nh334-dpr-dashboard).
echo.
"C:\Users\NandanHarishKarati\cloudflared.exe" tunnel --url http://127.0.0.1:5173
pause

