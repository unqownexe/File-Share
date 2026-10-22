@echo off
title FileShare - Dosya Paylasim Sunucusu
cd /d "%~dp0"

echo.
echo ============================================
echo   FileShare Sunucusu Baslatiliyor...
echo ============================================
echo.

node index.js

echo.
echo ============================================
echo   Sunucu durdu veya hata olustu!
echo ============================================
pause