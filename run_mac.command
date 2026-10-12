#!/usr/bin/env bash
# Đổi thư mục làm việc về đúng thư mục chứa script
cd "$(dirname "$0")"

echo "========================================================"
echo "       KHỞI ĐỘNG ALCONOST VIDEO AUTO STUDIO (macOS)"
echo "========================================================"
echo ""

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Chưa tìm thấy Node.js trên máy Mac của bạn."
    echo "👉 Vui lòng cài đặt Node.js tại: https://nodejs.org"
    echo "   hoặc mở Terminal gõ: brew install node"
    echo ""
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

# Cài đặt thư viện nếu chưa có node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Đang cài đặt các thư viện cần thiết (npm install)..."
    npm install
fi

echo "🚀 Đang khởi động máy chủ và mở Web Dashboard..."
# Mở trình duyệt sau 1.5 giây để server kịp lắng nghe
(sleep 1.5 && open "http://localhost:3000") &

# Chạy ứng dụng
npm start

