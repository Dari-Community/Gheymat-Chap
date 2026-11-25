(() => {
  "use strict";
  const STORAGE_KEY = "gheymat-chap-v0.1.0";
  const state = { products: [], currency: "افغانی", template: "classic", editingId: null };

  const $ = (selector) => document.querySelector(selector);
  const form = $("#product-form");
  const nameInput = $("#product-name");
  const priceInput = $("#product-price");
  const quantityInput = $("#product-quantity");
  const currencySelect = $("#currency");
  const templateSelect = $("#template");
  const productList = $("#product-list");
  const previewGrid = $("#preview-grid");
  const emptyList = $("#empty-list");
  const previewEmpty = $("#preview-empty");
  const submitButton = $("#submit-button");
  const cancelEdit = $("#cancel-edit");
  const clearAll = $("#clear-all");
  const printButton = $("#print-button");
  const barcodeInput = $("#product-barcode");
  const toast = $("#toast");
  let toastTimer;

  const digitsMap = {"۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
  function normalizeDigits(value) { return String(value).replace(/[۰-۹٠-٩]/g, d => digitsMap[d]); }
  function parsePrice(value) {
    const normalized = normalizeDigits(value).replace(/[٬,\s]/g, "");
    if (!/^\d+$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  function formatPrice(value) {
    return new Intl.NumberFormat("fa-IR").format(value);
  }
  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({products: state.products, currency: state.currency, template: state.template}));
    } catch (error) { showToast("معلومات در مرورگر ذخیره نشد."); }
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !Array.isArray(saved.products)) return;
      state.products = saved.products.filter(p => p && typeof p.name === "string" && Number.isSafeInteger(p.price) && Number.isSafeInteger(p.quantity));
      state.currency = saved.currency === "دالر" ? "دالر" : "افغانی";
      state.template = ["classic","dark","soft"].includes(saved.template) ? saved.template : "classic";
    } catch (_) { state.products = []; }
  }
  function renderProducts() {
    productList.innerHTML = "";
    emptyList.classList.toggle("hidden", state.products.length > 0);
    clearAll.classList.toggle("hidden", state.products.length === 0);
    $("#product-count").textContent = formatPrice(state.products.reduce((sum, p) => sum + p.quantity, 0));
    state.products.forEach(product => {
      const item = document.createElement("article");
      item.className = "product-item";
      const info = document.createElement("div");
      info.className = "product-info";
      const title = document.createElement("strong");
      title.textContent = product.name;
      const detail = document.createElement("small");
      detail.textContent = `${formatPrice(product.price)} ${state.currency} · ${formatPrice(product.quantity)} برچسب`;
      info.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "product-actions";
      const edit = document.createElement("button");
      edit.className = "icon-button";
      edit.type = "button";
      edit.title = "تغییر";
      edit.setAttribute("aria-label", "تغییر " + product.name);
      edit.textContent = "✎";
      edit.addEventListener("click", () => startEdit(product.id));
      const remove = document.createElement("button");
      remove.className = "icon-button delete";
      remove.type = "button";
      remove.title = "حذف";
      remove.setAttribute("aria-label", "حذف " + product.name);
      remove.textContent = "×";
      remove.addEventListener("click", () => deleteProduct(product.id));
      actions.append(edit, remove);
      item.append(info, actions);
      productList.append(item);
    });
  }
  function createLabel(product) {
    const label = document.createElement("article");
    label.className = `price-label template-${state.template}`;
    const name = document.createElement("div");
    name.className = "label-name";
    name.textContent = product.name;
    const price = document.createElement("div");
    price.className = "label-price";
    price.textContent = formatPrice(product.price);
    const currency = document.createElement("div");
    currency.className = "label-currency";
    currency.textContent = state.currency;
    const watermark = document.createElement("img");
    watermark.className = "label-watermark";
    watermark.src = "assets/dari-community-logo.png";
    watermark.alt = "";
    watermark.setAttribute("aria-hidden", "true");
    if (product.barcode) {
      const barcodeContainer = document.createElement("div");
      barcodeContainer.className = "label-barcode";

      const barcodeSvg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
      );

      barcodeContainer.appendChild(barcodeSvg);

      if (typeof JsBarcode === "function") {
        try {
          JsBarcode(barcodeSvg, product.barcode, {
            format: "CODE128",
            width: 1.2,
            height: 25,
            displayValue: true,
            fontSize: 7,
            margin: 0,
            textMargin: 2,
            background: "transparent",
            lineColor: state.template === "dark" ? "#ffffff" : "#171717"
          });
        } catch (error) {
          barcodeContainer.textContent = product.barcode;
        }
      } else {
        barcodeContainer.textContent = product.barcode;
      }

      label.appendChild(barcodeContainer);
    }
    label.append(watermark,price, name,  currency);
    return label;
  }
  function renderPreview() {
    previewGrid.innerHTML = "";
    const total = state.products.reduce((sum, p) => sum + p.quantity, 0);
    previewEmpty.classList.toggle("hidden", total > 0);
    previewGrid.classList.toggle("hidden", total === 0);
    printButton.disabled = total === 0;
    $("#preview-meta").textContent = total ? `${formatPrice(total)} برچسب · در صفحه A4 تنظیم می‌شوند.` : "برچسب‌ها در صفحه A4 تنظیم می‌شوند.";
    // نمایش پیش‌نمایش تا ۵۰۰ برچسب؛ مقدار اصلی برای چاپ محفوظ است.
    let rendered = 0;
    for (const product of state.products) {
      for (let i = 0; i < product.quantity && rendered < 500; i++, rendered++) previewGrid.append(createLabel(product));
    }
    if (total > 500) showToast("پیش‌نمایش حداکثر ۵۰۰ برچسب را نشان می‌دهد؛ اما همه برچسب‌ها چاپ می‌شوند.");
  }
  function render() { renderProducts(); renderPreview(); }
  function resetForm() {
    form.reset();
    quantityInput.value = "1";
    currencySelect.value = state.currency;
    $("#currency-suffix").textContent = state.currency;
    state.editingId = null;
    submitButton.innerHTML = "<span>＋</span> افزودن کالا";
    cancelEdit.classList.add("hidden");
  }
  function startEdit(id) {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    state.editingId = id;
    nameInput.value = product.name;
    priceInput.value = String(product.price);
    quantityInput.value = product.quantity;
    submitButton.textContent = "ذخیره تغییرات";
    cancelEdit.classList.remove("hidden");
    nameInput.focus();
    form.scrollIntoView({behavior: "smooth", block: "nearest"});
    barcodeInput.value = product.barcode || "";
  }
  function deleteProduct(id) {
    state.products = state.products.filter(p => p.id !== id);
    if (state.editingId === id) resetForm();
    saveState(); render();
    showToast("کالا حذف شد.");
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const barcode = barcodeInput.value.trim();
    if (barcode && !/^[\x20-\x7E]{1,80}$/.test(barcode)) {
      showToast("بارکد باید شامل حروف و اعداد انگلیسی باشد.");
      barcodeInput.focus();
      return;
    }
    const price = parsePrice(priceInput.value);
    const quantity = Number(normalizeDigits(quantityInput.value));
    if (!name) { nameInput.focus(); return; }
    if (price === null) { showToast("لطفاً قیمت درست وارد کنید."); priceInput.focus(); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) { showToast("شمار برچسب‌ها باید بین ۱ تا ۲۰۰ باشد."); quantityInput.focus(); return; }
    if (state.editingId) {
      const product = state.products.find(p => p.id === state.editingId);
      if (product) Object.assign(product, {name, price, quantity, barcode});
      showToast("تغییرات ذخیره شد.");
    } else {
      state.products.push({id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()), name, price, quantity,barcode});
      showToast("کالا اضافه شد.");
    }
    saveState(); render(); resetForm(); nameInput.focus();
  });
  cancelEdit.addEventListener("click", resetForm);
  currencySelect.addEventListener("change", () => {
    state.currency = currencySelect.value;
    $("#currency-suffix").textContent = state.currency;
    saveState(); render();
  });
  templateSelect.addEventListener("change", () => {
    state.template = templateSelect.value;
    saveState(); renderPreview();
  });
  clearAll.addEventListener("click", () => {
    if (!state.products.length) return;
    if (!confirm("آیا می‌خواهید همه کالاها و برچسب‌ها حذف شوند؟")) return;
    state.products = []; saveState(); render(); resetForm(); showToast("فهرست کالاها حذف شد.");
  });
  printButton.addEventListener("click", () => window.print());

  loadState();
  currencySelect.value = state.currency;
  $("#currency-suffix").textContent = state.currency;
  templateSelect.value = state.template;
  render();
})();
