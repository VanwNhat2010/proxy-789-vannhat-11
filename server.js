const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// URL của API gốc mà bạn muốn treo
const TARGET_API_URL = 'https://sicbo-789-vannhat-predict.onrender.com/api/789/vannhat';

app.get('/proxy/789', async (req, res) => {
  try {
    // Gửi yêu cầu đến API gốc
    const response = await axios.get(TARGET_API_URL);

    // Trả về dữ liệu nhận được từ API gốc
    res.json(response.data);
  } catch (error) {
    console.error('Lỗi khi gọi API gốc:', error.message);
    res.status(500).json({ error: 'Không thể kết nối hoặc nhận dữ liệu từ API gốc.' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy API đang chạy trên cổng ${PORT}`);
});
