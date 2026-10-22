/**
 * 推薦演算法與核心業務邏輯 (Pure Business Logic)
 * 遵循 SPEC.md 與 ACCEPTANCE.md 規範
 */

export const CATEGORY_NAMES = {
  bedding: '睡眠寢具',
  bathroom: '個人衛浴',
  desk_power: '書桌電源',
  storage: '空間收納'
};

export const BUDGET_TIER_CONFIG = {
  budget: { label: '小資省錢型', max: 1500, min: 0 },
  standard: { label: '均衡實用型', max: 3000, min: 1500 },
  premium: { label: '舒適升級型', max: Infinity, min: 3000 }
};

/**
 * 計算單一商品的適配加權分數
 * @param {Object} product 商品物件
 * @param {Object} answers 使用者問卷回答 { budget_tier, sleep_habit, items_volume }
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreProduct(product, answers) {
  let score = 0;
  const reasons = [];

  // 1. 預算匹配評分 (基礎分 50 分 / 跨級 20 分)
  const targetTag = `tier_${answers.budget_tier}`;
  if (product.tags.includes(targetTag)) {
    score += 50;
    reasons.push(`符合${BUDGET_TIER_CONFIG[answers.budget_tier]?.label || '設定預算'}`);
  } else if (
    (answers.budget_tier === 'standard' && product.tags.includes('tier_budget')) ||
    (answers.budget_tier === 'premium' && product.tags.includes('tier_standard'))
  ) {
    score += 20;
    reasons.push('高性價比相容推薦');
  }

  // 2. 睡眠習慣加權
  if (answers.sleep_habit === 'sensitive' && product.tags.includes('sleep_sensitive')) {
    score += 30;
    reasons.push('淺眠體質必備');
  }

  // 3. 物品多寡加權
  if (answers.items_volume === 'heavy' && product.tags.includes('items_heavy')) {
    score += 30;
    reasons.push('雜物收納神物');
  } else if (answers.items_volume === 'minimal' && product.tags.includes('items_minimal')) {
    score += 20;
    reasons.push('極簡省空間首選');
  }

  // 4. 熱銷口碑加分
  if (product.tags.includes('bestseller')) {
    score += 10;
    reasons.push('學長姐口碑熱銷款');
  }

  return { score, reasons };
}

/**
 * 依據問卷作答產生四大類別推薦清單（含缺貨替代邏輯）
 * @param {Array} products 全體商品陣列
 * @param {Object} answers 使用者問卷回答
 * @returns {Array} 最終推薦商品清單
 */
export function getRecommendations(products, answers) {
  const categories = ['bedding', 'bathroom', 'desk_power', 'storage'];
  const recommendations = [];

  categories.forEach((cat) => {
    // 篩選該分類商品並計算評分
    const categoryProducts = products
      .filter((p) => p.category === cat)
      .map((p) => {
        const { score, reasons } = scoreProduct(p, answers);
        return {
          ...p,
          score,
          recommendationReason: reasons.join(' · ') || '開學生活必備良品',
          isSubstituted: false
        };
      })
      .sort((a, b) => b.score - a.score);

    if (categoryProducts.length === 0) return;

    // 處理寢具特殊規則：如果淺眠體質，主推床墊外，另外推薦耳塞床簾套組 (p04)
    if (cat === 'bedding') {
      // 找出最適合的床墊 (p01, p02, p03)
      const mattress = categoryProducts.find((p) => p.id !== 'p04') || categoryProducts[0];
      recommendations.push(mattress);

      if (answers.sleep_habit === 'sensitive') {
        const sleepBooster = categoryProducts.find((p) => p.id === 'p04');
        if (sleepBooster) {
          recommendations.push({
            ...sleepBooster,
            recommendationReason: '淺眠體質必備 · 降噪遮光安睡推薦'
          });
        }
      }
      return;
    }

    // 針對其餘分類處理「缺貨智慧替代 (Auto-Substitution)」
    const topProduct = categoryProducts[0];

    if (topProduct.stock === 0) {
      // 首選缺貨，尋找同分類之同級替代商品 (優先尋找標籤含 backup_substitute 或庫存大於 0 者)
      const substitute =
        categoryProducts.find((p) => p.id !== topProduct.id && p.stock > 0 && p.tags.includes('backup_substitute')) ||
        categoryProducts.find((p) => p.id !== topProduct.id && p.stock > 0) ||
        topProduct;

      recommendations.push({
        ...substitute,
        isSubstituted: true,
        originalProductName: topProduct.name,
        recommendationReason: `★ 原首選「${topProduct.name}」熱銷缺貨中，已為您自動替換同級推薦款`
      });
    } else {
      recommendations.push(topProduct);
    }
  });

  return recommendations;
}

