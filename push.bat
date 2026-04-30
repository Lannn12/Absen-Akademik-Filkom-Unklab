@echo off
echo Mengirim perbaikan ke GitHub...
git add .
git commit -m "Fix deployment errors"
git push origin main
echo Selesai! Silakan cek dashboard Vercel Anda.
pause
