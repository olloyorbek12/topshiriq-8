import Web3 from "web3";
import "./style.css";

const STORAGE_KEY = "logichain-trace-demo-v1";
const BASE_URL = import.meta.env.BASE_URL || "./";

const STATUS_LABELS = ["Yaratildi", "Omborda", "Yo'lda", "Bojxonada", "Yetkazildi", "Bekor qilindi"];
const STATUS_CLASS = ["warn", "warn", "transit", "warn", "good", "bad"];

const $ = (id) => document.getElementById(id);

const els = {
  connectWallet: $("connect-wallet"),
  demoReset: $("demo-reset"),
  appAlert: $("app-alert"),
  modeStatus: $("mode-status"),
  currentAccount: $("current-account"),
  networkStatus: $("network-status"),
  contractAddress: $("contract-address"),
  productCount: $("product-count"),
  eventCount: $("event-count"),
  deliveredCount: $("delivered-count"),
  transitCount: $("transit-count"),
  registerProduct: $("register-product"),
  updateStatus: $("update-status"),
  transferOwner: $("transfer-owner"),
  verifyProduct: $("verify-product"),
  setAuthenticity: $("set-authenticity"),
  refreshRegistry: $("refresh-registry"),
  auditProduct: $("audit-product"),
  exportDemo: $("export-demo"),
  copyGenerated: $("copy-generated"),
  generatedId: $("generated-id"),
  trackResult: $("track-result"),
  ownerResult: $("owner-result"),
  verifyResult: $("verify-result"),
  registrySearch: $("registry-search"),
  registryList: $("registry-list"),
  auditList: $("audit-list"),
};

const state = {
  mode: "demo",
  account: "",
  config: null,
  web3: null,
  contract: null,
  demo: loadDemoState(),
  lastProductId: "",
};

function publicUrl(fileName) {
  return `${BASE_URL}${fileName}`;
}

function loadDemoState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    account: createDemoAddress(),
    products: {},
    productIds: [],
    histories: {},
    blocks: [],
  };
}

function saveDemoState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.demo));
}

function createDemoAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function value(id) {
  return $(id).value.trim();
}

function setValue(id, nextValue) {
  $(id).value = nextValue;
}

function defaultAddress(inputValue) {
  return inputValue || state.account || state.demo.account;
}

function showAlert(message, tone = "success") {
  els.appAlert.textContent = message;
  els.appAlert.className = `alert ${tone}`;
  els.appAlert.hidden = false;
  clearTimeout(showAlert.timer);
  showAlert.timer = setTimeout(() => {
    els.appAlert.hidden = true;
  }, 5200);
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.classList.toggle("loading", busy);
}

function shortText(text, head = 8, tail = 6) {
  if (!text) return "-";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function formatDate(input) {
  const date = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stableStringify(input) {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`).join(",")}}`;
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `0x${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function assertText(text, message) {
  if (!text) throw new Error(message);
}

function assertAddress(address, message) {
  if (!Web3.utils.isAddress(address)) throw new Error(message);
}

function statusLabel(status) {
  return STATUS_LABELS[Number(status)] || "Noma'lum";
}

async function loadContractConfig() {
  try {
    const response = await fetch(publicUrl("contracts.json"), { cache: "no-store" });
    if (!response.ok) return null;
    const config = await response.json();
    if (!config.deployed || !config.address) return config;

    const artifactResponse = await fetch(publicUrl(config.artifactPath || "LogisticsChain.json"), {
      cache: "no-store",
    });
    if (!artifactResponse.ok) throw new Error("ABI fayli topilmadi.");
    const artifact = await artifactResponse.json();
    return { ...config, abi: artifact.abi };
  } catch (error) {
    console.warn("Contract config load failed:", error);
    return null;
  }
}

async function ensureNetwork(web3, config) {
  if (!window.ethereum || !config?.chainId) return;
  const currentChainId = Number(await web3.eth.getChainId());
  if (currentChainId === Number(config.chainId)) return;

  const hexChainId = `0x${Number(config.chainId).toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: config.networkName || "Logistics Chain",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [config.rpcUrl],
        },
      ],
    });
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      state.mode = "demo";
      state.account = state.demo.account;
      await refreshUi();
      showAlert("MetaMask topilmadi. Demo Ledger rejimi ishlayapti.", "success");
      return;
    }

    setBusy(els.connectWallet, true);
    const config = await loadContractConfig();
    const web3 = new Web3(window.ethereum);
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.account = accounts[0];

    if (config?.deployed && config.address && config.abi) {
      await ensureNetwork(web3, config);
      state.mode = "contract";
      state.config = config;
      state.web3 = web3;
      state.contract = new web3.eth.Contract(config.abi, config.address);
      showAlert("Wallet ulandi. Real blockchain kontrakti faol.", "success");
    } else {
      state.mode = "demo";
      showAlert("Wallet ulandi. Kontrakt deploy qilinmagani uchun demo rejim faol.", "success");
    }

    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Wallet ulashda xatolik.", "error");
  } finally {
    setBusy(els.connectWallet, false);
  }
}

