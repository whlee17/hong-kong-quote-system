import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import type { Category, QuoteItem, QuoteInfo, PaymentPlan } from './types';
import * as XLSX from 'xlsx';
import logoImage from './assets/resource_4c0f1c50.png';
import {
  STANDARD_ITEMS, PAYMENT_PLANS, DEFAULT_CLAUSES, CATEGORIES,
  generateId, formatMoney, getToday, generateQuoteNo
} from './types';

// 導入源代碼文件內容（用於下載）
import appTsxRaw from './App.tsx?raw';
import appCssRaw from './App.css?raw';
import typesRaw from './types.ts?raw';
import mainTsxRaw from './main.tsx?raw';
import manifestRaw from '../manifest.json?raw';
import packageJsonRaw from '../package.json?raw';
import swJsRaw from '../public/sw.js?raw';

// 訂單狀態類型
type QuoteStatus = 'pending' | 'quoted' | 'signed' | 'constructing' | 'completed' | 'cancelled';

// 狀態標籤配置
const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '未報價', color: '#6B7280', bgColor: '#F3F4F6' },
  quoted: { label: '報價待回覆', color: '#D97706', bgColor: '#FEF3C7' },
  signed: { label: '已簽約', color: '#059669', bgColor: '#D1FAE5' },
  constructing: { label: '施工中', color: '#2563EB', bgColor: '#DBEAFE' },
  completed: { label: '完工結清', color: '#7C3AED', bgColor: '#EDE9FE' },
  cancelled: { label: '作廢', color: '#DC2626', bgColor: '#FEE2E2' },
};

// 客戶類型
interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: number;
  updatedAt: number | null;
}

// 報價記錄類型（更新版）
interface QuoteRecord {
  id: string;
  quoteNo: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: string;
  responsible: string;
  quoteDate: string;
  items: string;
  discount: number;
  discountItem: string;
  discountType: 'amount' | 'percent';
  discountPercent: number;
  paymentPlan: string;
  customStages: string;
  presetPlanRemarks: string;
  clauses: string;
  clausesEnabled: number;
  generalRemark: string;
  bankName: string;
  companyName: string;
  bankAccount: string;
  fpsId: string;
  subtotal: number;
  finalTotal: number;
  version: number;
  status: QuoteStatus;
  versionRemark: string;
  parentId: string;
  createdAt: number;
  updatedAt: number | null;
}

// 頁面視圖類型
type ViewType = 'list' | 'edit' | 'preview' | 'compare' | 'settings' | 'standardItems';

// 移動端鍵盤橋接組件
const MobileInputBridge = ({ value, onChange, placeholder, type = "text", dataTestId }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  dataTestId?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
    data-testid={dataTestId}
  />
);

