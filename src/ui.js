import {
  CATEGORY_NAMES,
  BUDGET_TIER_CONFIG,
  getRecommendations,
  calculateSummary,
  formatChecklistText
} from './recommendation.js';

/**
 * UI 控制與互動層 (DOM Controller)
 */
export class RecommenderApp {
  constructor(products) {
    this.products = products;
    this.currentStep = 0;
    this.answers = {
      budget_tier: null,
      sleep_habit: null,
      items_volume: null
    };

    this.recommendedProducts = [];
    this.selectedProductIds = new Set();

    this.questions = [
      {
        id: 'budget_tier',
        title: 'Q1. 你的入宿全套生活用品預算大概落在哪個區間？',
        subtitle: '這會決定系統為你挑選平價實用或高品質升級的商品。',
        options: [
          { value: 'budget', title: '小資省錢型（NT$ 1,500 以內）', desc: '追求極致性價比、堪用輕便好入手' },
          { value: 'standard', title: '均衡實用型（NT$ 1,500 ~ 3,000）', desc: '注重耐用性與好口碑，大一住宿生首選' },
          { value: 'premium', title: '舒適升級型（NT$ 3,000 以上）', desc: '注重質感與生活品質，像在家一樣舒適' }
        ]
      },
      {
        id: 'sleep_habit',
        title: 'Q2. 你的睡眠習慣與對環境干擾的敏感度如何？',
        subtitle: '宿舍通常為多人共住，作息容易互相影響。',
        options: [
          { value: 'sensitive', title: '淺眠怕吵怕光', desc: '容易被室友打呼或走動聲吵醒，需要隔音遮光防護' },
          { value: 'normal', title: '倒頭就睡型', desc: '適應力強、睡眠品質穩定，基礎寢具即可' }
        ]
      },
      {
        id: 'items_volume',
        title: 'Q3. 你預計帶進宿舍的隨身衣物與雜物量多嗎？',
        subtitle: '這會決定空間收納類別該推薦大容量推車或輕量掛袋。',
        options: [
          { value: 'heavy', title: '雜物極多（衣服、零食、保養品齊全）', desc: '需要極大化利用床底與垂直空間，收納容量第一' },
          { value: 'minimal', title: '極簡夠用（行李精簡、東西不多）', desc: '簡單俐落、好整理，偏好不佔空間的掛袋置物' }
        ]
      }
    ];

    this.initDOMElements();
    this.bindEvents();
    this.renderCurrentQuestion();
  }

  initDOMElements() {
    this.dom = {
      heroSection: document.getElementById('hero-section'),
      quizSection: document.getElementById('quiz-section'),
      quizCard: document.getElementById('quiz-card'),
      stepText: document.getElementById('step-text'),
      progressFill: document.getElementById('progress-fill'),
      questionTitle: document.getElementById('question-title'),
      questionSubtitle: document.getElementById('question-subtitle'),
      optionsContainer: document.getElementById('options-container'),
      errorMsg: document.getElementById('validation-error'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),

      resultsSection: document.getElementById('results-section'),
      summaryBadges: document.getElementById('summary-badges'),
      recommendationGrid: document.getElementById('recommendation-grid'),
      btnRestart: document.getElementById('btn-restart'),
      btnNavRestart: document.getElementById('btn-nav-restart'),

      stickySummaryBar: document.getElementById('sticky-summary-bar'),
      summaryCount: document.getElementById('summary-count'),
      summaryTotal: document.getElementById('summary-total'),
      summaryStatusText: document.getElementById('summary-status-text'),
      btnCopyList: document.getElementById('btn-copy-list'),
      toast: document.getElementById('toast-notification')
    };
  }