async function bootstrap() {
  state.config = await loadContractConfig();
  state.account = state.demo.account;
  wireEvents();
  prefillAddresses();
  await refreshUi();
}

function prefillAddresses() {
  if (!value("initial-owner")) setValue("initial-owner", state.demo.account);
  if (!value("new-owner")) setValue("new-owner", createDemoAddress());
}

function wireEvents() {
  els.connectWallet.addEventListener("click", connectWallet);
  els.demoReset.addEventListener("click", resetDemo);
  els.registerProduct.addEventListener("click", handleRegisterProduct);
  els.updateStatus.addEventListener("click", handleUpdateStatus);
  els.transferOwner.addEventListener("click", handleTransferOwner);
  els.verifyProduct.addEventListener("click", handleVerifyProduct);
  els.setAuthenticity.addEventListener("click", handleSetAuthenticity);
  els.refreshRegistry.addEventListener("click", refreshRegistry);
  els.auditProduct.addEventListener("click", handleAuditProduct);
  els.exportDemo.addEventListener("click", exportDemoJson);
  els.copyGenerated.addEventListener("click", copyGeneratedId);
  els.registrySearch.addEventListener("input", renderRegistry);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }
}

async function refreshUi() {
  els.modeStatus.textContent = state.mode === "contract" ? "Real Blockchain" : "Demo Ledger";
  els.currentAccount.textContent = shortText(state.account || state.demo.account);

  if (state.mode === "contract" && state.config) {
    els.networkStatus.textContent = `${state.config.networkName || "Blockchain"} (${state.config.chainId})`;
    els.contractAddress.textContent = shortText(state.config.address);
  } else {
    els.networkStatus.textContent = "Offline demo";
    els.contractAddress.textContent = state.config?.address ? shortText(state.config.address) : "Sozlanmagan";
  }

  await updateMetrics();
  await refreshRegistry();
  renderAudit();
}

async function updateMetrics() {
  if (state.mode === "contract" && state.contract) {
    try {
      const [products, events] = await Promise.all([
        state.contract.methods.getProductCount().call(),
        state.contract.methods.eventCount().call(),
      ]);
      els.productCount.textContent = String(products);
      els.eventCount.textContent = String(events);
      els.deliveredCount.textContent = "On-chain";
      els.transitCount.textContent = "On-chain";
      return;
    } catch (error) {
      console.warn("Metrics failed:", error);
    }
  }

  const products = Object.values(state.demo.products);
  els.productCount.textContent = products.length;
  els.eventCount.textContent = Object.values(state.demo.histories).reduce((sum, history) => sum + history.length, 0);
  els.deliveredCount.textContent = products.filter((product) => Number(product.status) === 4).length;
  els.transitCount.textContent = products.filter((product) => Number(product.status) === 2).length;
}