/**
 * 試算已選商品總額與預算狀態檢核
 * @param {Array} recommendedProducts 推薦清單
 * @param {Set|Array} selectedIds 顧客勾選的商品 ID 清單
 * @param {string} budgetTier 選擇的預算層級 ('budget' | 'standard' | 'premium')
 * @returns {Object} 結算與預算分析結果
 */
export function calculateSummary(recommendedProducts, selectedIds, budgetTier) {
  const selectedSet = new Set(selectedIds);
  const selectedItems = recommendedProducts.filter((p) => selectedSet.has(p.id));
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const count = selectedItems.length;

  const tierConfig = BUDGET_TIER_CONFIG[budgetTier] || BUDGET_TIER_CONFIG.standard;

  let budgetStatus = 'in_range';
  let statusText = '';
  let statusClass = 'text-green-600';
  let diffAmount = 0;

  if (count === 0) {
    statusText = '目前尚未選取任何商品，請勾選上方清單以試算入宿預算';
    statusClass = 'status-empty';
    budgetStatus = 'empty';
  } else if (budgetTier === 'budget') {
    if (totalPrice <= tierConfig.max) {
      diffAmount = tierConfig.max - totalPrice;
      statusText = `超省！低於小資預算上限（$${tierConfig.max}），還替你省下約 NT$ ${diffAmount.toLocaleString()} 元`;
      statusClass = 'status-success';
      budgetStatus = 'under_budget';
    } else {
      diffAmount = totalPrice - tierConfig.max;
      statusText = `超出小資預算 NT$ ${diffAmount.toLocaleString()} 元，可取消部分非急需單品`;
      statusClass = 'status-warning';
      budgetStatus = 'over_budget';
    }
  } else if (budgetTier === 'standard') {
    if (totalPrice <= tierConfig.max) {
      statusText = `預算控制極佳！整套 NT$ ${totalPrice.toLocaleString()} 完全在均衡預算區間內`;
      statusClass = 'status-success';
      budgetStatus = 'in_range';
    } else {
      diffAmount = totalPrice - tierConfig.max;
      statusText = `稍超出均衡預算上限 NT$ ${diffAmount.toLocaleString()} 元`;
      statusClass = 'status-warning';
      budgetStatus = 'over_budget';
    }
  } else if (budgetTier === 'premium') {
    statusText = `舒適旗艦配置，總計 NT$ ${totalPrice.toLocaleString()}，享受高品質宿舍生活`;
    statusClass = 'status-success';
    budgetStatus = 'in_range';
  }

  return {
    totalPrice,
    count,
    budgetStatus,
    statusText,
    statusClass,
    selectedItems
  };
}

/**
 * 格式化輸出純文字清單（用於複製至剪貼簿）
 * @param {Array} selectedItems 勾選的商品物件
 * @param {number} totalPrice 結算總額
 * @returns {string} 格式化字串
 */
export function formatChecklistText(selectedItems, totalPrice) {
  if (!selectedItems || selectedItems.length === 0) {
    return '';
  }

  const lines = [
    '📋 【我的大一入宿必備採購清單】',
    '----------------------------------------'
  ];

  selectedItems.forEach((item) => {
    const subNote = item.isSubstituted ? ' (同級推薦款)' : '';
    lines.push(`[${CATEGORY_NAMES[item.category] || item.categoryName}] ${item.name} - NT$ ${item.price.toLocaleString()}${subNote}`);
  });

  lines.push('----------------------------------------');
  lines.push(`共 ${selectedItems.length} 件商品，預估總額：NT$ ${totalPrice.toLocaleString()}`);
  lines.push('（由校園生活用品推薦網站產生）');

  return lines.join('\n');
}
