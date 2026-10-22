import './src/style.css';
import { RecommenderApp } from './src/ui.js';

// 應用程式進入點 (Application Entrypoint)
async function initApp() {
  try {
    const response = await fetch('/products.json');
    if (!response.ok) {
      throw new Error(`無法載入商品資料庫 (HTTP ${response.status})`);
    }
    const products = await response.json();
    console.log(`成功載入 ${products.length} 件商品`);

    // 初始化推薦應用程式
    new RecommenderApp(products);
  } catch (error) {
    console.error('初始化失敗:', error);
    const container = document.getElementById('quiz-section');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ef4444;">
          <h2>⚠️ 載入商品資料庫時發生錯誤</h2>
          <p>${error.message}</p>
          <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">重新整理</button>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', initApp);