async function handleRegisterProduct() {
  setBusy(els.registerProduct, true);
  try {
    const product = readProductForm();
    assertText(product.serialNumber, "Seriya raqamini kiriting.");
    assertText(product.name, "Mahsulot nomini kiriting.");
    assertAddress(product.currentOwner, "Boshlang'ich egasi wallet manzili noto'g'ri.");
    product.id = await sha256Hex(`product:${product.serialNumber}:${product.name}:${product.metadataCID}`);

    if (state.mode === "contract") {
      await state.contract.methods
        .registerProduct(
          product.id,
          product.serialNumber,
          product.name,
          product.category,
          product.metadataCID,
          product.origin,
          product.currentOwner,
          product.currentLocation
        )
        .send({ from: state.account });
    } else {
      await registerProductDemo(product);
    }

    state.lastProductId = product.id;
    els.generatedId.textContent = product.id;
    fillProductIdFields(product.id);
    showAlert("Mahsulot blockchain reyestrga kiritildi.", "success");
    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Mahsulot kiritishda xatolik.", "error");
  } finally {
    setBusy(els.registerProduct, false);
  }
}

function readProductForm() {
  return {
    serialNumber: value("serial-number"),
    name: value("product-name"),
    category: value("product-category"),
    metadataCID: value("metadata-cid"),
    origin: value("product-origin"),
    currentOwner: defaultAddress(value("initial-owner")),
    manufacturer: state.account || state.demo.account,
    status: 0,
    currentLocation: value("initial-location"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authentic: true,
  };
}

async function registerProductDemo(product) {
  if (state.demo.products[product.id]) throw new Error("Bu mahsulot allaqachon kiritilgan.");
  state.demo.products[product.id] = product;
  state.demo.productIds.unshift(product.id);
  state.demo.histories[product.id] = [];
  await appendProductEvent(product.id, {
    action: "PRODUCT_REGISTERED",
    fromOwner: "0x0000000000000000000000000000000000000000",
    toOwner: product.currentOwner,
    status: 0,
    location: product.currentLocation,
    note: "Mahsulot birinchi marta tizimga kiritildi",
  });
  saveDemoState();
}

async function handleUpdateStatus() {
  setBusy(els.updateStatus, true);
  try {
    const productId = value("track-product-id");
    const status = Number(value("delivery-status"));
    const location = value("current-location");
    const note = value("status-note");
    assertText(productId, "Product ID kiriting.");
    assertText(location, "Joriy lokatsiyani kiriting.");

    if (state.mode === "contract") {
      await state.contract.methods.updateStatus(productId, status, location, note).send({ from: state.account });
    } else {
      await updateStatusDemo(productId, status, location, note);
    }

    els.trackResult.textContent = `Status yangilandi: ${statusLabel(status)} | ${location}`;
    showAlert("Yetkazib berish holati yangilandi.", "success");
    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Status yangilashda xatolik.", "error");
  } finally {
    setBusy(els.updateStatus, false);
  }
}

async function updateStatusDemo(productId, status, location, note) {
  const product = state.demo.products[productId];
  if (!product) throw new Error("Mahsulot topilmadi.");
  product.status = status;
  product.currentLocation = location;
  product.updatedAt = new Date().toISOString();
  await appendProductEvent(productId, {
    action: "STATUS_UPDATED",
    fromOwner: product.currentOwner,
    toOwner: product.currentOwner,
    status,
    location,
    note,
  });
  saveDemoState();
}

async function handleTransferOwner() {
  setBusy(els.transferOwner, true);
  try {
    const productId = value("owner-product-id");
    const newOwner = value("new-owner");
    const location = value("owner-location");
    const note = value("owner-note");
    assertText(productId, "Product ID kiriting.");
    assertAddress(newOwner, "Yangi egasi wallet manzili noto'g'ri.");

    if (state.mode === "contract") {
      await state.contract.methods.transferOwnership(productId, newOwner, location, note).send({ from: state.account });
    } else {
      await transferOwnerDemo(productId, newOwner, location, note);
    }

    els.ownerResult.textContent = `Egalik o'tkazildi: ${shortText(newOwner, 10, 8)}`;
    showAlert("Mahsulot egasi yangilandi.", "success");
    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Egalik almashtirishda xatolik.", "error");
  } finally {
    setBusy(els.transferOwner, false);
  }
}

async function transferOwnerDemo(productId, newOwner, location, note) {
  const product = state.demo.products[productId];
  if (!product) throw new Error("Mahsulot topilmadi.");
  const previousOwner = product.currentOwner;
  product.currentOwner = newOwner;
  product.currentLocation = location || product.currentLocation;
  product.updatedAt = new Date().toISOString();
  await appendProductEvent(productId, {
    action: "OWNER_TRANSFERRED",
    fromOwner: previousOwner,
    toOwner: newOwner,
    status: product.status,
    location: product.currentLocation,
    note,
  });
  saveDemoState();
}

async function handleVerifyProduct() {
  setBusy(els.verifyProduct, true);
  try {
    const productId = value("verify-product-id");
    assertText(productId, "Product ID kiriting.");
    const result = state.mode === "contract"
      ? await verifyContractProduct(productId)
      : verifyDemoProduct(productId);
    renderVerifyResult(result);
  } catch (error) {
    els.verifyResult.className = "verify-result invalid";
    els.verifyResult.textContent = error.message || "Tekshiruvda xatolik.";
  } finally {
    setBusy(els.verifyProduct, false);
  }
}

async function verifyContractProduct(productId) {
  const result = await state.contract.methods.verifyProduct(productId).call();
  return {
    id: productId,
    valid: Boolean(result[0]),
    authentic: Boolean(result[1]),
    currentOwner: result[2],
    status: Number(result[3]),
    currentLocation: result[4],
    historyLength: Number(result[5]),
  };
}

function verifyDemoProduct(productId) {
  const product = state.demo.products[productId];
  if (!product) return { id: productId, valid: false, authentic: false };
  return {
    ...product,
    valid: product.authentic && Number(product.status) !== 5,
    historyLength: state.demo.histories[productId]?.length || 0,
  };
}

function renderVerifyResult(result) {
  els.verifyResult.className = `verify-result ${result.valid ? "valid" : "invalid"}`;
  if (!result.valid) {
    els.verifyResult.textContent = result.authentic === false
      ? "Mahsulot haqiqiy emas yoki qalbaki deb belgilangan."
      : "Mahsulot reyestrda topilmadi yoki bekor qilingan.";
    return;
  }

  els.verifyResult.innerHTML = `
    <strong>Mahsulot haqiqiy</strong><br>
    ID: ${escapeHtml(result.id)}<br>
    Egasi: ${escapeHtml(result.currentOwner || "-")}<br>
    Status: ${escapeHtml(statusLabel(result.status))}<br>
    Lokatsiya: ${escapeHtml(result.currentLocation || "-")}<br>
    Audit yozuvlari: ${escapeHtml(String(result.historyLength ?? 0))}
  `;
}

async function handleSetAuthenticity() {
  setBusy(els.setAuthenticity, true);
  try {
    const productId = value("verify-product-id");
    const authentic = value("authenticity-value") === "true";
    const note = value("authenticity-note");
    assertText(productId, "Product ID kiriting.");

    if (state.mode === "contract") {
      await state.contract.methods.setAuthenticity(productId, authentic, note).send({ from: state.account });
    } else {
      await setAuthenticityDemo(productId, authentic, note);
    }

    showAlert("Mahsulot haqiqiylik holati yozildi.", "success");
    await refreshUi();
  } catch (error) {
    showAlert(error.message || "Haqiqiylik yozishda xatolik.", "error");
  } finally {
    setBusy(els.setAuthenticity, false);
  }
}

async function setAuthenticityDemo(productId, authentic, note) {
  const product = state.demo.products[productId];
  if (!product) throw new Error("Mahsulot topilmadi.");
  product.authentic = authentic;
  product.updatedAt = new Date().toISOString();
  await appendProductEvent(productId, {
    action: "AUTHENTICITY_UPDATED",
    fromOwner: product.currentOwner,
    toOwner: product.currentOwner,
    status: product.status,
    location: product.currentLocation,
    note,
  });
  saveDemoState();
}

async function appendProductEvent(productId, event) {
  const history = state.demo.histories[productId] || [];
  const previousHash = state.demo.blocks[0]?.hash || "0xgenesis";
  const record = {
    productId,
    actor: state.account || state.demo.account,
    timestamp: new Date().toISOString(),
    ...event,
  };
  record.hash = await sha256Hex(stableStringify({ ...record, previousHash }));
  history.push(record);
  state.demo.histories[productId] = history;
  state.demo.blocks.unshift({
    number: state.demo.blocks.length + 1,
    productId,
    action: event.action,
    hash: record.hash,
    previousHash,
    timestamp: record.timestamp,
  });
  saveDemoState();
}

async function refreshRegistry() {
  if (state.mode === "contract" && state.contract) {
    await renderContractRegistry();
    return;
  }
  renderRegistry();
}

function renderRegistry(items = null) {
  const term = value("registry-search").toLowerCase();
  const products = items || state.demo.productIds.map((id) => state.demo.products[id]).filter(Boolean);
  const filtered = products.filter((product) => stableStringify(product).toLowerCase().includes(term));

  if (!filtered.length) {
    els.registryList.innerHTML = `<p class="empty">Reyestrda mahsulot yo'q.</p>`;
    return;
  }

  els.registryList.innerHTML = filtered.map((product) => productTemplate(product)).join("");
}

async function renderContractRegistry() {
  try {
    const count = Number(await state.contract.methods.getProductCount().call());
    const items = [];
    for (let index = count - 1; index >= 0 && items.length < 50; index -= 1) {
      const id = await state.contract.methods.getProductIdAt(index).call();
      const raw = await state.contract.methods.getProduct(id).call();
      items.push(contractProductToView(raw));
    }
    renderRegistry(items);
  } catch (error) {
    els.registryList.innerHTML = `<p class="empty">${escapeHtml(error.message || "Reyestrni o'qib bo'lmadi.")}</p>`;
  }
}

function contractProductToView(raw) {
  return {
    id: raw.id || raw[0],
    serialNumber: raw.serialNumber || raw[1],
    name: raw.name || raw[2],
    category: raw.category || raw[3],
    metadataCID: raw.metadataCID || raw[4],
    origin: raw.origin || raw[5],
    currentOwner: raw.currentOwner || raw[6],
    manufacturer: raw.manufacturer || raw[7],
    status: Number(raw.status || raw[8]),
    currentLocation: raw.currentLocation || raw[9],
    createdAt: Number(raw.createdAt || raw[10]),
    updatedAt: Number(raw.updatedAt || raw[11]),
    authentic: Boolean(raw.authentic ?? raw[13]),
  };
}

function productTemplate(product) {
  const status = Number(product.status);
  const badgeClass = product.authentic ? STATUS_CLASS[status] || "warn" : "bad";
  const badgeText = product.authentic ? statusLabel(status) : "Qalbaki/shubhali";
  return `
    <article class="registry-item">
      <header>
        <div>
          <h3>${escapeHtml(product.name || "Nomsiz mahsulot")}</h3>
          <p class="meta-line">${escapeHtml(product.serialNumber || "-")} | ${escapeHtml(product.category || "-")}</p>
        </div>
        <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </header>
      <p class="meta-line">Product ID: <code>${escapeHtml(product.id || "-")}</code></p>
      <p class="meta-line">Lokatsiya: ${escapeHtml(product.currentLocation || "-")}</p>
      <p class="meta-line">Egasi: ${escapeHtml(shortText(product.currentOwner || "-", 10, 8))}</p>
      <p class="meta-line">Origin: ${escapeHtml(product.origin || "-")} | Yangilangan: ${escapeHtml(formatDate(product.updatedAt))}</p>
      <p class="meta-line">Metadata: ${escapeHtml(product.metadataCID || "-")}</p>
    </article>
  `;
}

async function handleAuditProduct() {
  setBusy(els.auditProduct, true);
  try {
    const productId = value("audit-product-id");
    assertText(productId, "Product ID kiriting.");
    if (state.mode === "contract") {
      await renderContractAudit(productId);
    } else {
      renderAudit(productId);
    }
  } catch (error) {
    els.auditList.innerHTML = `<p class="empty">${escapeHtml(error.message || "Auditni o'qib bo'lmadi.")}</p>`;
  } finally {
    setBusy(els.auditProduct, false);
  }
}

function renderAudit(productId = value("audit-product-id")) {
  if (!productId) {
    const latestId = state.demo.productIds[0];
    if (!latestId) {
      els.auditList.innerHTML = `<p class="empty">Audit uchun mahsulot tanlang.</p>`;
      return;
    }
    productId = latestId;
    setValue("audit-product-id", latestId);
  }

  const history = state.demo.histories[productId] || [];
  if (!history.length) {
    els.auditList.innerHTML = `<p class="empty">Bu mahsulot uchun audit yozuvi topilmadi.</p>`;
    return;
  }

  els.auditList.innerHTML = history.slice().reverse().map((event, index) => auditTemplate(event, history.length - index)).join("");
}

async function renderContractAudit(productId) {
  const length = Number(await state.contract.methods.getHistoryLength(productId).call());
  const history = [];
  for (let index = 0; index < length; index += 1) {
    const raw = await state.contract.methods.getHistoryEvent(productId, index).call();
    history.push({
      productId: raw.productId || raw[0],
      actor: raw.actor || raw[1],
      fromOwner: raw.fromOwner || raw[2],
      toOwner: raw.toOwner || raw[3],
      status: Number(raw.status || raw[4]),
      location: raw.location || raw[5],
      note: raw.note || raw[6],
      timestamp: Number(raw.timestamp || raw[7]),
      action: "ON_CHAIN_EVENT",
    });
  }
  els.auditList.innerHTML = history.reverse().map((event, index) => auditTemplate(event, length - index)).join("");
}

function auditTemplate(event, number) {
  return `
    <article class="audit-item">
      <header>
        <h3>#${number} ${escapeHtml(event.action || "EVENT")}</h3>
        <span class="badge ${STATUS_CLASS[Number(event.status)] || "warn"}">${escapeHtml(statusLabel(event.status))}</span>
      </header>
      <p class="meta-line">Vaqt: ${escapeHtml(formatDate(event.timestamp))} | Joy: ${escapeHtml(event.location || "-")}</p>
      <p class="meta-line">Actor: ${escapeHtml(shortText(event.actor || "-", 10, 8))}</p>
      <p class="meta-line">Egalik: ${escapeHtml(shortText(event.fromOwner || "-", 10, 8))} -> ${escapeHtml(shortText(event.toOwner || "-", 10, 8))}</p>
      <p class="meta-line">Izoh: ${escapeHtml(event.note || "-")}</p>
      ${event.hash ? `<p class="meta-line">Hash: <code>${escapeHtml(event.hash)}</code></p>` : ""}
    </article>
  `;
}

function fillProductIdFields(productId) {
  for (const id of ["track-product-id", "owner-product-id", "verify-product-id", "audit-product-id"]) {
    setValue(id, productId);
  }
}

async function copyGeneratedId() {
  if (!state.lastProductId) {
    showAlert("Avval mahsulot kiriting.", "error");
    return;
  }
  await navigator.clipboard.writeText(state.lastProductId);
  showAlert("Product ID nusxalandi.", "success");
}

function exportDemoJson() {
  const blob = new Blob([JSON.stringify(state.demo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "logichain-demo-ledger.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function resetDemo() {
  if (!confirm("Demo reyestrdagi barcha lokal ma'lumotlar o'chirilsinmi?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.demo = loadDemoState();
  state.mode = "demo";
  state.account = state.demo.account;
  state.lastProductId = "";
  prefillAddresses();
  els.generatedId.textContent = "Yaratilganda chiqadi";
  showAlert("Demo ma'lumotlar tozalandi.", "success");
  await refreshUi();
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

bootstrap();
