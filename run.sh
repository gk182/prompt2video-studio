#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "========================================================"
echo "       KHỞI ĐỘNG ALCONOST VIDEO AUTO STUDIO"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Không tìm thấy Node.js. Vui lòng cài đặt Node.js trước (https://nodejs.org)."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Đang cài đặt thư viện..."
    npm install
fi

echo "🚀 Đang mở Web Dashboard..."
if command -v open &> /dev/null; then
    (sleep 1.5 && open "http://localhost:3000") &
elif command -v xdg-open &> /dev/null; then
    (sleep 1.5 && xdg-open "http://localhost:3000") &
fi

npm start