function App() {
  // 頁面視圖
  const [view, setView] = useState<ViewType>('list');
  
  // 當前選中的報價單ID
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  
  // 報價單列表
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  
  // 篩選條件
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // 統計數據
  const [statusStats, setStatusStats] = useState<Record<QuoteStatus, number>>({
    pending: 0, quoted: 0, signed: 0, constructing: 0, completed: 0, cancelled: 0,
  });
  
  // 報價基礎資訊
  const [quoteInfo, setQuoteInfo] = useState<QuoteInfo>({
    quoteNo: generateQuoteNo(),
    date: getToday(),
    customerName: '',
    phone: '',
    address: '',
    responsible: '',
  });

  // 項目列表
  const [items, setItems] = useState<QuoteItem[]>([]);

  // 優惠金額
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount'); // 折扣類型
  const [discount, setDiscount] = useState(0); // 折扣金額（當類型為金額時）
  const [discountPercent, setDiscountPercent] = useState(0); // 折扣百分比（當類型為百分比時）
  const [discountItem, setDiscountItem] = useState(''); // 折扣項目/原因

  // 付款方案
  const [selectedPlan, setSelectedPlan] = useState<string>('1');
  const [customStages, setCustomStages] = useState<{ name: string; percentage: number; amount?: number; remark?: string }[]>([]);
  const [presetPlanRemarks, setPresetPlanRemarks] = useState<Record<string, string[]>>({});

  // 合約條款
  const [clauses, setClauses] = useState<string[]>([...DEFAULT_CLAUSES]);
  const [clausesEnabled, setClausesEnabled] = useState(true);

  // 整體備註
  const [generalRemark, setGeneralRemark] = useState('');

  // 頁腳設置
  const [bankName, setBankName] = useState('中國銀行（香港）');
  const [companyName, setCompanyName] = useState('Artisan Studio Limited');
  const [bankAccount, setBankAccount] = useState('012-586-2-109941-2');
  const [fpsId, setFpsId] = useState('121966964');

  // 版本和狀態
  const [currentVersion, setCurrentVersion] = useState(1);
  const [currentStatus, setCurrentStatus] = useState<QuoteStatus>('pending');
  const [versionRemark, setVersionRemark] = useState('');
  const [parentId, setParentId] = useState('');
  
  // 客戶ID
  const [customerId, setCustomerId] = useState('');

  // 保存消息
  const [saveMessage, setSaveMessage] = useState('');

  // 版本對比
  const [compareQuoteId, setCompareQuoteId] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<QuoteRecord | null>(null);

  // 刪除確認彈窗
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; quoteId: string; quoteName: string }>({ show: false, quoteId: '', quoteName: '' });
  const [deleteMessage, setDeleteMessage] = useState('');

  // 設定面板
  const [showSettings, setShowSettings] = useState(false);

  // 自定義標準項目庫
  const [customStandardItems, setCustomStandardItems] = useState<Record<Category, { name: string; unit: string; priceRange: string; defaultRemark?: string }[]> | null>(null);

  // HTML 源碼檢視
  const [showHtmlDebug, setShowHtmlDebug] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');

  // 應用文件瀏覽器
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [appFiles, setAppFiles] = useState<{ name: string; path: string; size: number; type: string; isDirectory?: boolean }[]>([]);
  const [fileBrowserPage, setFileBrowserPage] = useState(1);
  const [currentBrowsePath, setCurrentBrowsePath] = useState<string[]>([]); // 當前瀏覽路徑
  const [browseHistory, setBrowseHistory] = useState<string[][]>([]); // 瀏覽歷史
  const [historyIndex, setHistoryIndex] = useState(-1); // 當前歷史位置
  const filesPerPage = 10;

  // 查看文件內容
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ name: string; path: string; content: string } | null>(null);

  // 下載狀態
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  // 標準項目管理狀態
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItems, setEditingItems] = useState<{ name: string; unit: string; priceRange: string; defaultRemark: string }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 計算原總額
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  // 計算實際折扣金額
  const actualDiscount = discountType === 'percent' 
    ? Math.round(subtotal * discountPercent / 100) 
    : discount;
  
  // 計算最終總價
  const finalTotal = Math.max(0, subtotal - actualDiscount);

  // 按分類統計
  const categoryStats = CATEGORIES.map(cat => {
    const catItems = items.filter(item => item.category === cat);
    const catSubtotal = catItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
    return { category: cat, count: catItems.length, subtotal: catSubtotal };
  }).filter(s => s.count > 0);

  // 計算付款分期
  const calculatePaymentStages = () => {
    const plan = PAYMENT_PLANS.find(p => p.id === selectedPlan);
    if (!plan) return [];
    
    if (plan.id === '4') {
      if (customStages.length === 0) return [];
      const totalPercent = customStages.reduce((sum, s) => sum + s.percentage, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        return customStages.map(stage => ({
          ...stage,
          amount: finalTotal * stage.percentage / 100
        }));
      }
      
      return customStages.map((stage, idx) => ({
        ...stage,
        amount: finalTotal * stage.percentage / 100
      }));
    }
    
    const remarks = presetPlanRemarks[selectedPlan] || [];
    let remaining = finalTotal;
    return plan.stages.map((stage, idx) => {
      let amount: number;
      if (idx === plan.stages.length - 1) {
        amount = remaining;
      } else {
        amount = finalTotal * stage.percentage / 100;
        remaining -= amount;
      }
      return { ...stage, amount, remark: remarks[idx] || '' };
    });
  };

  const paymentStages = calculatePaymentStages();

  // 載入報價單列表
  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      let sql = `SELECT id, quote_no as quoteNo, customer_id as customerId, customer_name as customerName, phone, address, responsible, quote_date as quoteDate, items, discount, discount_item as discountItem, discount_type as discountType, discount_percent as discountPercent, payment_plan as paymentPlan, custom_stages as customStages, preset_plan_remarks as presetPlanRemarks, clauses, clauses_enabled as clausesEnabled, general_remark as generalRemark, bank_name as bankName, company_name as companyName, bank_account as bankAccount, fps_id as fpsId, subtotal, final_total as finalTotal, version, status, version_remark as versionRemark, parent_id as parentId, created_at as createdAt, updated_at as updatedAt FROM quote_history ORDER BY created_at DESC LIMIT 500`;
      const binds: (string | number)[] = [];
      
      if (filterStatus !== 'all') {
        sql = `SELECT id, quote_no as quoteNo, customer_id as customerId, customer_name as customerName, phone, address, responsible, quote_date as quoteDate, items, discount, discount_item as discountItem, discount_type as discountType, discount_percent as discountPercent, payment_plan as paymentPlan, custom_stages as customStages, preset_plan_remarks as presetPlanRemarks, clauses, clauses_enabled as clausesEnabled, general_remark as generalRemark, bank_name as bankName, company_name as companyName, bank_account as bankAccount, fps_id as fpsId, subtotal, final_total as finalTotal, version, status, version_remark as versionRemark, parent_id as parentId, created_at as createdAt, updated_at as updatedAt FROM quote_history WHERE status = ? ORDER BY created_at DESC LIMIT 500`;
        binds.push(filterStatus);
      }
      
      const result = await window.lingguang.db.query<QuoteRecord>({
        sql,
        binds,
      });
      
      if (result.success) {
        let data = result.data || [];
        
        // 關鍵詞搜索
        if (searchKeyword.trim()) {
          const kw = searchKeyword.trim().toLowerCase();
          data = data.filter(q => 
            q.customerName?.toLowerCase().includes(kw) ||
            q.address?.toLowerCase().includes(kw) ||
            q.quoteNo?.toLowerCase().includes(kw) ||
            q.phone?.includes(kw)
          );
        }
        
        setQuotes(data);
        
        // 計算統計
        const stats: Record<QuoteStatus, number> = {
          pending: 0, quoted: 0, signed: 0, constructing: 0, completed: 0, cancelled: 0,
        };
        data.forEach(q => {
          if (q.status && stats[q.status as QuoteStatus] !== undefined) {
            stats[q.status as QuoteStatus]++;
          }
        });
        setStatusStats(stats);
      }
    } catch (err) {
      console.error('載入報價列表失敗:', err);
    } finally {
      setQuotesLoading(false);
    }
  }, [filterStatus, searchKeyword]);

  // 初始載入
  useEffect(() => {
    if (view === 'list') {
      loadQuotes();
    }
  }, [view, filterStatus, loadQuotes]);

  // 驗證報價單
  const validateQuoteForSave = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!quoteInfo.customerName.trim()) errors.push('請填寫客戶姓名');
    if (items.length === 0) errors.push('請至少添加一個項目');
    if (selectedPlan === '4') {
      const total = customStages.reduce((sum, s) => sum + s.percentage, 0);
      if (Math.abs(total - 100) > 0.01) errors.push('自定義付款比例總和必須等於100%');
    }
    return { valid: errors.length === 0, errors };
  };

  // 保存報價
  const saveQuote = async () => {
    const { valid, errors } = validateQuoteForSave();
    if (!valid) {
      setSaveMessage('請修正以下問題：\n' + errors.join('\n'));
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    
    try {
      const now = Date.now();
      const id = currentQuoteId || `quote_${now}`;
      const quoteData = {
        id,
        quoteNo: quoteInfo.quoteNo,
        customerId: customerId || '',
        customerName: quoteInfo.customerName,
        phone: quoteInfo.phone,
        address: quoteInfo.address,
        responsible: quoteInfo.responsible,
        quoteDate: quoteInfo.date,
        items: JSON.stringify(items),
        discount,
        discountItem,
        discountType,
        discountPercent,
        paymentPlan: selectedPlan,
        customStages: JSON.stringify(customStages),
        presetPlanRemarks: JSON.stringify(presetPlanRemarks),
        clauses: JSON.stringify(clauses),
        clausesEnabled: clausesEnabled ? 1 : 0,
        generalRemark,
        bankName,
        companyName,
        bankAccount,
        fpsId,
        subtotal,
        finalTotal,
        version: currentVersion,
        status: currentStatus,
        versionRemark: versionRemark || '',
        parentId: parentId || '',
        createdAt: currentQuoteId ? undefined : now,
        updatedAt: now,
      };
      
      if (currentQuoteId) {
        const result = await window.lingguang.db.execute({
          sql: `UPDATE quote_history SET quote_no=?, customer_id=?, customer_name=?, phone=?, address=?, responsible=?, quote_date=?, items=?, discount=?, discount_item=?, discount_type=?, discount_percent=?, payment_plan=?, custom_stages=?, preset_plan_remarks=?, clauses=?, clauses_enabled=?, general_remark=?, bank_name=?, company_name=?, bank_account=?, fps_id=?, subtotal=?, final_total=?, version=?, status=?, version_remark=?, parent_id=?, updated_at=? WHERE id=?`,
          binds: [quoteData.quoteNo, quoteData.customerId, quoteData.customerName, quoteData.phone, quoteData.address, quoteData.responsible, quoteData.quoteDate, quoteData.items, quoteData.discount, quoteData.discountItem, quoteData.discountType, quoteData.discountPercent, quoteData.paymentPlan, quoteData.customStages, quoteData.presetPlanRemarks, quoteData.clauses, quoteData.clausesEnabled, quoteData.generalRemark, quoteData.bankName, quoteData.companyName, quoteData.bankAccount, quoteData.fpsId, quoteData.subtotal, quoteData.finalTotal, quoteData.version, quoteData.status, quoteData.versionRemark, quoteData.parentId, quoteData.updatedAt, id],
        });
        if (result.success) {
          setSaveMessage('報價已更新！');
          setCurrentQuoteId(id);
        } else {
          setSaveMessage('更新失敗：' + result.message);
        }
      } else {
        const result = await window.lingguang.db.execute({
          sql: `INSERT INTO quote_history (id, quote_no, customer_id, customer_name, phone, address, responsible, quote_date, items, discount, discount_item, discount_type, discount_percent, payment_plan, custom_stages, preset_plan_remarks, clauses, clauses_enabled, general_remark, bank_name, company_name, bank_account, fps_id, subtotal, final_total, version, status, version_remark, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          binds: [id, quoteData.quoteNo, quoteData.customerId, quoteData.customerName, quoteData.phone, quoteData.address, quoteData.responsible, quoteData.quoteDate, quoteData.items, quoteData.discount, quoteData.discountItem, quoteData.discountType, quoteData.discountPercent, quoteData.paymentPlan, quoteData.customStages, quoteData.presetPlanRemarks, quoteData.clauses, quoteData.clausesEnabled, quoteData.generalRemark, quoteData.bankName, quoteData.companyName, quoteData.bankAccount, quoteData.fpsId, quoteData.subtotal, quoteData.finalTotal, quoteData.version, quoteData.status, quoteData.versionRemark, quoteData.parentId, now, now],
        });
        if (result.success) {
          setSaveMessage('報價已保存！');
          setCurrentQuoteId(id);
        } else {
          setSaveMessage('保存失敗：' + result.message);
        }
      }
    } catch (err) {
      setSaveMessage('保存異常，請稍後重試');
      console.error(err);
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // 新建報價
  const newQuote = () => {
    setCurrentQuoteId(null);
    setCustomerId('');
    setQuoteInfo({
      quoteNo: generateQuoteNo(),
      date: getToday(),
      customerName: '',
      phone: '',
      address: '',
      responsible: '',
    });
    setItems([]);
    setDiscount(0);
    setDiscountItem('');
    setDiscountType('amount');
    setDiscountPercent(0);
    setSelectedPlan('1');
    setCustomStages([]);
    setPresetPlanRemarks({});
    setClauses([...DEFAULT_CLAUSES]);
    setClausesEnabled(true);
    setGeneralRemark('');
    setBankName('中國銀行（香港）');
    setCompanyName('Artisan Studio Limited');
    setBankAccount('012-586-2-109941-2');
    setFpsId('121966964');
    setCurrentVersion(1);
    setCurrentStatus('pending');
    setVersionRemark('');
    setParentId('');
    setView('edit');
  };

  // 載入報價單進行編輯
  const loadQuote = (record: QuoteRecord) => {
    setCurrentQuoteId(record.id);
    setCustomerId(record.customerId || '');
    setQuoteInfo({
      quoteNo: record.quoteNo,
      date: record.quoteDate,
      customerName: record.customerName,
      phone: record.phone,
      address: record.address,
      responsible: record.responsible,
    });
    try { setItems(JSON.parse(record.items || '[]')); } catch { setItems([]); }
    setDiscount(Number(record.discount) || 0);
    setDiscountItem(record.discountItem || '');
    setDiscountType((record.discountType as 'amount' | 'percent') || 'amount');
    setDiscountPercent(Number(record.discountPercent) || 0);
    setSelectedPlan(record.paymentPlan || '1');
    try { setCustomStages(JSON.parse(record.customStages || '[]')); } catch { setCustomStages([]); }
    try { setPresetPlanRemarks(JSON.parse(record.presetPlanRemarks || '{}')); } catch { setPresetPlanRemarks({}); }
    try { setClauses(JSON.parse(record.clauses || '[]')); } catch { setClauses([...DEFAULT_CLAUSES]); }
    setClausesEnabled(record.clausesEnabled === 1);
    setGeneralRemark(record.generalRemark || '');
    setBankName(record.bankName || '中國銀行（香港）');
    setCompanyName(record.companyName || 'Artisan Studio Limited');
    setBankAccount(record.bankAccount || '012-586-2-109941-2');
    setFpsId(record.fpsId || '121966964');
    setCurrentVersion(record.version || 1);
    setCurrentStatus((record.status as QuoteStatus) || 'pending');
    setVersionRemark(record.versionRemark || '');
    setParentId(record.parentId || '');
    setView('edit');
  };

  // 創建新版本
  const createNewVersion = async (record: QuoteRecord) => {
    const newQuoteNo = generateQuoteNo();
    const now = Date.now();
    const newId = `quote_${now}`;
    const newVersion = (record.version || 1) + 1;
    
    // 保存新版本
    const result = await window.lingguang.db.execute({
      sql: `INSERT INTO quote_history (id, quote_no, customer_id, customer_name, phone, address, responsible, quote_date, items, discount, discount_item, discount_type, discount_percent, payment_plan, custom_stages, preset_plan_remarks, clauses, clauses_enabled, general_remark, bank_name, company_name, bank_account, fps_id, subtotal, final_total, version, status, version_remark, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      binds: [newId, newQuoteNo, record.customerId || '', record.customerName, record.phone, record.address, record.responsible, getToday(), record.items, record.discount, record.discountItem || '', record.discountType || 'amount', record.discountPercent || 0, record.paymentPlan, record.customStages, record.presetPlanRemarks, record.clauses, record.clausesEnabled, record.generalRemark, record.bankName, record.companyName, record.bankAccount, record.fpsId, record.subtotal, record.finalTotal, newVersion, 'pending', '', record.id, now, now],
    });
    
    if (result.success) {
      // 載入新版本進行編輯
      loadQuote({
        ...record,
        id: newId,
        quoteNo: newQuoteNo,
        version: newVersion,
        status: 'pending',
        versionRemark: '',
        parentId: record.id,
        quoteDate: getToday(),
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  // 更新狀態
  const updateStatus = async (id: string, status: QuoteStatus) => {
    try {
      const result = await window.lingguang.db.execute({
        sql: `UPDATE quote_history SET status = ?, updated_at = ? WHERE id = ?`,
        binds: [status, Date.now(), id],
      });
      if (result.success) {
        loadQuotes();
      }
    } catch (err) {
      console.error('更新狀態失敗:', err);
    }
  };

  // 刪除報價
  const deleteQuote = async (id: string) => {
    try {
      const result = await window.lingguang.db.execute({
        sql: `DELETE FROM quote_history WHERE id = ?`,
        binds: [id],
      });
      if (result.success) {
        setDeleteMessage('報價單已成功刪除！');
        setTimeout(() => setDeleteMessage(''), 3000);
        loadQuotes();
        if (currentQuoteId === id) {
          setCurrentQuoteId(null);
        }
      } else {
        setDeleteMessage('刪除失敗：' + (result.message || '未知錯誤'));
        setTimeout(() => setDeleteMessage(''), 3000);
      }
    } catch (err) {
      console.error('刪除失敗:', err);
      setDeleteMessage('刪除異常，請稍後重試');
      setTimeout(() => setDeleteMessage(''), 3000);
    }
  };

  // 確認刪除
  const confirmDelete = () => {
    deleteQuote(deleteConfirm.quoteId);
    setDeleteConfirm({ show: false, quoteId: '', quoteName: '' });
  };

  // 保存設定到 localStorage
  const saveSettings = () => {
    const settings = { bankName, companyName, bankAccount, fpsId };
    localStorage.setItem('quote_settings', JSON.stringify(settings));
    setShowSettings(false);
  };

  // 載入設定
  const loadSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('quote_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.bankName) setBankName(settings.bankName);
        if (settings.companyName) setCompanyName(settings.companyName);
        if (settings.bankAccount) setBankAccount(settings.bankAccount);
        if (settings.fpsId) setFpsId(settings.fpsId);
      }
    } catch (err) {
      console.error('載入設定失敗:', err);
    }
  }, []);

  // 初始載入設定
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 載入自定義標準項目
  const loadCustomStandardItems = useCallback(() => {
    try {
      const saved = localStorage.getItem('customStandardItems');
      if (saved) {
        setCustomStandardItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error('載入自定義標準項目失敗', e);
    }
  }, []);

  // 保存自定義標準項目
  const saveCustomStandardItems = (items: Record<Category, { name: string; unit: string; priceRange: string; defaultRemark?: string }[]>) => {
    try {
      localStorage.setItem('customStandardItems', JSON.stringify(items));
      setCustomStandardItems(items);
    } catch (e) {
      console.error('保存自定義標準項目失敗', e);
    }
  };

  // 獲取當前使用的標準項目庫
  const getCurrentStandardItems = useCallback(() => {
    return customStandardItems || STANDARD_ITEMS;
  }, [customStandardItems]);

  // 初始載入自定義標準項目
  useEffect(() => {
    loadCustomStandardItems();
  }, [loadCustomStandardItems]);

  // 查看HTML源碼
  const viewHtmlSource = () => {
    const htmlContent = document.documentElement.outerHTML;
    setHtmlSource(htmlContent);
    setShowHtmlDebug(true);
  };

  // 構建文件系統結構
  const buildFileSystem = () => {
    return {
      'src': {
        name: 'src',
        displayName: '源代碼目錄',
        isDirectory: true,
        children: {
          'assets': {
            name: 'assets',
            displayName: '資源文件',
            isDirectory: true,
            children: {
              'resource_4c0f1c50.png': { name: 'resource_4c0f1c50.png', displayName: 'Logo 圖片', type: 'image/png' }
            }
          },
          'App.tsx': { name: 'App.tsx', displayName: '主應用組件', type: 'typescript' },
          'App.css': { name: 'App.css', displayName: '樣式文件', type: 'css' },
          'types.ts': { name: 'types.ts', displayName: '類型定義', type: 'typescript' },
          'main.tsx': { name: 'main.tsx', displayName: '入口文件', type: 'typescript' }
        }
      },
      'public': {
        name: 'public',
        displayName: '公共資源',
        isDirectory: true,
        children: {
          'sw.js': { name: 'sw.js', displayName: 'Service Worker', type: 'javascript' }
        }
      },
      'manifest.json': { name: 'manifest.json', displayName: '應用配置', type: 'json' },
      'package.json': { name: 'package.json', displayName: '依賴配置', type: 'json' }
    };
  };

  // 根據路徑獲取當前目錄內容
  const getFilesByPath = (pathParts: string[]) => {
    const fs = buildFileSystem();
    let current: any = fs;
    
    for (const part of pathParts) {
      if (current[part] && current[part].isDirectory && current[part].children) {
        current = current[part].children;
      } else {
        return [];
      }
    }
    
    const files: { name: string; path: string; size: number; type: string; isDirectory?: boolean }[] = [];
    
    for (const key of Object.keys(current)) {
      const item = current[key];
      const fullPath = [...pathParts, key].join('/');
      files.push({
        name: item.displayName || item.name,
        path: fullPath,
        size: 0,
        type: item.isDirectory ? 'folder' : item.type,
        isDirectory: item.isDirectory || false
      });
    }
    
    // 目錄排在前面，然後按名稱排序
    return files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, 'zh-TW');
    });
  };

  // 瀏覽應用文件
  const browseAppFiles = async () => {
    try {
      setCurrentBrowsePath([]);
      setBrowseHistory([[]]);
      setHistoryIndex(0);
      const files = getFilesByPath([]);
      setAppFiles(files);
      setFileBrowserPage(1);
      setShowFileBrowser(true);
    } catch (err) {
      console.error('瀏覽文件失敗:', err);
    }
  };

  // 進入目錄
  const enterDirectory = (dirPath: string) => {
    const newPath = [...currentBrowsePath, dirPath];
    const newHistory = browseHistory.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    
    setCurrentBrowsePath(newPath);
    setBrowseHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setAppFiles(getFilesByPath(newPath));
    setFileBrowserPage(1);
  };

  // 返回上一級目錄
  const goUpDirectory = () => {
    if (currentBrowsePath.length === 0) return;
    
    const newPath = currentBrowsePath.slice(0, -1);
    const newHistory = browseHistory.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    
    setCurrentBrowsePath(newPath);
    setBrowseHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setAppFiles(getFilesByPath(newPath));
    setFileBrowserPage(1);
  };

  // 歷史後退
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentBrowsePath(browseHistory[newIndex]);
      setAppFiles(getFilesByPath(browseHistory[newIndex]));
      setFileBrowserPage(1);
    }
  };

  // 歷史前進
  const goForward = () => {
    if (historyIndex < browseHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentBrowsePath(browseHistory[newIndex]);
      setAppFiles(getFilesByPath(browseHistory[newIndex]));
      setFileBrowserPage(1);
    }
  };

  // 下載單個文件
  const downloadSingleFile = async (file: { name: string; path: string; size: number; type: string }) => {
    try {
      let base64Data: string;
      let fileName: string;
      
      // 根據文件路徑獲取對應的內容
      if (file.path === 'src/assets/resource_4c0f1c50.png') {
        // 圖片文件：從 URL 獲取 base64
        fileName = 'resource_4c0f1c50.png';
        // logoImage 是 Vite 導入的 URL，需要轉換
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = logoImage;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          alert('無法創建畫布');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        base64Data = dataUrl.split(',')[1];
      } else if (file.path === 'src/App.tsx') {
        fileName = 'App.tsx';
        base64Data = btoa(unescape(encodeURIComponent(appTsxRaw)));
      } else if (file.path === 'src/App.css') {
        fileName = 'App.css';
        base64Data = btoa(unescape(encodeURIComponent(appCssRaw)));
      } else if (file.path === 'src/types.ts') {
        fileName = 'types.ts';
        base64Data = btoa(unescape(encodeURIComponent(typesRaw)));
      } else if (file.path === 'src/main.tsx') {
        fileName = 'main.tsx';
        base64Data = btoa(unescape(encodeURIComponent(mainTsxRaw)));
      } else if (file.path === 'manifest.json') {
        fileName = 'manifest.json';
        base64Data = btoa(unescape(encodeURIComponent(manifestRaw)));
      } else if (file.path === 'package.json') {
        fileName = 'package.json';
        base64Data = btoa(unescape(encodeURIComponent(packageJsonRaw)));
      } else if (file.path === 'public/sw.js') {
        fileName = 'sw.js';
        base64Data = btoa(unescape(encodeURIComponent(swJsRaw)));
      } else {
        alert('未知文件：' + file.path);
        return;
      }
      
      // 下載文件
      const result = await window.lingguang.saveFile({
        data: base64Data
      });
      
      if (result.success) {
        alert('下載成功：' + fileName);
      } else {
        alert('下載失敗');
      }
    } catch (err) {
      console.error('下載文件失敗:', err);
      alert('下載失敗：' + String(err));
    }
  };

  // 查看文件內容
  const viewFileContent = (file: { name: string; path: string; size: number; type: string }) => {
    let content = '';

    if (file.path === 'src/App.tsx') {
      content = appTsxRaw;
    } else if (file.path === 'src/App.css') {
      content = appCssRaw;
    } else if (file.path === 'src/types.ts') {
      content = typesRaw;
    } else if (file.path === 'src/main.tsx') {
      content = mainTsxRaw;
    } else if (file.path === 'manifest.json') {
      content = manifestRaw;
    } else if (file.path === 'package.json') {
      content = packageJsonRaw;
    } else if (file.path === 'public/sw.js') {
      content = swJsRaw;
    } else {
      alert('無法查看此文件');
      return;
    }

    setViewingFile({ name: file.name, path: file.path, content });
    setShowFileViewer(true);
  };

  // 一鍵下載應用（導出設定為 JSON 文件）
  const downloadAppAsZip = async () => {
    try {
      setDownloading(true);
      setDownloadProgress('正在準備文件...');
      
      // 構建設定文件內容
      const settings = {
        bankName,
        companyName,
        bankAccount,
        fpsId,
        exportDate: new Date().toISOString(),
        version: currentVersion,
        quotes: quotes.map(q => ({
          quoteNo: q.quoteNo,
          customerName: q.customerName,
          status: q.status,
          finalTotal: q.finalTotal
        }))
      };
      
      setDownloadProgress('正在下載...');
      
      // 將 JSON 轉為 Base64
      const jsonStr = JSON.stringify(settings, null, 2);
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
      
      // 下載文件
      const result = await window.lingguang.saveFile({
        data: base64
      });
      
      if (result.success) {
        setDownloadProgress('下載成功！');
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress('');
        }, 2000);
      } else {
        setDownloadProgress('下載失敗');
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress('');
        }, 3000);
      }
    } catch (err) {
      console.error('下載失敗:', err);
      setDownloadProgress('下載異常：' + String(err));
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress('');
      }, 3000);
    }
  };

  // 版本對比
  const loadCompareQuote = async (id: string) => {
    try {
      const result = await window.lingguang.db.query<QuoteRecord>({
        sql: `SELECT id, quote_no as quoteNo, customer_id as customerId, customer_name as customerName, phone, address, responsible, quote_date as quoteDate, items, discount, discount_item as discountItem, discount_type as discountType, discount_percent as discountPercent, payment_plan as paymentPlan, custom_stages as customStages, preset_plan_remarks as presetPlanRemarks, clauses, clauses_enabled as clausesEnabled, general_remark as generalRemark, bank_name as bankName, company_name as companyName, bank_account as bankAccount, fps_id as fpsId, subtotal, final_total as finalTotal, version, status, version_remark as versionRemark, parent_id as parentId, created_at as createdAt, updated_at as updatedAt FROM quote_history WHERE id = ? LIMIT 1`,
        binds: [id],
      });
      if (result.success && result.data && result.data.length > 0) {
        setCompareData(result.data[0]);
        setCompareQuoteId(id);
      }
    } catch (err) {
      console.error('載入對比報價失敗:', err);
    }
  };

  // 獲取同一客戶的所有版本
  const getCustomerVersions = (customerId: string, customerName: string): QuoteRecord[] => {
    return quotes.filter(q => q.customerId === customerId || (q.customerName === customerName && customerName));
  };

  // 新增項目行
  const addItem = () => {
    const newItem: QuoteItem = {
      id: generateId(),
      category: '打拆工程',
      name: '',
      unit: '項',
      quantity: 1,
      unitPrice: 0,
      remark: '',
      isReimburse: false,
    };
    setItems([...items, newItem]);
  };

  // 刪除項目行
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // 更新項目
  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // 從標準庫插入項目
  const insertFromLibrary = (category: Category, libItem: { name: string; unit: string; priceRange: string; defaultRemark?: string }) => {
    const priceRange = libItem.priceRange;
    let price = 0;
    const cleanRange = priceRange.replace(/起$/g, '');
    if (cleanRange.includes('-')) {
      const parts = cleanRange.split('-');
      price = parseInt(parts[0], 10) || 0;
    } else {
      price = parseInt(cleanRange, 10) || 0;
    }
    
    const newItem: QuoteItem = {
      id: generateId(),
      category,
      name: libItem.name,
      unit: libItem.unit,
      quantity: 1,
      unitPrice: price,
      remark: libItem.defaultRemark || '',
      isReimburse: false,
    };
    setItems([...items, newItem]);
  };

  // 清除所有項目
  const clearAllItems = () => {
    setItems([]);
  };

  // 驗證報價單
  const validateQuote = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!quoteInfo.customerName.trim()) errors.push('請填寫客戶姓名');
    if (items.length === 0) errors.push('請至少添加一個項目');
    if (selectedPlan === '4') {
      const total = customStages.reduce((sum, s) => sum + s.percentage, 0);
      if (Math.abs(total - 100) > 0.01) errors.push('自定義付款比例總和必須等於100%');
    }
    return { valid: errors.length === 0, errors };
  };

  // 複製報價單全文
  const copyQuoteText = () => {
    const stageTexts = paymentStages.map(s => {
      const remarkText = s.remark ? ` 備註：${s.remark}` : '';
      return `${s.name}: ${formatMoney(s.amount)} (${s.percentage}%)${remarkText}`;
    }).join('\n');
    
    let itemTexts = '';
    categoryStats.forEach(cs => {
      const catItems = items.filter(i => i.category === cs.category);
      itemTexts += `\n\n【${cs.category}】(${cs.count}項，小計: ${formatMoney(cs.subtotal)})\n` + 
        catItems.map((item, idx) => {
          const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
          const reimburse = item.isReimburse ? ' (實報實銷)' : '';
          return `  ${idx + 1}. ${item.name} - ${item.unit} x ${item.quantity} = ${formatMoney(itemSubtotal)}${reimburse}`;
        }).join('\n');
    });

    const text = `
========================================
         報價單 (V${currentVersion})
========================================
報價單號: ${quoteInfo.quoteNo}
日期: ${quoteInfo.date}
狀態: ${STATUS_CONFIG[currentStatus].label}

客戶姓名: ${quoteInfo.customerName}
聯絡電話: ${quoteInfo.phone}
物業地址: ${quoteInfo.address}
負責人: ${quoteInfo.responsible}

========================================
項目清單
========================================${itemTexts}

========================================
金額匯總
========================================
原價總計: ${formatMoney(subtotal)}
${actualDiscount > 0 ? `${discountItem ? `折扣（${discountItem}）` : '折扣'}${discountType === 'percent' ? ` ${discountPercent}%` : ''}: -${formatMoney(actualDiscount)}\n` : ''}最終總價: ${formatMoney(finalTotal)}

========================================
付款明細
========================================
${stageTexts}

========================================
備註
========================================
${generalRemark || '(無)'}

${clausesEnabled ? `========================================
合約條款
========================================
${clauses.join('\n')}` : ''}

========================================
頁腳資訊
========================================
銀行名稱: ${bankName}                 公司名稱: ${companyName}
公司帳號: ${bankAccount}          FPS ID: ${fpsId}

========================================
簽署欄
========================================
客戶簽署: _________________ 日期: ________

公司簽署: _________________ 日期: ________
`;

    navigator.clipboard.writeText(text);
    alert('已複製到剪貼板');
  };

  // 打印報價單
  const printQuote = () => {
    window.print();
  };

  // 導出 Excel
  const exportExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();
      
      const infoData = [
        ['報價單號', quoteInfo.quoteNo],
        ['版本', `V${currentVersion}`],
        ['狀態', STATUS_CONFIG[currentStatus].label],
        ['日期', quoteInfo.date],
        ['客戶姓名', quoteInfo.customerName],
        ['聯絡電話', quoteInfo.phone],
        ['物業地址', quoteInfo.address],
        ['負責人', quoteInfo.responsible],
        [],
        ['銀行名稱', bankName],
        ['公司名稱', companyName],
        ['公司帳號', bankAccount],
        ['FPS ID', fpsId],
      ];
      const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
      XLSX.utils.book_append_sheet(wb, wsInfo, '基本資訊');
      
      const itemsHeader = ['分類', '項目編號', '項目名稱', '單位', '數量', '單價(HKD)', '小計(HKD)', '實報實銷', '備註'];
      const itemsData: (string | number | boolean)[][] = [itemsHeader];
      
      CATEGORIES.forEach(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (catItems.length > 0) {
          catItems.forEach((item, idx) => {
            const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            itemsData.push([
              cat,
              idx + 1,
              item.name,
              item.unit,
              Number(item.quantity) || 0,
              Number(item.unitPrice) || 0,
              itemSubtotal,
              item.isReimburse ? '是' : '否',
              item.remark || '',
            ]);
          });
        }
      });
      
      itemsData.push([]);
      itemsData.push(['', '', '', '', '', '原價總計:', subtotal]);
      if (actualDiscount > 0) {
        const discountLabel = discountType === 'percent' 
          ? `折扣 (${discountPercent}%)` 
          : '折扣';
        itemsData.push(['', '', '', '', '', discountLabel + (discountItem ? `（${discountItem}）` : '') + ':', -actualDiscount]);
      }
      itemsData.push(['', '', '', '', '', '最終總價:', finalTotal]);
      
      const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, wsItems, '項目清單');
      
      const paymentData = [['期數', '比例', '金額(HKD)', '備註']];
      paymentStages.forEach(stage => {
        paymentData.push([stage.name, `${stage.percentage}%`, String(stage.amount || 0), stage.remark || '']);
      });
      const wsPayment = XLSX.utils.aoa_to_sheet(paymentData);
      XLSX.utils.book_append_sheet(wb, wsPayment, '付款明細');
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      
      const result = await window.lingguang.saveFile({
        data: wbout,
      });
      
      if (result.success) {
        alert('導出成功！');
      }
    } catch (err) {
      console.error('導出失敗:', err);
      alert('導出失敗');
    }
  };

  // 渲染列表視圖
  const renderListView = () => (
    <div className="max-w-6xl mx-auto p-4">
      {/* 統計卡片 */}
      <section className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(status => (
          <div
            key={status}
            className="p-3 rounded-xl text-center"
            style={{ 
              backgroundColor: STATUS_CONFIG[status].bgColor,
              color: STATUS_CONFIG[status].color,
            }}
          >
            <div className="text-2xl font-bold">{statusStats[status]}</div>
            <div className="text-xs mt-1">{STATUS_CONFIG[status].label}</div>
          </div>
        ))}
      </section>

      {/* 搜索和操作區 */}
      <section className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">訂單狀態：</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as QuoteStatus | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[140px]"
            >
              <option value="all">全部狀態</option>
              {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(status => (
                <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadQuotes()}
              placeholder="搜索客戶姓名 / 地址 / 報價單號 / 電話"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={loadQuotes}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            <span className="material-icons text-sm align-middle">search</span>
            搜索
          </button>
          <button
            type="button"
            onClick={newQuote}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
          >
            <span className="material-icons text-sm">add</span>
            新增報價單
          </button>
        </div>
      </section>

      {/* 報價單列表 */}
      <section className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="material-icons text-blue-600">description</span>
            報價單列表
            {filterStatus !== 'all' && (
              <span className="text-sm font-normal text-gray-500">
                - 篩選: {STATUS_CONFIG[filterStatus as QuoteStatus].label}
              </span>
            )}
          </h2>
        </div>

        {quotesLoading ? (
          <div className="text-center py-12 text-gray-500">
            <span className="material-icons animate-spin text-3xl">refresh</span>
            <p className="mt-2">載入中...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <span className="material-icons text-5xl">folder_open</span>
            <p className="mt-2">暫無報價單記錄</p>
            <button
              type="button"
              onClick={newQuote}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              創建第一份報價單
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {quotes.map(quote => {
              const versions = getCustomerVersions(quote.customerId, quote.customerName);
              const hasMultipleVersions = versions.length > 1;
              
              return (
                <div key={quote.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 text-lg">{quote.customerName || '未命名客戶'}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: STATUS_CONFIG[quote.status as QuoteStatus]?.bgColor || '#F3F4F6',
                            color: STATUS_CONFIG[quote.status as QuoteStatus]?.color || '#6B7280'
                          }}
                        >
                          {STATUS_CONFIG[quote.status as QuoteStatus]?.label || quote.status}
                        </span>
                        {quote.version > 1 && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            V{quote.version}
                          </span>
                        )}
                        {hasMultipleVersions && quote.version === Math.max(...versions.map(v => v.version)) && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                            最新版
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 truncate">{quote.address || '無地址'}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{quote.quoteNo}</span>
                        <span>{quote.quoteDate}</span>
                        {quote.phone && <span>{quote.phone}</span>}
                        <span>{quote.items ? JSON.parse(quote.items).length : 0} 項目</span>
                      </div>
                      {quote.versionRemark && (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          修改原因: {quote.versionRemark}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-xl text-green-600">{formatMoney(Number(quote.finalTotal) || 0)}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {quote.updatedAt ? new Date(quote.updatedAt).toLocaleDateString('zh-TW') : ''}
                      </div>
                    </div>
                  </div>
                  
                  {/* 版本列表 */}
                  {hasMultipleVersions && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">版本歷史 ({versions.length}個版本):</div>
                      <div className="flex flex-wrap gap-2">
                        {versions.sort((a, b) => b.version - a.version).map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => loadQuote(v)}
                            className={`px-2 py-1 rounded text-xs ${v.id === quote.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            V{v.version} - {formatMoney(Number(v.finalTotal) || 0)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 操作按鈕 */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); loadQuote(quote); }}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); createNewVersion(quote); }}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      新建版本
                    </button>
                    <select
                      value={quote.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); updateStatus(quote.id, e.target.value as QuoteStatus); }}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ show: true, quoteId: quote.id, quoteName: quote.customerName || '未命名客戶' });
                      }}
                      className="px-4 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 刪除消息提示 */}
      {deleteMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg bg-green-500 text-white font-medium">
          {deleteMessage}
        </div>
      )}

      {/* 刪除確認彈窗 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-icons text-4xl text-red-600">warning</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">確認刪除</h3>
              <p className="text-gray-600 mb-1">確定要刪除此報價單嗎？</p>
              <p className="text-gray-800 font-medium mb-6">{deleteConfirm.quoteName}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ show: false, quoteId: '', quoteName: '' })}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  確認刪除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 設定面板 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="material-icons text-blue-600">settings</span>
                系統設定
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">銀行名稱</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="請輸入銀行名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">公司名稱</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="請輸入公司名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">公司帳號</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="請輸入公司帳號"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">FPS ID</label>
                <input
                  type="text"
                  value={fpsId}
                  onChange={(e) => setFpsId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="請輸入 FPS ID"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setShowSettings(false); setView('standardItems'); }}
                className="w-full mb-2 px-4 py-3 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 flex items-center justify-center gap-2"
              >
                <span className="material-icons text-lg">inventory_2</span>
                管理標準項目庫
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={viewHtmlSource}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
                >
                  <span className="material-icons text-sm">code</span>
                  HTML 源碼
                </button>
                <button
                  type="button"
                  onClick={browseAppFiles}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
                >
                  <span className="material-icons text-sm">folder_open</span>
                  瀏覽文件
                </button>
              </div>
              <button
                type="button"
                onClick={downloadAppAsZip}
                disabled={downloading}
                className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span className="material-icons text-sm">download</span>
                {downloading ? downloadProgress : '一鍵下載應用'}
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                保存設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML 源碼檢視彈窗 */}
      {showHtmlDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="material-icons text-purple-600">code</span>
                HTML 源碼檢視 (Debug)
              </h3>
              <button
                type="button"
                onClick={() => setShowHtmlDebug(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-xs whitespace-pre-wrap break-all">{htmlSource}</pre>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(htmlSource);
                  alert('已複製到剪貼板');
                }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons text-sm">content_copy</span>
                複製源碼
              </button>
              <button
                type="button"
                onClick={() => setShowHtmlDebug(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文件瀏覽器彈窗 */}
      {showFileBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="material-icons text-amber-600">folder_open</span>
                應用文件瀏覽器
              </h3>
              <button
                type="button"
                onClick={() => setShowFileBrowser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            {/* 導航工具欄 */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              {/* 歷史後退按鈕 */}
              <button
                type="button"
                onClick={goBack}
                disabled={historyIndex <= 0}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="後退"
              >
                <span className="material-icons text-gray-600">arrow_back</span>
              </button>
              {/* 歷史前進按鈕 */}
              <button
                type="button"
                onClick={goForward}
                disabled={historyIndex >= browseHistory.length - 1}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="前進"
              >
                <span className="material-icons text-gray-600">arrow_forward</span>
              </button>
              {/* 返回上一級按鈕 */}
              <button
                type="button"
                onClick={goUpDirectory}
                disabled={currentBrowsePath.length === 0}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                title="返回上一級"
              >
                <span className="material-icons text-gray-600">arrow_upward</span>
              </button>
              {/* 路徑顯示 */}
              <div className="flex-1 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    const newHistory = browseHistory.slice(0, historyIndex + 1);
                    newHistory.push([]);
                    setCurrentBrowsePath([]);
                    setBrowseHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                    setAppFiles(getFilesByPath([]));
                    setFileBrowserPage(1);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-blue-600 font-medium"
                >
                  <span className="material-icons text-sm">home</span>
                  根目錄
                </button>
                {currentBrowsePath.map((part, idx) => (
                  <div key={idx} className="flex items-center">
                    <span className="material-icons text-gray-400 text-sm">chevron_right</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newPath = currentBrowsePath.slice(0, idx + 1);
                        const newHistory = browseHistory.slice(0, historyIndex + 1);
                        newHistory.push(newPath);
                        setCurrentBrowsePath(newPath);
                        setBrowseHistory(newHistory);
                        setHistoryIndex(newHistory.length - 1);
                        setAppFiles(getFilesByPath(newPath));
                        setFileBrowserPage(1);
                      }}
                      className="px-2 py-1 rounded hover:bg-gray-100 text-blue-600"
                    >
                      {part === 'src' ? '源代碼' : part === 'public' ? '公共資源' : part === 'assets' ? '資源文件' : part}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">文件名稱</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">類型</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appFiles.slice((fileBrowserPage - 1) * filesPerPage, fileBrowserPage * filesPerPage).map((file, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => file.isDirectory && enterDirectory(file.path.split('/').pop() || '')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-lg">
                            {file.isDirectory ? 'folder' : file.type.includes('image') ? 'image' : file.type === 'typescript' ? 'code' : file.type === 'javascript' ? 'javascript' : file.type === 'json' ? 'settings' : 'description'}
                          </span>
                          <span className={file.isDirectory ? 'text-blue-600 font-medium' : ''}>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${file.isDirectory ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{file.isDirectory ? '資料夾' : file.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        {file.isDirectory ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); enterDirectory(file.path.split('/').pop() || ''); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            <span className="material-icons text-sm">folder_open</span>
                            進入
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); viewFileContent(file); }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                            >
                              <span className="material-icons text-sm">visibility</span>
                              查看
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); downloadSingleFile(file); }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              <span className="material-icons text-sm">download</span>
                              下載
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 分頁控制 */}
            {appFiles.length > filesPerPage && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  第 {fileBrowserPage} 頁，共 {Math.ceil(appFiles.length / filesPerPage)} 頁（{appFiles.length} 個文件）
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFileBrowserPage(prev => Math.max(1, prev - 1))}
                    disabled={fileBrowserPage === 1}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span className="material-icons text-sm">chevron_left</span>
                    上一頁
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileBrowserPage(prev => Math.min(Math.ceil(appFiles.length / filesPerPage), prev + 1))}
                    disabled={fileBrowserPage >= Math.ceil(appFiles.length / filesPerPage)}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    下一頁
                    <span className="material-icons text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">
                共 {appFiles.length} 個文件，每頁顯示 {filesPerPage} 個。點擊「一鍵下載」可將整個應用壓縮為 ZIP 文件。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFileBrowser(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  關閉
                </button>
                <button
                  type="button"
                  onClick={() => { setShowFileBrowser(false); downloadAppAsZip(); }}
                  disabled={downloading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-icons text-sm">download</span>
                  {downloading ? downloadProgress : '一鍵下載'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 文件內容查看彈窗 */}
      {showFileViewer && viewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="material-icons text-blue-600">code</span>
                {viewingFile.name}
              </h3>
              <button
                type="button"
                onClick={() => { setShowFileViewer(false); setViewingFile(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="text-sm text-gray-500 mb-3 font-mono">{viewingFile.path}</div>
            <div className="flex-1 overflow-auto bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all">{viewingFile.content}</pre>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingFile.content);
                  alert('已複製到剪貼板');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <span className="material-icons text-sm">content_copy</span>
                複製內容
              </button>
              <button
                type="button"
                onClick={() => { setShowFileViewer(false); setViewingFile(null); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染編輯視圖
  const renderEditView = () => (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* 版本和狀態信息 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">版本</label>
              <div className="text-lg font-bold text-purple-600">V{currentVersion}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">狀態</label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as QuoteStatus)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          {currentVersion > 1 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-600 mb-1">版本修改原因</label>
              <input
                type="text"
                value={versionRemark}
                onChange={(e) => setVersionRemark(e.target.value)}
                placeholder="例如：客減預算、加傢加傢俬、刪除門"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </section>

      {/* 基礎資訊區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-blue-600">info</span>
          基礎資訊
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">報價單號</label>
            <MobileInputBridge
              value={quoteInfo.quoteNo}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, quoteNo: v })}
              dataTestId="quote-no-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">報價日期</label>
            <MobileInputBridge
              type="date"
              value={quoteInfo.date}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, date: v })}
              dataTestId="quote-date-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">客戶姓名 *</label>
            <MobileInputBridge
              value={quoteInfo.customerName}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, customerName: v })}
              placeholder="請輸入客戶姓名"
              dataTestId="customer-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">聯絡電話</label>
            <MobileInputBridge
              value={quoteInfo.phone}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, phone: v })}
              placeholder="請輸入電話"
              dataTestId="phone-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">物业地址</label>
            <MobileInputBridge
              value={quoteInfo.address}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, address: v })}
              placeholder="請輸入物业地址"
              dataTestId="address-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">負責人</label>
            <MobileInputBridge
              value={quoteInfo.responsible}
              onChange={(v) => setQuoteInfo({ ...quoteInfo, responsible: v })}
              placeholder="請輸入負責人姓名"
              dataTestId="responsible-input"
            />
          </div>
        </div>
      </section>

      {/* 項目列表區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="material-icons text-green-600">list_alt</span>
            項目列表
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-blue-700"
              data-testid="add-item-btn"
            >
              <span className="material-icons text-sm">add</span>
              新增行
            </button>
            <button
              type="button"
              onClick={clearAllItems}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              data-testid="clear-items-btn"
            >
              清空
            </button>
          </div>
        </div>

        {/* 項目庫快捷入口 - 每個分類獨立下拉選單 */}
        <div className="mb-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-sm text-amber-800 mb-3">📚 快速插入標準項目：</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {CATEGORIES.map(cat => {
              const items = getCurrentStandardItems()[cat] || [];
              return (
                <select
                  key={cat}
                  onChange={(e) => {
                    const idx = e.target.value;
                    if (!idx) return;
                    const item = items[parseInt(idx, 10)];
                    if (item) {
                      insertFromLibrary(cat, item);
                    }
                    e.target.value = '';
                  }}
                  className="px-2 py-1.5 border border-amber-300 rounded-lg text-xs bg-white hover:border-amber-400 focus:border-amber-500 focus:outline-none"
                  defaultValue=""
                >
                  <option value="">{cat}</option>
                  {items.map((item, idx) => (
                    <option key={idx} value={idx}>
                      {item.name}
                    </option>
                  ))}
                </select>
              );
            })}
          </div>
        </div>

        {/* 項目表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-8">#</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-24">分類</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">項目名稱</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-16">數量</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-16">單位</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-20">單價(HKD)</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-20">小計(HKD)</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600 w-16">實報實銷</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">備註</th>
                <th className="px-2 py-2 text-center font-medium text-gray-600 w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-8 text-center text-gray-400">
                    尚未添加項目，點擊「新增行」或從上方項目庫插入
                  </td>
                </tr>
              ) : items.map((item, idx) => {
                const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value as Category)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        data-testid={`category-select-${idx}`}
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        placeholder="項目名稱"
                        data-testid={`item-name-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        min="0"
                        data-testid={`item-quantity-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        data-testid={`item-unit-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        min="0"
                        data-testid={`item-price-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2 font-medium text-right">
                      {formatMoney(itemSubtotal)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.isReimburse}
                        onChange={(e) => updateItem(item.id, 'isReimburse', e.target.checked)}
                        className="rounded"
                        title="標記為實報實銷"
                        data-testid={`item-reimburse-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={item.remark}
                        onChange={(e) => updateItem(item.id, 'remark', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs"
                        placeholder="備註"
                        data-testid={`item-remark-${idx}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`delete-item-${idx}`}
                      >
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.some(i => i.isReimburse) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-orange-600">
              ⚠️ 已標記 {items.filter(i => i.isReimburse).length} 項為「實報實銷」
            </span>
          </div>
        )}
      </section>

      {/* 折扣區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-red-600">local_offer</span>
          折扣設定
        </h2>
        
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">折扣項目（選填）</label>
              <select
                value={discountItem}
                onChange={(e) => setDiscountItem(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                data-testid="discount-item-select"
              >
                <option value="">-- 選擇項目或輸入自訂 --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} ({formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">折扣類型</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percent')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                data-testid="discount-type-select"
              >
                <option value="amount">固定金額</option>
                <option value="percent">百分比</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {discountType === 'amount' ? '折扣金額 (HKD)' : '折扣百分比 (%)'}
              </label>
              <input
                type="number"
                value={discountType === 'amount' ? (discount || '') : (discountPercent || '')}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (discountType === 'amount') {
                    setDiscount(Math.min(val, subtotal));
                  } else {
                    setDiscountPercent(Math.min(val, 100));
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder={discountType === 'amount' ? '輸入折扣金額' : '輸入折扣百分比'}
                min="0"
                max={discountType === 'amount' ? subtotal : 100}
                data-testid="discount-value-input"
              />
            </div>
          </div>
          
          {actualDiscount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <span className="material-icons text-red-500 text-sm">info</span>
              <span className="text-sm text-red-700">
                {discountItem ? `項目「${discountItem}」` : '整體'}折扣：
                {discountType === 'percent' ? ` ${discountPercent}% ` : ''}
                -{formatMoney(actualDiscount)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 金額匯總區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-purple-600">calculate</span>
          金額匯總
        </h2>
        
        {categoryStats.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">分類小計：</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {categoryStats.map(cs => (
                <div key={cs.category} className="flex justify-between text-sm">
                  <span className="text-gray-600">{cs.category} ({cs.count}項)</span>
                  <span className="font-medium">{formatMoney(cs.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 px-4">
            <span className="text-gray-600">原價總計</span>
            <span className="font-medium">{formatMoney(subtotal)}</span>
          </div>
          {actualDiscount > 0 && (
            <div className="flex justify-between items-center py-2 px-4 bg-red-50 rounded-lg">
              <span className="text-red-600">
                {discountItem ? `折扣（${discountItem}）` : '折扣'}
                {discountType === 'percent' && ` ${discountPercent}%`}
              </span>
              <span className="font-medium text-red-600">-{formatMoney(actualDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 bg-green-50 rounded-lg px-4 border-t-2 border-green-200">
            <span className="font-semibold text-green-800">最終總價</span>
            <span className="font-bold text-xl text-green-700">{formatMoney(finalTotal)}</span>
          </div>
        </div>
      </section>

      {/* 收款結算區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-orange-600">payment</span>
          收款結算
        </h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">選擇付款方案</label>
          <select
            value={selectedPlan}
            onChange={(e) => {
              setSelectedPlan(e.target.value);
              if (e.target.value === '4') {
                setCustomStages([
                  { name: '第一期', percentage: 50, remark: '' },
                  { name: '第二期', percentage: 50, remark: '' },
                ]);
              }
            }}
            className="w-full px-3 py-2 border rounded-lg"
            data-testid="payment-plan-select"
          >
            {PAYMENT_PLANS.map(plan => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>

        {selectedPlan === '4' && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">自定義付款比例（總和需等於100%）：</p>
            {customStages.map((stage, idx) => (
              <div key={idx} className="mb-3">
                <div className="flex gap-2 mb-1">
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => {
                      const newStages = [...customStages];
                      newStages[idx].name = e.target.value;
                      setCustomStages(newStages);
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="期數名稱"
                  />
                  <input
                    type="number"
                    value={stage.percentage}
                    onChange={(e) => {
                      const newStages = [...customStages];
                      newStages[idx].percentage = parseFloat(e.target.value) || 0;
                      setCustomStages(newStages);
                    }}
                    className="w-20 px-2 py-1 border rounded text-sm text-right"
                    min="0"
                    max="100"
                  />
                  <span className="flex items-center text-sm">%</span>
                  <button
                    type="button"
                    onClick={() => setCustomStages(customStages.filter((_, i) => i !== idx))}
                    className="text-red-500"
                  >
                    <span className="material-icons text-sm">remove_circle</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const newStages = [...customStages];
                        newStages[idx].remark = e.target.value;
                        setCustomStages(newStages);
                      }
                    }}
                    className="px-2 py-1 border rounded text-sm bg-white text-gray-600 cursor-pointer hover:border-blue-400"
                  >
                    <option value="">快速選擇...</option>
                    <option value="簽約">簽約</option>
                    <option value="確認施工圖">確認施工圖</option>
                    <option value="傢俬出貨前">傢俬出貨前</option>
                    <option value="進場前">進場前</option>
                    <option value="泥水進場前">泥水進場前</option>
                    <option value="油漆進場前">油漆進場前</option>
                    <option value="清潔進場前">清潔進場前</option>
                    <option value="交匙後一個月">交匙後一個月</option>
                  </select>
                  <input
                    type="text"
                    value={stage.remark || ''}
                    onChange={(e) => {
                      const newStages = [...customStages];
                      newStages[idx].remark = e.target.value;
                      setCustomStages(newStages);
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="或手動輸入備註"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCustomStages([...customStages, { name: `第${customStages.length + 1}期`, percentage: 0, remark: '' }])}
              className="text-sm text-blue-600 flex items-center gap-1"
            >
              <span className="material-icons text-sm">add</span> 新增期數
            </button>
            <p className="text-xs mt-2 text-gray-500">
              當前總和: {customStages.reduce((s, st) => s + st.percentage, 0)}%
              {Math.abs(customStages.reduce((s, st) => s + st.percentage, 0) - 100) > 0.01 && 
                <span className="text-red-500 ml-2">（需調整為100%）</span>}
            </p>
          </div>
        )}

        {selectedPlan !== '4' && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-800 mb-2">各期備註（選填）：</p>
            {PAYMENT_PLANS.find(p => p.id === selectedPlan)?.stages.map((stage, idx) => {
              const REMARK_OPTIONS = [
                '簽約',
                '確認施工圖',
                '傢俬出貨前',
                '進場前',
                '泥水進場前',
                '油漆進場前',
                '清潔進場前',
                '交匙後一個月',
              ];
              return (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-700 w-20">{stage.name}</span>
                  <span className="text-sm text-gray-500 w-12">{stage.percentage}%</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const currentRemarks = presetPlanRemarks[selectedPlan] || [];
                        const newRemarks = [...currentRemarks];
                        newRemarks[idx] = e.target.value;
                        setPresetPlanRemarks({
                          ...presetPlanRemarks,
                          [selectedPlan]: newRemarks,
                        });
                      }
                    }}
                    className="px-2 py-1 border rounded text-sm bg-white text-gray-600 cursor-pointer hover:border-amber-400"
                  >
                    <option value="">快速選擇...</option>
                    {REMARK_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={presetPlanRemarks[selectedPlan]?.[idx] || ''}
                    onChange={(e) => {
                      const currentRemarks = presetPlanRemarks[selectedPlan] || [];
                      const newRemarks = [...currentRemarks];
                      newRemarks[idx] = e.target.value;
                      setPresetPlanRemarks({
                        ...presetPlanRemarks,
                        [selectedPlan]: newRemarks,
                      });
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="或手動輸入備註"
                  />
                </div>
              );
            })}
          </div>
        )}

        {paymentStages.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">付款明細：</p>
            {paymentStages.map((stage, idx) => (
              <div key={idx} className="py-2 px-3 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{stage.name}</span>
                  <span className="text-sm text-gray-500">{stage.percentage}%</span>
                  <span className="font-medium">{formatMoney(stage.amount)}</span>
                </div>
                {stage.remark && (
                  <p className="text-xs text-gray-500 mt-1">備註：{stage.remark}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 備註區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-gray-600">note</span>
          整體備註
        </h2>
        <textarea
          value={generalRemark}
          onChange={(e) => setGeneralRemark(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={3}
          placeholder="請輸入整體備註（選填）"
          data-testid="general-remark-input"
        />
      </section>

      {/* 合約條款區 */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="material-icons text-red-600">gavel</span>
            合約條款
          </h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={clausesEnabled}
              onChange={(e) => setClausesEnabled(e.target.checked)}
              className="rounded"
              data-testid="clauses-enabled-checkbox"
            />
            <span className="text-sm text-gray-600">啟用條款</span>
          </label>
        </div>
        
        {clausesEnabled && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {clauses.map((clause, idx) => (
              <p key={idx} className="text-sm text-gray-700">{clause}</p>
            ))}
          </div>
        )}
      </section>

      {/* 操作按鈕 */}
      <div className="sticky bottom-4 flex gap-3">
        <button
          type="button"
          onClick={() => setView('list')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300"
        >
          返回列表
        </button>
        <button
          type="button"
          onClick={saveQuote}
          className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-amber-600 shadow-lg"
        >
          <span className="material-icons">save</span>
          保存
        </button>
        <button
          type="button"
          onClick={() => {
            const { valid, errors } = validateQuote();
            if (!valid) {
              alert('請修正以下問題：\n' + errors.join('\n'));
              return;
            }
            setView('preview');
          }}
          className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-700 shadow-lg"
          data-testid="generate-quote-btn"
        >
          <span className="material-icons">description</span>
          生成報價單
        </button>
      </div>
    </div>
  );

  // 渲染預覽視圖
  const renderPreviewView = () => (
    <div className="max-w-4xl mx-auto p-4">
      {/* 操作按鈕 */}
      <div className="flex gap-2 mb-4 print:hidden">
        <button
          type="button"
          onClick={() => setView('edit')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <span className="material-icons text-sm">arrow_back</span>
          返回編輯
        </button>
        <button
          type="button"
          onClick={printQuote}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
          data-testid="print-quote-btn"
        >
          <span className="material-icons text-sm">print</span>
          列印/導出PDF
        </button>
        <button
          type="button"
          onClick={exportExcel}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <span className="material-icons text-sm">table_chart</span>
          導出Excel
        </button>
      </div>

      {/* 報價單內容 */}
      <div className="bg-white p-6 shadow-lg print:shadow-none print:p-0" id="quote-content" style={{ fontFamily: '"Microsoft YaHei", "微軟正黑體", sans-serif' }}>
        {/* 頭部 */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Logo" className="h-14 w-auto object-contain" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-wide">{companyName}</h1>
                <p className="text-xs text-gray-500">QUOTATION</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>報價單號：<span className="font-medium">{quoteInfo.quoteNo}</span></p>
              <p>版本：<span className="font-medium">V{currentVersion}</span></p>
              <p>日期：<span className="font-medium">{quoteInfo.date}</span></p>
              <p>
                狀態：
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium ml-1"
                  style={{ 
                    backgroundColor: STATUS_CONFIG[currentStatus].bgColor,
                    color: STATUS_CONFIG[currentStatus].color
                  }}
                >
                  {STATUS_CONFIG[currentStatus].label}
                </span>
              </p>
            </div>
          </div>

          {/* 客戶資訊表格 */}
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-3 py-2 w-24 font-medium">客戶姓名</td>
                <td className="border border-gray-300 px-3 py-2">{quoteInfo.customerName}</td>
                <td className="border border-gray-300 bg-gray-100 px-3 py-2 w-24 font-medium">聯絡電話</td>
                <td className="border border-gray-300 px-3 py-2">{quoteInfo.phone}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-3 py-2 font-medium">物業地址</td>
                <td className="border border-gray-300 px-3 py-2" colSpan={3}>{quoteInfo.address}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-100 px-3 py-2 font-medium">負責人</td>
                <td className="border border-gray-300 px-3 py-2" colSpan={3}>{quoteInfo.responsible}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 項目清單 */}
        <div className="mb-4">
          {categoryStats.map(cs => {
            const catItems = items.filter(i => i.category === cs.category);
            return (
              <div key={cs.category} className="mb-4">
                <div className="bg-gray-200 px-3 py-1 font-bold text-sm border border-gray-300">
                  {cs.category}
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-center w-12">編號</th>
                      <th className="border border-gray-300 px-2 py-1 text-left">項目描述</th>
                      <th className="border border-gray-300 px-2 py-1 text-center w-16">數量</th>
                      <th className="border border-gray-300 px-2 py-1 text-center w-16">單位</th>
                      <th className="border border-gray-300 px-2 py-1 text-right w-24">單價(HKD)</th>
                      <th className="border border-gray-300 px-2 py-1 text-right w-24">金額(HKD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">{idx + 1}</td>
                        <td className="border border-gray-300 px-2 py-1">
                          {item.name}
                          {item.isReimburse && <span className="ml-1 text-xs text-orange-600">(實報實銷)</span>}
                          {item.remark && <span className="ml-1 text-xs text-gray-400">- {item.remark}</span>}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{item.quantity}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{item.unit}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{formatMoney(Number(item.unitPrice))}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                          {formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 text-right font-medium" colSpan={5}>小計</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-bold">{formatMoney(cs.subtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* 金額匯總區 */}
        <div className="border-2 border-black mb-4 p-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-700">原價總計</span>
            <span className="font-medium">{formatMoney(subtotal)}</span>
          </div>
          {actualDiscount > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-200 text-red-600">
              <span>
                {discountItem ? `折扣（${discountItem}）` : '折扣'}
                {discountType === 'percent' && ` ${discountPercent}%`}
              </span>
              <span className="font-medium">-{formatMoney(actualDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3">
            <span className="font-bold text-lg">工程總金額</span>
            <span className="font-bold text-xl text-green-700">{formatMoney(finalTotal)}</span>
          </div>
        </div>

        {/* 付款條款 */}
        {paymentStages.length > 0 && (
          <div className="mb-4">
            <div className="bg-gray-200 px-3 py-1 font-bold text-sm border border-gray-300 mb-0">
              付款條款
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left">期數</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">比例</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">金額(HKD)</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">備註</th>
                </tr>
              </thead>
              <tbody>
                {paymentStages.map((stage, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 px-3 py-2">{stage.name}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{stage.percentage}%</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatMoney(stage.amount)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-600">{stage.remark || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 整體備註 */}
        {generalRemark && (
          <div className="mb-4">
            <div className="bg-gray-200 px-3 py-1 font-bold text-sm border border-gray-300">備註</div>
            <div className="border border-gray-300 border-t-0 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
              {generalRemark}
            </div>
          </div>
        )}

        {/* 版本修改原因 */}
        {versionRemark && currentVersion > 1 && (
          <div className="mb-4">
            <div className="bg-purple-100 px-3 py-1 font-bold text-sm border border-purple-200 text-purple-800">
              V{currentVersion} 修改原因
            </div>
            <div className="border border-purple-200 border-t-0 px-3 py-2 text-sm text-purple-700">
              {versionRemark}
            </div>
          </div>
        )}

        {/* 合約條款 */}
        {clausesEnabled && (
          <div className="mb-4">
            <div className="bg-gray-200 px-3 py-1 font-bold text-sm border border-gray-300">合約條款</div>
            <div className="border border-gray-300 border-t-0 px-3 py-2 text-xs text-gray-700 leading-relaxed">
              {clauses.map((clause, idx) => (
                <p key={idx} className="mb-1">{clause}</p>
              ))}
            </div>
          </div>
        )}

        {/* 簽署欄 */}
        <div className="border-t-2 border-black pt-4 mt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-bold text-gray-800 mb-6">客戶確認：</p>
              <div className="flex items-end mb-4">
                <span className="text-sm text-gray-600 mr-2 pb-1">簽名：</span>
                <div className="flex-1 border-b border-gray-400 h-8"></div>
              </div>
              <div className="flex items-end">
                <span className="text-sm text-gray-600 mr-2 pb-1">日期：</span>
                <div className="flex-1 border-b border-gray-400 h-8"></div>
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-800 mb-6">公司確認：</p>
              <div className="flex items-end mb-4">
                <span className="text-sm text-gray-600 mr-2 pb-1">簽名：</span>
                <div className="flex-1 border-b border-gray-400 h-8"></div>
              </div>
              <div className="flex items-end">
                <span className="text-sm text-gray-600 mr-2 pb-1">日期：</span>
                <div className="flex-1 border-b border-gray-400 h-8"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 頁腳 */}
        <div className="border-t border-gray-300 pt-4 mt-4 text-sm text-gray-600">
          <div className="flex justify-between items-start mb-2">
            <p>銀行名稱：{bankName}</p>
            <p>公司名稱：{companyName}</p>
          </div>
          <div className="flex justify-between items-start">
            <p>公司帳號：{bankAccount}</p>
            <p>FPS ID：{fpsId}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染標準項目管理視圖
  const renderStandardItemsView = () => {
    const currentItems = getCurrentStandardItems();

    const startEditCategory = (cat: Category) => {
      const items = currentItems[cat] || [];
      setEditingCategory(cat);
      setEditingItems(items.map(item => ({
        name: item.name,
        unit: item.unit,
        priceRange: item.priceRange,
        defaultRemark: item.defaultRemark || ''
      })));
      setHasChanges(false);
    };

    const addItemToCategory = () => {
      setEditingItems([...editingItems, { name: '', unit: '項', priceRange: '', defaultRemark: '' }]);
      setHasChanges(true);
    };

    const updateEditingItem = (idx: number, field: string, value: string) => {
      const newItems = [...editingItems];
      (newItems[idx] as any)[field] = value;
      setEditingItems(newItems);
      setHasChanges(true);
    };

    const removeEditingItem = (idx: number) => {
      setEditingItems(editingItems.filter((_, i) => i !== idx));
      setHasChanges(true);
    };

    const saveCategoryItems = () => {
      if (!editingCategory) return;
      const newStandardItems = { ...currentItems };
      newStandardItems[editingCategory] = editingItems
        .filter(item => item.name.trim())
        .map(item => ({
          name: item.name,
          unit: item.unit,
          priceRange: item.priceRange,
          defaultRemark: item.defaultRemark || undefined
        }));
      saveCustomStandardItems(newStandardItems as Record<Category, { name: string; unit: string; priceRange: string; defaultRemark?: string }[]>);
      setEditingCategory(null);
      setHasChanges(false);
    };

    const resetToDefault = () => {
      if (confirm('確定要重置為預設項目庫嗎？您的自定義修改將被清除。')) {
        localStorage.removeItem('customStandardItems');
        setCustomStandardItems(null);
        setEditingCategory(null);
        setHasChanges(false);
      }
    };

    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="material-icons text-amber-600">inventory_2</span>
              標準項目庫管理
            </h2>
            <div className="flex gap-2">
              {customStandardItems && (
                <button
                  type="button"
                  onClick={resetToDefault}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  重置為預設
                </button>
              )}
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                返回列表
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            在此管理快速插入的標準項目。點擊分類可編輯該分類下的項目，包括名稱、單位、價格範圍和預設備註。
          </p>

          {editingCategory ? (
            <div className="border rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  編輯「{editingCategory}」項目
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingCategory(null); setHasChanges(false); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveCategoryItems}
                    disabled={!hasChanges}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    保存更改
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {editingItems.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateEditingItem(idx, 'name', e.target.value)}
                          placeholder="項目名稱"
                          className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateEditingItem(idx, 'unit', e.target.value)}
                          placeholder="單位"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={item.priceRange}
                          onChange={(e) => updateEditingItem(idx, 'priceRange', e.target.value)}
                          placeholder="價格範圍"
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditingItem(idx)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    </div>
                    <textarea
                      value={item.defaultRemark}
                      onChange={(e) => updateEditingItem(idx, 'defaultRemark', e.target.value)}
                      placeholder="預設備註（可選）"
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                      rows={2}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addItemToCategory}
                className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 text-sm font-medium hover:border-gray-400 hover:text-gray-800 flex items-center justify-center gap-2"
              >
                <span className="material-icons text-sm">add</span>
                新增項目
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CATEGORIES.map(cat => {
                const itemCount = currentItems[cat]?.length || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => startEditCategory(cat)}
                    className="p-4 border border-gray-200 rounded-xl text-left hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{cat}</h3>
                        <p className="text-sm text-gray-500 mt-1">{itemCount} 個項目</p>
                      </div>
                      <span className="material-icons text-gray-400">chevron_right</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {currentItems[cat]?.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {item.name}
                        </span>
                      ))}
                      {itemCount > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-400">
                          +{itemCount - 3} 更多
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="container" className="min-h-screen bg-[#F5F5F0]">
      {/* 頂部標題欄 */}
      <header className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Logo" className="h-10 w-auto object-contain" />
            <h1 className="text-lg font-bold text-gray-800">報價系統</h1>
          </div>
          <div className="flex gap-2 items-center">
            {saveMessage && (
              <span className="text-sm text-green-600 animate-pulse">{saveMessage}</span>
            )}
            {view === 'list' && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                title="設定"
              >
                <span className="material-icons text-sm align-middle">settings</span>
              </button>
            )}
            {view === 'list' && (
              <button
                type="button"
                onClick={loadQuotes}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                <span className="material-icons text-sm align-middle">refresh</span>
              </button>
            )}
            {view !== 'list' && (
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                <span className="material-icons text-sm align-middle mr-1">list</span>
                列表
              </button>
            )}
            {view === 'edit' && (
              <button
                type="button"
                onClick={saveQuote}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
              >
                <span className="material-icons text-sm align-middle mr-1">save</span>
                保存
              </button>
            )}
            {view !== 'list' && view !== 'preview' && (
              <button
                type="button"
                onClick={() => {
                  const { valid, errors } = validateQuote();
                  if (!valid) {
                    alert('請修正以下問題：\n' + errors.join('\n'));
                    return;
                  }
                  setView('preview');
                }}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                預覽
              </button>
            )}
            {view === 'preview' && (
              <button
                type="button"
                onClick={() => setView('edit')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                編輯
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主內容區 */}
      <main className="pb-20">
        {view === 'list' ? renderListView() : view === 'edit' ? renderEditView() : view === 'standardItems' ? renderStandardItemsView() : renderPreviewView()}
      </main>
    </div>
  );
}

export default App;