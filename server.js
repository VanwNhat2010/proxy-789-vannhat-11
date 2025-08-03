const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// === Cấu Hình & Xử Lý Lỗi Axios Nâng Cao ===
// ================================================================
const axiosInstance = axios.create({
  timeout: 10000,
});

// Interceptor xử lý lỗi kết nối và tự động thử lại
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error;
    // Kiểm tra lỗi mạng, lỗi server hoặc timeout
    if (!response || response.status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      const MAX_RETRIES = 5;
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        // Áp dụng thuật toán backoff theo cấp số nhân để chờ trước khi thử lại
        const delay = Math.pow(2, config.__retryCount) * 200;
        console.warn(`[Axios Interceptor] Lỗi kết nối hoặc máy chủ (${error.message}). Đang thử lại lần ${config.__retryCount} sau ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return axiosInstance(config);
      }
    }
    return Promise.reject(error);
  }
);

// ================================================================
// === Các Hàm Phân Tích Cơ Bản ===
// ================================================================

/**
 * @description Hàm tính xác suất thực tế của các tổng điểm (3 viên xí ngầu). Đây là cơ sở toán học không đổi của trò chơi.
 * @returns {object} Một đối tượng chứa xác suất của mỗi tổng điểm.
 */
const getTrueSumProbabilities = () => {
  const sumCounts = {};
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      for (let d3 = 1; d3 <= 6; d3++) {
        const sum = d1 + d2 + d3;
        sumCounts[sum] = (sumCounts[sum] || 0) + 1;
      }
    }
  }
  const totalOutcomes = 6 * 6 * 6; // 216
  const probabilities = {};
  for (const sum in sumCounts) {
    probabilities[sum] = (sumCounts[sum] / totalOutcomes);
  }
  return probabilities;
};

/**
 * @description Hàm chuyển đổi lịch sử kết quả thô thành trạng thái Tai/Xiu và Chan/Le.
 * @param {Array<Object>} history Dữ liệu lịch sử thô từ API.
 * @returns {Array<Object>} Mảng các đối tượng trạng thái đã được xử lý.
 */
const getHistoryStatus = (history) => history.map(h => ({
  phien: h.phien,
  tong: h.tong,
  taixiu: h.tong >= 11 ? 'T' : 'X',
  chanle: h.tong % 2 === 0 ? 'C' : 'L',
}));

// ================================================================
// === Thuật Toán Phân Tích Nâng Cao (AI Siêu Chuẩn) ===
// ================================================================

/**
 * Phân tích chuỗi Markov bậc 2 để dự đoán Tài/Xỉu
 * Dựa trên 2 trạng thái trước đó để xác định xác suất của trạng thái hiện tại.
 * Ví dụ: P(T|TX) - Xác suất ra Tài sau khi có 1 phiên Tài và 1 phiên Xỉu
 * @param {Array} statusHistory Lịch sử trạng thái đã được xử lý (T/X, C/L)
 * @returns {Object} Ma trận xác suất chuyển đổi hoặc null nếu không đủ dữ liệu
 */
const analyzeMarkovChain2 = (statusHistory) => {
  console.log('[AI] Bắt đầu phân tích chuỗi Markov bậc 2...');
  const markovMatrix = {
    'TT': { T: 0, X: 0 }, 'TX': { T: 0, X: 0 },
    'XT': { T: 0, X: 0 }, 'XX': { T: 0, X: 0 },
  };
  const counts = { 'TT': 0, 'TX': 0, 'XT': 0, 'XX': 0 };

  if (statusHistory.length < 3) {
    console.log('[AI] Không đủ dữ liệu cho chuỗi Markov (cần ít nhất 3 phiên).');
    return null;
  }
  for (let i = 2; i < statusHistory.length; i++) {
    const prevPrev = statusHistory[i - 2].taixiu;
    const prev = statusHistory[i - 1].taixiu;
    const current = statusHistory[i].taixiu;
    const key = prevPrev + prev;
    if (markovMatrix[key]) {
      markovMatrix[key][current]++;
      counts[key]++;
    }
  }

  for (const key in markovMatrix) {
    if (counts[key] > 0) {
      markovMatrix[key].T /= counts[key];
      markovMatrix[key].X /= counts[key];
    }
  }
  console.log('[AI] Kết thúc phân tích chuỗi Markov. Ma trận:', markovMatrix);
  return markovMatrix;
};

/**
 * Phân tích các mô hình (pattern) bệt và đảo gần đây
 * Giúp nhận diện xu hướng "bệt" (liên tiếp cùng một kết quả) hoặc "đảo" (liên tiếp thay đổi)
 * @param {Array} statusHistory Lịch sử trạng thái đã được xử lý (T/X, C/L)
 * @returns {Object} Số lần bệt và đảo gần nhất
 */
const analyzePattern = (statusHistory) => {
  console.log('[AI] Bắt đầu phân tích mô hình bệt và đảo...');
  if (statusHistory.length === 0) return { taixiu_pattern: null, chanle_pattern: null };

  const taixiu_pattern = { b_count: 0, d_count: 0 };
  const chanle_pattern = { b_count: 0, d_count: 0 };
  
  // Chỉ lấy 10 phiên gần nhất để phân tích mô hình ngắn hạn
  const taixiu_history = statusHistory.slice(0, 10).map(s => s.taixiu);
  const chanle_history = statusHistory.slice(0, 10).map(s => s.chanle);

  // Phân tích bệt Tài/Xỉu
  if (taixiu_history.length > 0) {
    const first_taixiu = taixiu_history[0];
    for (const val of taixiu_history) {
      if (val === first_taixiu) {
        taixiu_pattern.b_count++;
      } else {
        break; // Dừng lại ngay khi chuỗi bị phá vỡ
      }
    }
  }
  // Phân tích đảo Tài/Xỉu
  if (taixiu_history.length > 1) {
    for (let i = 0; i < taixiu_history.length - 1; i++) {
      if (taixiu_history[i] !== taixiu_history[i + 1]) {
        taixiu_pattern.d_count++;
      } else {
        break; // Dừng lại ngay khi chuỗi bị phá vỡ
      }
    }
  }

  // Phân tích bệt Chẵn/Lẻ
  if (chanle_history.length > 0) {
    const first_chanle = chanle_history[0];
    for (const val of chanle_history) {
      if (val === first_chanle) {
        chanle_pattern.b_count++;
      } else {
        break;
      }
    }
  }
  // Phân tích đảo Chẵn/Lẻ
  if (chanle_history.length > 1) {
    for (let i = 0; i < chanle_history.length - 1; i++) {
      if (chanle_history[i] !== chanle_history[i + 1]) {
        chanle_pattern.d_count++;
      } else {
        break;
      }
    }
  }
  console.log('[AI] Kết thúc phân tích mô hình. Kết quả:', { taixiu_pattern, chanle_pattern });
  return { taixiu_pattern, chanle_pattern };
};

// ================================================================
// === Thuật toán Dự đoán (AI Phân Tích Đa Chiều) ===
// ================================================================

/**
 * Thuật toán dự đoán kết hợp nhiều yếu tố:
 * 1. Phân tích Chuỗi Markov (xác suất chuyển đổi)
 * 2. Phân tích Mô hình (bệt, đảo)
 * 3. Phân tích Xác suất Toán học
 * 4. Phân tích Tần suất và Chu kỳ xuất hiện
 * @param {Array} history Dữ liệu lịch sử thô từ API
 * @returns {Object} Kết quả dự đoán Tài/Xỉu, 3 vị và độ tin cậy
 */
const predictAdvanced = (history) => {
  console.log('--------------------------------------------------');
  console.log('[AI Prediction] Bắt đầu quá trình dự đoán...');
  if (history.length < 5) {
    console.log('[AI Prediction] Không đủ dữ liệu để dự đoán nâng cao (cần > 5 phiên).');
    return { du_doan: "Chưa đủ dữ liệu", doan_vi: [], confidence: 0 };
  }

  const statusHistory = getHistoryStatus(history);
  const lastTwoStates = statusHistory.slice(0, 2).map(s => s.taixiu);
  const lastState = lastTwoStates[0];
  const lastTwoStatesKey = lastTwoStates.join('');
  const markovMatrix = analyzeMarkovChain2(statusHistory);
  const patterns = analyzePattern(statusHistory);
  const trueSumProbabilities = getTrueSumProbabilities();

  // --- 1. Dự đoán Tài/Xỉu (Kết hợp Markov và Pattern) ---
  let taixiu_prediction = 'Tài';
  let taixiu_confidence = 50; // Mức tin cậy cơ bản

  if (markovMatrix && markovMatrix[lastTwoStatesKey]) {
    const probT = markovMatrix[lastTwoStatesKey].T;
    const probX = markovMatrix[lastTwoStatesKey].X;
    if (probT > probX) {
      taixiu_prediction = 'Tài';
      taixiu_confidence = Math.round((probT / (probT + probX)) * 100);
    } else {
      taixiu_prediction = 'Xỉu';
      taixiu_confidence = Math.round((probX / (probT + probX)) * 100);
    }
    console.log(`[AI T/X] Dự đoán ban đầu (Markov): ${taixiu_prediction} với confidence ${taixiu_confidence}%`);
  } else {
     console.log('[AI T/X] Không đủ dữ liệu cho Markov, dự đoán dựa trên xu hướng gần nhất.');
     taixiu_prediction = lastState;
  }
  
  // Cải tiến: Áp dụng logic bắt bệt và đảo để điều chỉnh độ tin cậy
  // Nếu đang bệt dài (>= 5) và dự đoán vẫn là bệt, giảm độ tin cậy vì khả năng đảo cao
  if (patterns.taixiu_pattern.b_count >= 5 && taixiu_prediction === lastState) {
    taixiu_confidence = Math.max(20, taixiu_confidence - 15); // Giảm mạnh độ tin cậy
    taixiu_prediction = lastState === 'T' ? 'Xỉu' : 'Tài'; // Đảo ngược dự đoán
    console.log(`[AI T/X] Nhận diện bệt dài (${patterns.taixiu_pattern.b_count} phiên). Đảo dự đoán thành ${taixiu_prediction}. Confidence mới: ${taixiu_confidence}%`);
  }
  // Tương tự với mô hình đảo
  if (patterns.taixiu_pattern.d_count >= 5 && taixiu_prediction !== lastState) {
     taixiu_confidence = Math.max(20, taixiu_confidence - 15);
     taixiu_prediction = lastState === 'T' ? 'Xỉu' : 'Tài';
     console.log(`[AI T/X] Nhận diện đảo dài (${patterns.taixiu_pattern.d_count} phiên). Giảm confidence xuống ${taixiu_confidence}%`);
  }
  
  // --- 2. Dự đoán 3 vị (Tổng) (Kết hợp nhiều yếu tố) ---
  const recentSums = history.map(h => h.tong);
  const allSums = [...Array(16)].map((_, i) => i + 3);

  const combinedScores = {};
  console.log('[AI 3 Vị] Bắt đầu tính điểm tổng hợp cho 3 vị...');
  for (const sum of allSums) {
    // Score 1: Tần suất xuất hiện gần đây (50 phiên)
    const freqScore = recentSums.slice(0, 50).filter(s => s === sum).length / 50;
    
    // Score 2: Chu kỳ (Thời gian chưa xuất hiện)
    const lastSeenIndex = recentSums.findIndex(s => s === sum);
    const timeNotSeen = lastSeenIndex === -1 ? recentSums.length : lastSeenIndex;
    const timeScore = Math.min(timeNotSeen / 20, 1); // Càng lâu chưa ra, điểm càng cao (tối đa 1)
    
    // Score 3: Xác suất toán học
    const probScore = trueSumProbabilities[sum] || 0;
    
    // Score 4: Phù hợp với dự đoán Tài/Xỉu
    const patternScore = (sum >= 11 && taixiu_prediction === 'Tài') || (sum < 11 && taixiu_prediction === 'Xỉu') ? 1 : 0.8;
    
    // Công thức tính điểm cuối cùng (có trọng số)
    const totalScore = (freqScore * 0.8) + (timeScore * 1.5) + (probScore * 2) + (patternScore * 1.2);
    combinedScores[sum] = totalScore;
    console.log(`[AI 3 Vị] Tổng ${sum}: Freq=${freqScore.toFixed(2)}, Time=${timeScore.toFixed(2)}, Prob=${probScore.toFixed(2)}, Pattern=${patternScore.toFixed(2)} -> Total=${totalScore.toFixed(2)}`);
  }

  // Loại bỏ các trường hợp đặc biệt ít ra
  delete combinedScores[3];
  delete combinedScores[18];

  // Sắp xếp và lấy 3 tổng có điểm cao nhất
  const predictedSums = Object.entries(combinedScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, 3) // Lấy 3 vị
    .map(([sum]) => parseInt(sum));

  console.log('[AI Prediction] Kết quả cuối cùng:', {
    du_doan: taixiu_prediction,
    doan_vi: predictedSums,
    confidence: taixiu_confidence
  });
  console.log('--------------------------------------------------');

  return {
    du_doan: taixiu_prediction,
    doan_vi: predictedSums,
    confidence: taixiu_confidence
  };
};

// ================================================================
// === Express APP & API Endpoint ===
// ================================================================

// Middleware xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error('[Express Error] Lỗi máy chủ:', err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: { message: err.message || 'Đã xảy ra lỗi không xác định trên máy chủ.' } });
});

// API Endpoint chính
app.get('/api/789/vannhat', async (req, res, next) => {
  try {
    console.log(`[API Request] Nhận yêu cầu từ client...`);
    // Sử dụng API mới
    const response = await axiosInstance.get('https://sicbo789-100-hknam.onrender.com/api');
    const history = response.data;
    console.log(`[API Request] Lấy thành công dữ liệu lịch sử từ máy chủ thứ 3. Số phiên: ${history.length}`);

    if (!Array.isArray(history) || history.length === 0) {
      return res.status(200).json({
        phien_sau: null,
        du_doan: "Không đủ dữ liệu lịch sử để dự đoán.",
        doan_vi: [],
        luu_y: "Cần ít nhất một phiên để bắt đầu phân tích."
      });
    }

    const latest = history[0];
    let phien_sau;
    
    const phienTruocString = String(latest.phien);
    const cleanedPhien = phienTruocString.replace(/\D/g, '');
    const latestPhienInt = parseInt(cleanedPhien);
    
    if (!isNaN(latestPhienInt)) {
      phien_sau = String(latestPhienInt + 1);
    } else {
      phien_sau = "Không xác định";
    }

    const { du_doan, doan_vi, confidence } = predictAdvanced(history);

    const result = {
      phien_truoc: latest.phien,
      xuc_xac: `${latest.xuc_xac_1} - ${latest.xuc_xac_2} - ${latest.xuc_xac_3}`,
      tong: latest.tong,
      ket_qua: latest.ket_qua,
      phien_sau: phien_sau,
      du_doan: du_doan,
      doan_vi: doan_vi,
      do_tin_cay: `${confidence}%`,
      luu_y: "MUA TOOL THÌ IB @CStool001 NHÉ HÂHHAHAHAHA"
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.listen(PORT, () => {
  console.log(`✅ API Phân tích & Dự đoán Sicbo đang chạy tại http://localhost:${PORT}`);
  console.log(`⚠️ Lưu ý: Đây là công cụ phân tích thống kê, không phải công cụ dự đoán chắc chắn. Tài Xỉu là trò chơi may rủi.`);
});
