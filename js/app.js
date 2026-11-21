/**
 * ChicSort - Application Controller
 * Handles Navigation, Bilingual Rendering, Wardrobe Management,
 * Upload Simulation, AI Stylist, Anti-Repeat Calendar, and Admin Management.
 */

class ChicSortApp {
  constructor() {
    this.data = window.ChicSortData;
    this.lang = localStorage.getItem('chicsort_lang') || 'vi';
    this.data.lang = this.lang;
    
    // Load persisted wardrobe items or fallback to default 12 items
    const savedItems = localStorage.getItem('chicsort_items');
    this.items = savedItems ? JSON.parse(savedItems) : JSON.parse(JSON.stringify(this.data.defaultItems));
    
    // Load logged outfits
    const savedLogs = localStorage.getItem('chicsort_wear_logs');
    this.wearLogs = savedLogs ? JSON.parse(savedLogs) : [
      {
        id: 'log_1',
        date: '2026-11-18',
        outfitName: 'Power Smart Casual Duo',
        occasion: 'work',
        items: ['Classic Camel Blazer', 'Crisp White Poplin Shirt', 'Pleated Trousers', 'Loafers']
      },
      {
        id: 'log_2',
        date: '2026-11-15',
        outfitName: 'Effortless Campus Denim',
        occasion: 'campus',
        items: ['Classic Denim Jacket', 'Essential Black Ribbed Top', 'Straight Jeans', 'White Sneakers']
      }
    ];

    // Current filter states
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.currentWeather = 'sunny';
    this.currentOccasion = 'work';
    this.currentOutfits = [];
    this.isAdminAuthenticated = false;

    // User profile and style archetype state
    const savedUser = localStorage.getItem('chicsort_user');
    this.currentUser = savedUser ? JSON.parse(savedUser) : null;
    
    // Support multi-styles array
    if (this.currentUser && Array.isArray(this.currentUser.styles) && this.currentUser.styles.length > 0) {
      this.currentStyles = [...this.currentUser.styles];
    } else if (this.currentUser && this.currentUser.style) {
      this.currentStyles = [this.currentUser.style];
    } else {
      this.currentStyles = ['office'];
    }
    this.currentStyle = this.currentStyles[0] || 'office';
    this.pendingAuthUser = null;
    this.selectedOnboardingStyles = [...this.currentStyles];

    // Theme state
    this.theme = localStorage.getItem('chicsort_theme') || 'light';

    // Temporary upload state
    this.tempUploadedImage = null;

    // Initialize
    this.init();
  }

  init() {
    // Apply theme
    this.applyTheme(this.theme);

    // Initialize User Auth & Style Onboarding
    this.initAuth();

    // Check initial hash route (e.g. #admin, #wardrobe, #stylist)
    const hash = window.location.hash.replace('#', '') || 'pitch';
    this.switchTab(hash);

    // Event listeners
    this.bindEvents();

    // Generate initial outfits
    this.generateOutfits();

    // Render initial language texts & ticker
    this.setLanguage(this.lang);

    // Update user auth UI
    this.updateUserAuthUI();

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  bindEvents() {
    // Hash change handler for routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'pitch';
      this.switchTab(hash, false);
    });

    // Language toggle buttons
    const langViBtn = document.getElementById('btn-lang-vi');
    const langEnBtn = document.getElementById('btn-lang-en');
    if (langViBtn && langEnBtn) {
      langViBtn.addEventListener('click', () => this.setLanguage('vi'));
      langEnBtn.addEventListener('click', () => this.setLanguage('en'));
    }