  bindEvents() {
    this.dom.btnNext.addEventListener('click', () => this.handleNextStep());
    this.dom.btnPrev.addEventListener('click', () => this.handlePrevStep());
    this.dom.btnRestart.addEventListener('click', () => this.resetQuiz());
    this.dom.btnNavRestart.addEventListener('click', () => this.resetQuiz());
    this.dom.btnCopyList.addEventListener('click', () => this.copyChecklistToClipboard());
  }

  renderCurrentQuestion() {
    const q = this.questions[this.currentStep];
    const totalSteps = this.questions.length;

    // 清除錯誤狀態
    this.clearError();

    // 更新進度條
    this.dom.stepText.textContent = `第 ${this.currentStep + 1} / ${totalSteps} 題`;
    this.dom.progressFill.style.width = `${((this.currentStep + 1) / totalSteps) * 100}%`;

    // 更新標題
    this.dom.questionTitle.textContent = q.title;
    this.dom.questionSubtitle.textContent = q.subtitle;

    // 按鈕文字
    this.dom.btnPrev.disabled = this.currentStep === 0;
    this.dom.btnNext.textContent = this.currentStep === totalSteps - 1 ? '產生成果清單 ✨' : '下一題 →';

    // 渲染選項
    this.dom.optionsContainer.innerHTML = '';
    const currentVal = this.answers[q.id];

    q.options.forEach((opt) => {
      const isSelected = currentVal === opt.value;
      const label = document.createElement('label');
      label.className = `quiz-option-label ${isSelected ? 'selected' : ''}`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = q.id;
      radio.value = opt.value;
      radio.checked = isSelected;

      radio.addEventListener('change', () => {
        this.answers[q.id] = opt.value;
        this.clearError();
        this.dom.optionsContainer.querySelectorAll('.quiz-option-label').forEach((el) => {
          el.classList.remove('selected');
        });
        label.classList.add('selected');
      });

      const textGroup = document.createElement('div');
      textGroup.className = 'option-text-group';
      textGroup.innerHTML = `
        <span class="option-title">${opt.title}</span>
        <span class="option-desc">${opt.desc}</span>
      `;

      label.appendChild(radio);
      label.appendChild(textGroup);
      this.dom.optionsContainer.appendChild(label);
    });
  }

  handleNextStep() {
    const q = this.questions[this.currentStep];
    const selected = this.answers[q.id];

    // 空白/未選防呆驗證
    if (!selected) {
      this.showError('請先選擇此項以獲得最精準的推薦！');
      return;
    }

    if (this.currentStep < this.questions.length - 1) {
      this.currentStep += 1;
      this.renderCurrentQuestion();
    } else {
      this.generateResults();
    }
  }