    // Navigation links
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-nav-tab');
        this.switchTab(tab);
      });
    });

    // Wardrobe Category Filters
    document.querySelectorAll('[data-category-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-category-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.getAttribute('data-category-filter');
        this.renderWardrobe();
      });
    });

    // Wardrobe Search Input
    const searchInput = document.getElementById('wardrobe-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderWardrobe();
      });
    }

    // Upload Modal Triggers
    const btnOpenUpload = document.getElementById('btn-open-upload');
    const btnCloseUpload = document.getElementById('btn-close-upload');
    const modalUpload = document.getElementById('modal-upload');
    const fileInput = document.getElementById('file-upload-input');
    const dropzone = document.getElementById('upload-dropzone');

    if (btnOpenUpload && modalUpload) {
      btnOpenUpload.addEventListener('click', () => this.openUploadModal());
    }
    if (btnCloseUpload && modalUpload) {
      btnCloseUpload.addEventListener('click', () => this.closeUploadModal());
    }

    // File input change
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processUploadedFile(e.target.files[0]);
        }
      });
    }

    // Drag and Drop
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-blue-600', 'bg-blue-50/50');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-blue-600', 'bg-blue-50/50');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-blue-600', 'bg-blue-50/50');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processUploadedFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Save garment from modal form
    const btnSaveItem = document.getElementById('btn-save-uploaded-item');
    if (btnSaveItem) {
      btnSaveItem.addEventListener('click', () => this.saveUploadedItem());
    }

    // Reset Wardrobe Button
    const btnResetData = document.getElementById('btn-reset-wardrobe');
    if (btnResetData) {
      btnResetData.addEventListener('click', () => {
        if (confirm(this.lang === 'vi' ? 'Bạn có muốn khôi phục lại 12 món đồ mẫu mặc định?' : 'Reset wardrobe to default 12 curated items?')) {
          this.items = JSON.parse(JSON.stringify(this.data.defaultItems));
          localStorage.setItem('chicsort_items', JSON.stringify(this.items));
          this.renderWardrobe();
          this.showToast(this.lang === 'vi' ? 'Đã khôi phục dữ liệu tủ đồ mẫu!' : 'Wardrobe restored to default!');
        }
      });
    }

    // AI Stylist Controls
    document.querySelectorAll('[data-weather-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-weather-choice]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentWeather = btn.getAttribute('data-weather-choice');
        this.generateOutfits();
      });
    });

    document.querySelectorAll('[data-occasion-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-occasion-choice]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentOccasion = btn.getAttribute('data-occasion-choice');
        this.generateOutfits();
      });
    });

    const btnGenerate = document.getElementById('btn-generate-outfits');
    const btnShuffle = document.getElementById('btn-shuffle-outfits');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => this.generateOutfits(true));
    }
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => this.generateOutfits(true));
    }

    // Admin login form
    const adminForm = document.getElementById('admin-login-form');
    const btnFillDemo = document.getElementById('btn-fill-admin-demo');
    if (adminForm) {
      adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const pass = document.getElementById('admin-password').value.trim();
        if (email === 'admin@chicsort.com' && pass === 'admin123') {
          this.isAdminAuthenticated = true;
          this.renderAdminDashboard();
        } else {
          const errEl = document.getElementById('admin-login-error');
          if (errEl) errEl.classList.remove('hidden');
        }
      });
    }
    if (btnFillDemo) {
      btnFillDemo.addEventListener('click', () => {
        document.getElementById('admin-email').value = 'admin@chicsort.com';
        document.getElementById('admin-password').value = 'admin123';
      });
    }

    const btnExitAdmin = document.getElementById('btn-exit-admin');
    if (btnExitAdmin) {
      btnExitAdmin.addEventListener('click', () => {
        this.isAdminAuthenticated = false;
        this.switchTab('pitch');
      });
    }

    // Theme Toggle Button
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('chicsort_theme', this.theme);
    this.applyTheme(this.theme);
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  setLanguage(lang) {
    this.lang = lang;
    this.data.lang = lang;
    localStorage.setItem('chicsort_lang', lang);

    // Update buttons UI with elegant rounded classes
    const langViBtn = document.getElementById('btn-lang-vi');
    const langEnBtn = document.getElementById('btn-lang-en');
    if (langViBtn && langEnBtn) {
      if (lang === 'vi') {
        langViBtn.className = 'lang-btn active';
        langEnBtn.className = 'lang-btn';
      } else {
        langEnBtn.className = 'lang-btn active';
        langViBtn.className = 'lang-btn';
      }
    }

    this.applyLanguage();
    this.renderTicker();
    this.updateUserAuthUI();
    this.renderWardrobe();
    this.generateOutfits();
    this.renderCalendar();
    if (this.isAdminAuthenticated) {
      this.renderAdminDashboard();
    }
  }

  renderTicker() {
    const track = document.querySelector('.ticker-track');
    if (!track) return;
    const d = this.data.dict[this.lang];
    const items = [d.tickerItem1, d.tickerItem2, d.tickerItem3, d.tickerItem4, d.tickerItem5];
    const repeated = [...items, ...items];
    track.innerHTML = repeated.map(item => `
      <span>${item}</span>
      <span class="text-[#A8C4EC] font-bold">·</span>
    `).join('');
  }

  applyLanguage() {
    const d = this.data.dict[this.lang];
    if (!d) return;

    // Replace all elements with [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (d[key]) {
        el.textContent = d[key];
      }
    });

    // Replace placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (d[key]) {
        el.setAttribute('placeholder', d[key]);
      }
    });

    // Update Wardrobe Filter Pills
    document.querySelectorAll('[data-category-filter]').forEach(btn => {
      const cat = btn.getAttribute('data-category-filter');
      const count = cat === 'all' ? this.items.length : this.items.filter(i => i.category === cat).length;
      const nameMap = {
        all: d.filterAll,
        tops: d.filterTops,
        bottoms: d.filterBottoms,
        outerwear: d.filterOuterwear,
        shoes: d.filterShoes,
        accessories: d.filterAccessories
      };
      btn.textContent = `${nameMap[cat] || cat} (${count})`;
    });

    // Update Weather Buttons text
    const weatherBtns = {
      sunny: d.weatherSunny,
      rainy: d.weatherRainy,
      cool: d.weatherCool,
      cold: d.weatherCold
    };
    document.querySelectorAll('[data-weather-choice]').forEach(btn => {
      const choice = btn.getAttribute('data-weather-choice');
      const span = btn.querySelector('span');
      if (span && weatherBtns[choice]) {
        span.textContent = weatherBtns[choice];
      }
    });

    // Update Occasion Buttons text
    const occasionBtns = {
      work: d.occasionWork,
      campus: d.occasionCampus,
      weekend: d.occasionWeekend
    };
    document.querySelectorAll('[data-occasion-choice]').forEach(btn => {
      const choice = btn.getAttribute('data-occasion-choice');
      const span = btn.querySelector('span');
      if (span && occasionBtns[choice]) {
        span.textContent = occasionBtns[choice];
      }
    });
  }

  switchTab(tabId, updateHash = true) {
    if (updateHash) {
      window.location.hash = tabId;
    }

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    // Show target view panel
    const targetPanel = document.getElementById(`view-${tabId}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    } else {
      // Default fallback
      const defaultPanel = document.getElementById('view-pitch');
      if (defaultPanel) defaultPanel.classList.remove('hidden');
      tabId = 'pitch';
    }

    // Update active nav styling (Odd Ritual editorial nav)
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      const t = btn.getAttribute('data-nav-tab');
      if (t === tabId) {
        btn.classList.add('tab-active');
      } else {
        btn.classList.remove('tab-active');
      }
    });

    // Re-render specific views on arrival
    if (tabId === 'wardrobe') {
      this.renderWardrobe();
      setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 100);
    } else if (tabId === 'stylist') {
      this.generateOutfits();
    } else if (tabId === 'calendar') {
      this.renderCalendar();
    } else if (tabId === 'admin') {
      if (this.isAdminAuthenticated) {
        this.renderAdminDashboard();
      } else {
        const loginCard = document.getElementById('admin-login-card');
        const dashboardView = document.getElementById('admin-dashboard-view');
        if (loginCard) loginCard.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderWardrobe() {
    const grid = document.getElementById('wardrobe-grid');
    if (!grid) return;

    const isVi = this.lang === 'vi';
    const d = this.data.dict[this.lang];

    // Filter items
    let filtered = this.items.filter(item => {
      const matchCat = this.currentCategory === 'all' || item.category === this.currentCategory;
      const matchQuery = !this.searchQuery || 
        (item.name_en && item.name_en.toLowerCase().includes(this.searchQuery)) ||
        (item.name_vi && item.name_vi.toLowerCase().includes(this.searchQuery)) ||
        (item.color && item.color.toLowerCase().includes(this.searchQuery)) ||
        (item.style && item.style.toLowerCase().includes(this.searchQuery));
      return matchCat && matchQuery;
    });

    const countEl = document.getElementById('wardrobe-total-count');
    if (countEl) {
      countEl.textContent = `${filtered.length} ${isVi ? 'món đồ' : 'items'}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <i data-lucide="package-open" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
          <p class="text-slate-500 font-medium font-heading">${isVi ? 'Không tìm thấy trang phục phù hợp.' : 'No garments found matching filter.'}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map((item, index) => {
      const name = isVi ? item.name_vi : item.name_en;
      const catName = isVi ? item.category_name_vi : item.category_name_en;
      const color = isVi ? (item.color_vi || item.color) : item.color;
      const style = isVi ? (item.style_vi || item.style) : item.style;
      const wornText = d.cardWornCount.replace('{n}', item.timesWorn);
      const lastWornText = d.cardLastWorn.replace('{date}', item.lastWorn || '-');
      const shortName = name.length > 20 ? name.substring(0, 20) + '...' : name;

      const fabricSpecs = [
        { label: isVi ? 'Số lần diện' : 'Times Worn', val: isVi ? `${item.timesWorn} lần` : `${item.timesWorn} times` },
        { label: isVi ? 'Gam màu' : 'Color Palette', val: color.split('/')[0].trim() },
        { label: isVi ? 'Mùa phù hợp' : 'Season', val: item.season || 'Bốn mùa' },
        { label: isVi ? 'Phong cách' : 'Silhouette', val: style.split('/')[0].trim() },
      ];
      const specRows = fabricSpecs.map(s => `
        <div class="popover-spec-row">
          <span class="popover-spec-label">${s.label}</span>
          <span class="font-semibold text-white">${s.val}</span>
        </div>
      `).join('');

      const wornLabel = isVi ? `Đã diện ${item.timesWorn} lần` : `Worn ${item.timesWorn} times`;

      return `
        <div class="garment-card" data-item-id="${item.id}">
          <div class="garment-media-frame">
            <img src="${item.image}" alt="${name}" class="garment-media-img" loading="lazy" />
            
            <!-- Soft Category Tag -->
            <span class="garment-category-stamp">${catName}</span>
            
            <!-- Hotspot Details Button -->
            <button class="hotspot-trigger" aria-label="Chi tiết" title="${isVi ? 'Xem chi tiết trang phục' : 'View garment details'}">+</button>
            
            <!-- Soft Fashion Popover -->
            <div class="hotspot-popover">
              <div class="font-bold text-[#A8C4EC] pb-1.5 mb-1.5 border-b border-white/10 flex justify-between items-center text-sm">
                <span>${isVi ? 'Chi tiết trang phục' : 'Garment Details'}</span>
                <span class="text-white/50 text-xs">#0${index + 1}</span>
              </div>
              ${specRows}
            </div>

            <!-- Gentle Floating Pill on Hover -->
            <div class="card-floating-pill">
              ${shortName} · ${wornLabel}
            </div>
          </div>

          <div class="garment-meta-block">
            <h4 class="garment-item-title" title="${name}">${name}</h4>
            <div class="garment-item-desc">
              <span class="text-ink font-medium">${color.split('/')[0].trim()}</span>
              <span class="text-cobalt font-semibold">${wornText}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  toggleFavorite(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      localStorage.setItem('chicsort_items', JSON.stringify(this.items));
      this.renderWardrobe();
    }
  }

  openUploadModal() {
    const modal = document.getElementById('modal-upload');
    const formSection = document.getElementById('upload-form-section');
    const scanSection = document.getElementById('upload-scan-preview');
    const dropzone = document.getElementById('upload-dropzone');
    
    if (modal) modal.classList.remove('hidden');
    if (formSection) formSection.classList.add('hidden');
    if (scanSection) scanSection.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
    
    document.getElementById('upload-item-name').value = '';
    this.tempUploadedImage = null;
  }

  closeUploadModal() {
    const modal = document.getElementById('modal-upload');
    if (modal) modal.classList.add('hidden');
  }

  processUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.tempUploadedImage = e.target.result;

      // Show scan simulation
      const dropzone = document.getElementById('upload-dropzone');
      const scanSection = document.getElementById('upload-scan-preview');
      const scanImg = document.getElementById('scan-target-img');
      const scanStatus = document.getElementById('scan-status-text');

      if (dropzone) dropzone.classList.add('hidden');
      if (scanSection) scanSection.classList.remove('hidden');
      if (scanImg) scanImg.src = this.tempUploadedImage;

      // Simulated AI Scanning delay (1.2 seconds)
      setTimeout(() => {
        // AI detection simulation
        const detectedCategory = this.guessCategoryFromFileName(file.name);
        const detectedColor = this.guessColor();
        const detectedStyle = this.guessStyle();

        // Fill form fields
        document.getElementById('upload-item-name').value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'New Garment';
        document.getElementById('upload-item-category').value = detectedCategory;
        document.getElementById('upload-item-color').value = detectedColor;
        document.getElementById('upload-item-style').value = detectedStyle;

        // Show edit form section
        const formSection = document.getElementById('upload-form-section');
        if (formSection) formSection.classList.remove('hidden');
        if (scanStatus) {
          scanStatus.innerHTML = `
            <span class="inline-flex items-center text-emerald-600 font-bold gap-1 text-sm">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              ${this.lang === 'vi' ? 'Đã bóc tách viền vải & nhận diện thành công!' : 'Garment silhouette isolated successfully!'}
            </span>
          `;
          if (window.lucide) window.lucide.createIcons();
        }
      }, 1200);
    };
    reader.readAsDataURL(file);
  }

  guessCategoryFromFileName(name) {
    const n = name.toLowerCase();
    if (n.includes('jean') || n.includes('pant') || n.includes('skirt') || n.includes('quan') || n.includes('vay')) return 'bottoms';
    if (n.includes('jacket') || n.includes('blazer') || n.includes('coat') || n.includes('khoac')) return 'outerwear';
    if (n.includes('shoe') || n.includes('sneaker') || n.includes('loafer') || n.includes('giay')) return 'shoes';
    if (n.includes('bag') || n.includes('scarf') || n.includes('tui') || n.includes('khan')) return 'accessories';
    return 'tops';
  }

  guessColor() {
    const colors_vi = ['Xanh Denim', 'Trắng ngà', 'Đen Onyx', 'Nâu Be', 'Xám ghi', 'Pastel'];
    const colors_en = ['Denim Blue', 'Crisp White', 'Onyx Black', 'Warm Beige', 'Slate Gray', 'Pastel'];
    const list = this.lang === 'vi' ? colors_vi : colors_en;
    return list[Math.floor(Math.random() * list.length)];
  }

  guessStyle() {
    const styles_vi = ['Smart Casual', 'Office Thanh lịch', 'Streetwear Trẻ trung', 'Minimalism'];
    const styles_en = ['Smart Casual', 'Office Professional', 'Youthful Streetwear', 'Minimalism'];
    const list = this.lang === 'vi' ? styles_vi : styles_en;
    return list[Math.floor(Math.random() * list.length)];
  }

  saveUploadedItem() {
    const nameVal = document.getElementById('upload-item-name').value.trim();
    const catVal = document.getElementById('upload-item-category').value;
    const colorVal = document.getElementById('upload-item-color').value.trim();
    const styleVal = document.getElementById('upload-item-style').value.trim();

    if (!nameVal) {
      alert(this.lang === 'vi' ? 'Vui lòng nhập tên món đồ.' : 'Please enter a garment name.');
      return;
    }

    const catNameMap = {
      tops: { en: 'Tops', vi: 'Áo' },
      bottoms: { en: 'Bottoms', vi: 'Quần & Váy' },
      outerwear: { en: 'Outerwear', vi: 'Áo khoác' },
      shoes: { en: 'Footwear', vi: 'Giày dép' },
      accessories: { en: 'Accessories', vi: 'Phụ kiện' }
    };

    const newItem = {
      id: 'item_' + Date.now(),
      name_en: nameVal,
      name_vi: nameVal,
      category: catVal,
      category_name_en: catNameMap[catVal].en,
      category_name_vi: catNameMap[catVal].vi,
      color: colorVal,
      color_vi: colorVal,
      style: styleVal,
      style_vi: styleVal,
      image: this.tempUploadedImage,
      timesWorn: 0,
      lastWorn: 'Chưa mặc',
      favorite: false
    };

    // Prepend to wardrobe
    this.items.unshift(newItem);
    localStorage.setItem('chicsort_items', JSON.stringify(this.items));

    this.closeUploadModal();
    this.renderWardrobe();
    this.showToast(this.lang === 'vi' ? `Đã thêm "${nameVal}" vào tủ đồ số!` : `"${nameVal}" added to your closet!`);
  }

  generateOutfits(showLoading = false) {
    const container = document.getElementById('stylist-outfits-container');
    if (!container) return;

    if (showLoading) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-cobalt border-t-transparent mb-4"></div>
          <p class="text-slate-600 font-heading font-semibold">${this.lang === 'vi' ? 'AI đang phân tích hòa sắc tủ đồ...' : 'AI is analyzing your wardrobe color harmony...'}</p>
        </div>
      `;
    }

    setTimeout(() => {
      this.currentOutfits = this.data.getOutfits(this.currentWeather, this.currentOccasion, this.currentStyles);
      const isVi = this.lang === 'vi';
      const d = this.data.dict[this.lang];

      // Sync active state on stylist style pills (multi-active support)
      document.querySelectorAll('#stylist-style-pills [data-style-pill], #stylist-style-pills [data-style-choice]').forEach(btn => {
        const s = btn.getAttribute('data-style-pill') || btn.getAttribute('data-style-choice');
        if (this.currentStyles.includes(s)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update matched style note in console header
      const noteEl = document.getElementById('user-matched-style-note');
      if (noteEl) {
        const names = this.currentStyles.map(s => this.getStyleDisplayName(s)).join(', ');
        if (this.currentUser) {
          noteEl.textContent = isVi 
            ? `Đang phối hợp ${this.currentStyles.length} gu: ${names}`
            : `Blending ${this.currentStyles.length} styles: ${names}`;
        } else {
          noteEl.textContent = isVi
            ? `Đang xem theo ${this.currentStyles.length} gu: ${names}`
            : `Viewing ${this.currentStyles.length} styles: ${names}`;
        }
      }

      container.innerHTML = this.currentOutfits.map((outfit, index) => {
        // Resolve items
        const top = this.items.find(i => i.id === outfit.topId) || this.items[2];
        const bottom = this.items.find(i => i.id === outfit.bottomId) || this.items[6];
        const outerwear = outfit.outerwearId ? this.items.find(i => i.id === outfit.outerwearId) : null;
        const shoes = this.items.find(i => i.id === outfit.shoesId) || this.items[9];
        const accessory = outfit.accessoryId ? this.items.find(i => i.id === outfit.accessoryId) : null;
        const accent = outerwear || accessory;

        return `
          <div class="stylist-outfit-card">
            <!-- Header Spec -->
            <div>
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 text-sm">
                <span class="text-cobalt font-bold">${isVi ? `Gợi ý phối #${index + 1}` : `Look #${index + 1}`} · ${outfit.vibeTag}</span>
                <span class="font-display font-black text-ink text-lg">${outfit.score}</span>
              </div>
              <h3 class="font-display font-black text-lg sm:text-xl text-ink uppercase mb-2 leading-snug">${outfit.name}</h3>
              <p class="text-sm text-ink-secondary leading-relaxed mb-4">${outfit.description}</p>

              <!-- Components Strip -->
              <div class="outfit-thumbnails-strip mb-4 rounded-xl">
                <div class="outfit-thumb-cell rounded-lg overflow-hidden" title="${isVi ? top.name_vi : top.name_en}">
                  <img src="${top.image}" class="outfit-thumb-img" alt="" />
                </div>
                <div class="outfit-thumb-cell rounded-lg overflow-hidden" title="${isVi ? bottom.name_vi : bottom.name_en}">
                  <img src="${bottom.image}" class="outfit-thumb-img" alt="" />
                </div>
                <div class="outfit-thumb-cell rounded-lg overflow-hidden" title="${isVi ? shoes.name_vi : shoes.name_en}">
                  <img src="${shoes.image}" class="outfit-thumb-img" alt="" />
                </div>
                <div class="outfit-thumb-cell rounded-lg overflow-hidden" title="${accent ? (isVi ? accent.name_vi : accent.name_en) : 'Accent'}">
                  <img src="${accent ? accent.image : top.image}" class="outfit-thumb-img" alt="" />
                </div>
              </div>

              <!-- Color Theory Ledger -->
              <div class="p-3.5 bg-paper border border-slate-100 rounded-xl text-sm text-ink-secondary">
                <span class="text-cobalt font-bold block mb-1">${isVi ? 'Hài hòa màu sắc' : 'Color Palette'}</span>
                <span>${outfit.harmony}</span>
              </div>
            </div>

            <!-- Action CTA -->
            <button onclick="window.app.logOutfitToday('${outfit.id}')" class="btn-editorial-primary w-full text-sm py-3">
              <span>${d.btnWearToday}</span>
            </button>
          </div>
        `;
      }).join('');

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, showLoading ? 400 : 0);
  }

  logOutfitToday(outfitId) {
    const outfit = this.currentOutfits.find(o => o.id === outfitId);
    if (!outfit) return;

    const newLog = {
      id: 'log_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      outfitName: outfit.name,
      occasion: this.currentOccasion,
      items: [outfit.vibeTag, outfit.harmony]
    };

    this.wearLogs.unshift(newLog);
    localStorage.setItem('chicsort_wear_logs', JSON.stringify(this.wearLogs));

    const d = this.data.dict[this.lang];
    this.showToast(d.loggedToast);
  }

  renderCalendar() {
    const list = document.getElementById('calendar-logs-list');
    if (!list) return;

    const isVi = this.lang === 'vi';
    if (this.wearLogs.length === 0) {
      list.innerHTML = `<p class="text-sm text-slate-400 py-6 text-center">${isVi ? 'Chưa có lịch sử mặc đồ nào được ghi nhận.' : 'No wear history recorded yet.'}</p>`;
      return;
    }

    const occMap = {
      work: isVi ? 'Đi làm công sở' : 'Office',
      campus: isVi ? 'Đi học giảng đường' : 'Campus',
      weekend: isVi ? 'Cà phê hẹn hò' : 'Weekend'
    };

    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    list.innerHTML = this.wearLogs.map(log => {
      const parts = (log.date || '').split('-');
      const monthNum = parseInt(parts[1] || '1', 10);
      const dayNum = parts[2] || '01';
      const monthLabel = isVi ? `Th ${monthNum}` : (monthNamesEn[monthNum - 1] || `M${monthNum}`);

      return `
        <div class="p-4 sm:p-5 flex items-center justify-between gap-4 text-sm hover:bg-slate-50/50 dark:hover:bg-white/5 transition">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl border border-slate-200 dark:border-white/10 bg-paper dark:bg-white/5 flex flex-col items-center justify-center shrink-0 shadow-xs">
              <span class="text-[11px] font-bold uppercase tracking-wider text-cobalt leading-none mb-1">${monthLabel}</span>
              <span class="text-xl font-display font-black text-ink leading-none">${dayNum}</span>
            </div>
            <div>
              <h4 class="font-display font-bold text-base text-ink mb-1">${log.outfitName}</h4>
              <p class="text-sm text-ink-muted">${log.items ? log.items.join(' · ') : (isVi ? 'Phối đồ hoàn chỉnh' : 'Full Outfit')}</p>
            </div>
          </div>
          <span class="soft-pill text-xs font-semibold shrink-0">${occMap[log.occasion] || log.occasion}</span>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderAdminDashboard() {
    const loginCard = document.getElementById('admin-login-card');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const tableBody = document.getElementById('admin-users-table');

    if (loginCard) loginCard.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');

    if (!tableBody) return;
    const isVi = this.lang === 'vi';

    tableBody.innerHTML = this.data.sampleAdminUsers.map(user => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
        <td class="py-3.5 px-4 text-sm font-medium text-slate-500">${user.id}</td>
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            <img src="${user.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200" />
            <div>
              <p class="font-bold text-slate-900 text-sm">${user.name}</p>
              <p class="text-xs text-slate-400">${user.email}</p>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 text-sm text-slate-600">${isVi ? user.persona_vi : user.persona}</td>
        <td class="py-3.5 px-4">
          <span class="soft-pill text-xs font-semibold ${user.plan.includes('Premium') || user.plan.includes('Pro') ? 'bg-blue-50 text-cobalt border-blue-200' : 'bg-slate-100 text-slate-600'}">
            ${user.plan}
          </span>
        </td>
        <td class="py-3.5 px-4 text-sm font-semibold text-slate-700 text-center">${user.itemsCount}</td>
        <td class="py-3.5 px-4 text-sm font-semibold text-cobalt text-center">${user.outfitsGenerated}</td>
        <td class="py-3.5 px-4">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${isVi ? 'Đang hoạt động' : 'Active'}
          </span>
        </td>
        <td class="py-3.5 px-4 text-right">
          <button onclick="alert('User ID: ${user.id} · Spend: ${user.spend}')" class="text-sm font-semibold text-cobalt hover:underline p-1">
            ${isVi ? 'Chi tiết' : 'Details'}
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'editorial-toast';
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-cobalt"></span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  getStyleDisplayName(styleId) {
    const isVi = this.lang === 'vi';
    const dict = {
      office: isVi ? 'Công sở Thanh lịch' : 'Office Chic',
      minimal: isVi ? 'Tối giản Hiện đại' : 'Clean Minimal',
      streetwear: isVi ? 'Trẻ trung Phố thị' : 'Youthful Streetwear',
      soft: isVi ? 'Dịu dàng Tinh tế' : 'Soft Elegance',
      athleisure: isVi ? 'Thể thao Thường nhật' : 'Athleisure',
      vintage: isVi ? 'Cổ điển Hoài niệm' : 'Retro Vintage'
    };
    return dict[styleId] || styleId;
  }

  getShortStyleDisplayName(styleId) {
    const isVi = this.lang === 'vi';
    const dict = {
      office: isVi ? '👔 Công sở' : '👔 Office',
      minimal: isVi ? '🌿 Tối giản' : '🌿 Minimal',
      streetwear: isVi ? '🛹 Phố thị' : '🛹 Street',
      soft: isVi ? '🌸 Dịu dàng' : '🌸 Soft',
      athleisure: isVi ? '👟 Thể thao' : '👟 Sport',
      vintage: isVi ? '📻 Cổ điển' : '📻 Vintage'
    };
    return dict[styleId] || styleId;
  }

  toggleOnboardingCard(styleId) {
    const idx = this.selectedOnboardingStyles.indexOf(styleId);
    if (idx > -1) {
      if (this.selectedOnboardingStyles.length > 1) {
        this.selectedOnboardingStyles.splice(idx, 1);
      } else {
        this.showToast(this.lang === 'vi' ? 'Bạn cần giữ ít nhất 1 phong cách yêu thích!' : 'Please keep at least 1 preferred style!');
        return;
      }
    } else {
      this.selectedOnboardingStyles.push(styleId);
    }
    this.renderOnboardingCards();
  }

  renderOnboardingCards() {
    document.querySelectorAll('#onboarding-styles-grid .style-select-card').forEach(card => {
      const s = card.getAttribute('data-style-id');
      const checkMark = card.querySelector('.style-check-mark');
      if (this.selectedOnboardingStyles.includes(s)) {
        card.classList.add('active');
        if (checkMark) checkMark.classList.remove('hidden');
      } else {
        card.classList.remove('active');
        if (checkMark) checkMark.classList.add('hidden');
      }
    });

    const countEl = document.getElementById('onboarding-selected-count');
    if (countEl) {
      countEl.textContent = this.selectedOnboardingStyles.length;
    }
  }

  updateUserAuthUI() {
    const isVi = this.lang === 'vi';
    const headerAuthBtn = document.getElementById('btn-header-auth');
    const headerUserProfile = document.getElementById('header-user-profile');
    const mobileLoggedOut = document.getElementById('mobile-auth-logged-out');
    const mobileLoggedIn = document.getElementById('mobile-auth-logged-in');

    // Build badge text for header
    let badgeText = '';
    if (this.currentStyles.length === 1) {
      badgeText = this.getStyleDisplayName(this.currentStyles[0]);
    } else if (this.currentStyles.length === 2) {
      badgeText = `${this.getShortStyleDisplayName(this.currentStyles[0])} + ${this.getShortStyleDisplayName(this.currentStyles[1])}`;
    } else {
      badgeText = isVi ? `${this.currentStyles.length} Gu phong cách` : `${this.currentStyles.length} Styles`;
    }

    if (this.currentUser) {
      if (headerAuthBtn) headerAuthBtn.classList.add('hidden');
      if (headerUserProfile) headerUserProfile.classList.remove('hidden');

      const avatarEl = document.getElementById('header-user-avatar');
      const nameEl = document.getElementById('header-user-name');
      const badgeEl = document.getElementById('header-user-style-badge');
      const dropName = document.getElementById('dropdown-user-name');
      const dropEmail = document.getElementById('dropdown-user-email');
      const dropStylesContainer = document.getElementById('dropdown-user-styles-container');

      const avatarUrl = this.currentUser.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80';
      if (avatarEl) avatarEl.src = avatarUrl;
      if (nameEl) {
        const parts = (this.currentUser.name || '').trim().split(' ');
        nameEl.textContent = parts[parts.length - 1] || this.currentUser.name;
      }
      if (badgeEl) badgeEl.textContent = badgeText;
      if (dropName) dropName.textContent = this.currentUser.name;
      if (dropEmail) dropEmail.textContent = this.currentUser.email;

      if (dropStylesContainer) {
        dropStylesContainer.innerHTML = this.currentStyles.map(s => `
          <span class="fashion-badge text-xs py-0.5 px-2.5">${this.getShortStyleDisplayName(s)}</span>
        `).join('');
      }

      // Mobile drawer
      if (mobileLoggedOut) mobileLoggedOut.classList.add('hidden');
      if (mobileLoggedIn) mobileLoggedIn.classList.remove('hidden');
      const mobAvatar = document.getElementById('mobile-user-avatar');
      const mobName = document.getElementById('mobile-user-name');
      const mobStyle = document.getElementById('mobile-user-style');
      if (mobAvatar) mobAvatar.src = avatarUrl;
      if (mobName) mobName.textContent = this.currentUser.name;
      if (mobStyle) mobStyle.textContent = `${badgeText} (${this.currentUser.plan || 'Free'})`;
    } else {
      if (headerAuthBtn) headerAuthBtn.classList.remove('hidden');
      if (headerUserProfile) headerUserProfile.classList.add('hidden');
      const userDropdown = document.getElementById('user-profile-dropdown');
      if (userDropdown) userDropdown.classList.add('hidden');

      // Mobile drawer
      if (mobileLoggedOut) mobileLoggedOut.classList.remove('hidden');
      if (mobileLoggedIn) mobileLoggedIn.classList.add('hidden');
    }

    // Update style pills in AI Stylist console
    document.querySelectorAll('#stylist-style-pills [data-style-pill], #stylist-style-pills [data-style-choice]').forEach(btn => {
      const s = btn.getAttribute('data-style-pill') || btn.getAttribute('data-style-choice');
      if (this.currentStyles.includes(s)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const noteEl = document.getElementById('user-matched-style-note');
    if (noteEl) {
      const names = this.currentStyles.map(s => this.getStyleDisplayName(s)).join(', ');
      if (this.currentUser) {
        noteEl.textContent = isVi 
          ? `Đang phối hợp ${this.currentStyles.length} gu: ${names}`
          : `Blending ${this.currentStyles.length} styles: ${names}`;
      } else {
        noteEl.textContent = isVi
          ? `Đang xem theo ${this.currentStyles.length} gu: ${names}`
          : `Viewing ${this.currentStyles.length} styles: ${names}`;
      }
    }
  }

  initAuth() {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    const step1 = document.getElementById('auth-step-1');
    const step2 = document.getElementById('auth-step-2');
    const tabSignIn = document.getElementById('tab-auth-signin');
    const tabSignUp = document.getElementById('tab-auth-signup');
    const nameField = document.getElementById('auth-field-name');
    const submitText = document.getElementById('btn-submit-text');
    const errorMsg = document.getElementById('auth-error-msg');
    const emailInput = document.getElementById('auth-input-email');
    const passInput = document.getElementById('auth-input-password');
    const nameInput = document.getElementById('auth-input-name');

    const openModal = (toStep = 1) => {
      modal.classList.remove('hidden');
      if (toStep === 2) {
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');
        this.selectedOnboardingStyles = [...this.currentStyles];
        this.renderOnboardingCards();
      } else {
        if (step1) step1.classList.remove('hidden');
        if (step2) step2.classList.add('hidden');
      }
      if (errorMsg) errorMsg.classList.add('hidden');
      if (window.lucide) window.lucide.createIcons();
    };

    const closeModal = () => {
      modal.classList.add('hidden');
    };

    // Header & Mobile Auth triggers
    const headerAuthBtn = document.getElementById('btn-header-auth');
    const mobileAuthBtn = document.getElementById('btn-mobile-auth');
    if (headerAuthBtn) headerAuthBtn.addEventListener('click', () => openModal(1));
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', () => openModal(1));

    // Close triggers
    const closeBtn = document.getElementById('btn-close-auth');
    const backdrop = document.getElementById('auth-modal-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // Auth tabs
    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.className = 'flex-1 pb-3 text-sm font-bold border-b-2 border-cobalt text-cobalt transition';
        tabSignUp.className = 'flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-ink-muted hover:text-ink transition';
        if (nameField) nameField.classList.add('hidden');
        if (submitText) submitText.textContent = this.lang === 'vi' ? 'Tiếp tục chọn phong cách' : 'Next: Choose Daily Styles';
        if (errorMsg) errorMsg.classList.add('hidden');
      });

      tabSignUp.addEventListener('click', () => {
        tabSignUp.className = 'flex-1 pb-3 text-sm font-bold border-b-2 border-cobalt text-cobalt transition';
        tabSignIn.className = 'flex-1 pb-3 text-sm font-bold border-b-2 border-transparent text-ink-muted hover:text-ink transition';
        if (nameField) nameField.classList.remove('hidden');
        if (submitText) submitText.textContent = this.lang === 'vi' ? 'Tiếp tục chọn phong cách' : 'Next: Choose Daily Styles';
        if (errorMsg) errorMsg.classList.add('hidden');
      });
    }

    // Step 1 Form Submit
    const authForm = document.getElementById('auth-main-form');
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput ? emailInput.value.trim() : '';
        const pass = passInput ? passInput.value.trim() : '';
        let name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          name = email ? email.split('@')[0] : 'ChicSort Member';
        }

        if (!email || !pass) {
          if (errorMsg) {
            errorMsg.textContent = this.lang === 'vi' ? 'Vui lòng nhập đầy đủ email và mật khẩu.' : 'Please enter email and password.';
            errorMsg.classList.remove('hidden');
          }
          return;
        }

        this.pendingAuthUser = {
          name: name,
          email: email,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
          plan: 'Free',
          styles: [...this.selectedOnboardingStyles]
        };

        this.selectedOnboardingStyles = this.selectedOnboardingStyles.length ? this.selectedOnboardingStyles : ['office'];
        this.renderOnboardingCards();
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Step 2 Style Selection Cards (Multi-Select toggle)
    document.querySelectorAll('#onboarding-styles-grid .style-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const styleId = card.getAttribute('data-style-id');
        this.toggleOnboardingCard(styleId);
      });
    });

    // Step 2 Back to Step 1
    const btnBack = document.getElementById('btn-back-to-step1');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (step2) step2.classList.add('hidden');
        if (step1) step1.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Step 2 Complete Onboarding
    const btnComplete = document.getElementById('btn-complete-onboarding');
    if (btnComplete) {
      btnComplete.addEventListener('click', () => {
        if (!this.pendingAuthUser) {
          this.pendingAuthUser = {
            name: 'ChicSort Member',
            email: 'user@chicsort.com',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80',
            plan: 'Free',
            styles: [...this.selectedOnboardingStyles]
          };
        }
        this.pendingAuthUser.styles = [...this.selectedOnboardingStyles];
        this.currentUser = Object.assign({}, this.pendingAuthUser);
        this.currentStyles = [...this.selectedOnboardingStyles];
        this.currentStyle = this.currentStyles[0] || 'office';
        localStorage.setItem('chicsort_user', JSON.stringify(this.currentUser));

        closeModal();
        this.updateUserAuthUI();
        this.generateOutfits(true);

        const styleNames = this.currentStyles.map(s => this.getStyleDisplayName(s)).join(', ');
        this.showToast(this.lang === 'vi' 
          ? `Chào mừng ${this.currentUser.name}! Đã thiết lập ${this.currentStyles.length} phong cách: ${styleNames}.`
          : `Welcome ${this.currentUser.name}! Set ${this.currentStyles.length} styles: ${styleNames}.`
        );
      });
    }

    // Header Profile Menu Toggle
    const userMenuBtn = document.getElementById('btn-user-menu-trigger');
    const userDropdown = document.getElementById('user-profile-dropdown');
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
          userDropdown.classList.add('hidden');
        }
      });
    }

    // Change Style from Profile
    const btnChangeStyleProfile = document.getElementById('btn-change-style-profile');
    const btnMobileChangeStyle = document.getElementById('btn-mobile-change-style');
    const handleChangeStyle = () => {
      if (userDropdown) userDropdown.classList.add('hidden');
      this.pendingAuthUser = this.currentUser ? Object.assign({}, this.currentUser) : null;
      openModal(2);
    };
    if (btnChangeStyleProfile) btnChangeStyleProfile.addEventListener('click', handleChangeStyle);
    if (btnMobileChangeStyle) btnMobileChangeStyle.addEventListener('click', handleChangeStyle);

    // Logout
    const btnLogout = document.getElementById('btn-user-logout');
    const btnMobileLogout = document.getElementById('btn-mobile-logout');
    const handleLogout = () => {
      this.currentUser = null;
      localStorage.removeItem('chicsort_user');
      this.currentStyles = ['office'];
      this.currentStyle = 'office';
      this.selectedOnboardingStyles = ['office'];
      if (userDropdown) userDropdown.classList.add('hidden');
      this.updateUserAuthUI();
      this.generateOutfits(true);
      this.showToast(this.lang === 'vi' ? 'Đã đăng xuất tài khoản.' : 'Signed out successfully.');
    };
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);
    if (btnMobileLogout) btnMobileLogout.addEventListener('click', handleLogout);

    // AI Stylist Style Archetype Pills (Toggle multi-selection on click)
    document.querySelectorAll('#stylist-style-pills [data-style-pill], #stylist-style-pills [data-style-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-style-pill') || btn.getAttribute('data-style-choice');
        const idx = this.currentStyles.indexOf(style);
        if (idx > -1) {
          if (this.currentStyles.length > 1) {
            this.currentStyles.splice(idx, 1);
          } else {
            this.showToast(this.lang === 'vi' ? 'Cần giữ ít nhất 1 phong cách hoạt động!' : 'Keep at least 1 active style!');
            return;
          }
        } else {
          this.currentStyles.push(style);
        }
        this.currentStyle = this.currentStyles[0] || 'office';
        if (this.currentUser) {
          this.currentUser.styles = [...this.currentStyles];
          localStorage.setItem('chicsort_user', JSON.stringify(this.currentUser));
        }
        this.updateUserAuthUI();
        this.generateOutfits(true);
        const styleNames = this.currentStyles.map(s => this.getStyleDisplayName(s)).join(', ');
        this.showToast(this.lang === 'vi' ? `Đang phối hợp ${this.currentStyles.length} gu: ${styleNames}` : `Active styles (${this.currentStyles.length}): ${styleNames}`);
      });
    });
  }
}

// Instantiate upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ChicSortApp();
});