  handlePrevStep() {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
      this.renderCurrentQuestion();
    }
  }

  showError(msg) {
    this.dom.quizCard.classList.add('has-error');
    this.dom.errorMsg.textContent = msg;
    this.dom.errorMsg.classList.add('visible');
  }

  clearError() {
    this.dom.quizCard.classList.remove('has-error');
    this.dom.errorMsg.classList.remove('visible');
  }

  generateResults() {
    // 依據演算法產生推薦
    this.recommendedProducts = getRecommendations(this.products, this.answers);

    // 預設全選
    this.selectedProductIds = new Set(this.recommendedProducts.map((p) => p.id));

    // 切換畫面
    this.dom.quizSection.style.display = 'none';
    this.dom.heroSection.style.display = 'none';
    this.dom.resultsSection.classList.add('active');
    this.dom.stickySummaryBar.style.display = 'block';

    // 渲染問卷標籤摘要
    this.renderSummaryBadges();

    // 渲染推薦商品卡片
    this.renderCards();

    // 更新底部結算
    this.updateSummary();

    // 平滑捲動至頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderSummaryBadges() {
    const tier = BUDGET_TIER_CONFIG[this.answers.budget_tier]?.label || '預算未指定';
    const sleep = this.answers.sleep_habit === 'sensitive' ? '淺眠怕吵體質' : '入睡適應力佳';
    const volume = this.answers.items_volume === 'heavy' ? '雜物極多需大空間' : '極簡隨身收納';

    this.dom.summaryBadges.innerHTML = `
      <span class="summary-pill">🏷️ ${tier}</span>
      <span class="summary-pill">🌙 ${sleep}</span>
      <span class="summary-pill">📦 ${volume}</span>
    `;
  }

  renderCards() {
    this.dom.recommendationGrid.innerHTML = '';

    this.recommendedProducts.forEach((product) => {
      const isChecked = this.selectedProductIds.has(product.id);
      const card = document.createElement('div');
      card.className = 'product-card';
      card.id = `card-${product.id}`;

      // 使用底色 color
      card.style.backgroundColor = product.color || '#ffffff';

      // 缺貨替代提示徽章
      const substitutionHTML = product.isSubstituted
        ? `<div class="substituted-badge">★ 原首選熱銷缺貨中，已為您自動替換同級推薦款</div>`
        : '';

      card.innerHTML = `
        <div class="card-top-header">
          <span class="category-tag">${CATEGORY_NAMES[product.category] || product.categoryName}</span>
          <input type="checkbox" class="item-checkbox" id="check-${product.id}" ${isChecked ? 'checked' : ''} />
        </div>

        <div class="product-icon-wrapper" style="background-color: rgba(255, 255, 255, 0.75);">
          <span>${product.icon || '🛍️'}</span>
        </div>

        <div class="product-info-body">
          <h3 class="product-title">${product.name}</h3>
          <p class="product-desc">${product.description || ''}</p>
          ${substitutionHTML}
          <div class="reason-badge">💡 ${product.recommendationReason}</div>
        </div>

        <div class="card-footer">
          <span class="product-price">NT$ ${product.price.toLocaleString()}</span>
          <span class="stock-tag">現貨庫存: ${product.stock} 件</span>
        </div>
      `;

      // 綁定勾選切換
      const checkbox = card.querySelector('.item-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedProductIds.add(product.id);
        } else {
          this.selectedProductIds.delete(product.id);
        }
        this.updateSummary();
      });

      this.dom.recommendationGrid.appendChild(card);
    });
  }

  updateSummary() {
    const summary = calculateSummary(
      this.recommendedProducts,
      this.selectedProductIds,
      this.answers.budget_tier
    );

    this.dom.summaryCount.textContent = `已選 ${summary.count} 件商品`;
    this.dom.summaryTotal.textContent = `NT$ ${summary.totalPrice.toLocaleString()}`;
    this.dom.summaryStatusText.textContent = summary.statusText;
    this.dom.summaryStatusText.className = `summary-status-text ${summary.statusClass}`;

    // 若 0 件商品，停用複製按鈕
    this.dom.btnCopyList.disabled = summary.count === 0;
  }

  copyChecklistToClipboard() {
    const summary = calculateSummary(
      this.recommendedProducts,
      this.selectedProductIds,
      this.answers.budget_tier
    );

    if (summary.count === 0) return;

    const checklistText = formatChecklistText(summary.selectedItems, summary.totalPrice);

    navigator.clipboard
      .writeText(checklistText)
      .then(() => {
        this.showToast('✅ 採購清單已成功複製至剪貼簿！');
      })
      .catch((err) => {
        console.error('複製失敗:', err);
        this.showToast('⚠️ 複製失敗，請手動選取文字');
      });
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add('show');
    setTimeout(() => {
      this.dom.toast.classList.remove('show');
    }, 2800);
  }

  resetQuiz() {
    this.currentStep = 0;
    this.answers = {
      budget_tier: null,
      sleep_habit: null,
      items_volume: null
    };
    this.selectedProductIds.clear();

    this.dom.resultsSection.classList.remove('active');
    this.dom.heroSection.style.display = 'block';
    this.dom.quizSection.style.display = 'block';
    this.dom.stickySummaryBar.style.display = 'none';

    this.renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
