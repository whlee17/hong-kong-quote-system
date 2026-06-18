// 項目分類
export type Category = 
  | '打拆工程' | '水務' | '電力' | '泥水' | '木鋁門窗' | '油漆' | '雜項'
  | '廚房傢俬' | '浴室傢俬' | '客廳傢俬' | '房間傢俬';

// 項目行數據
export interface QuoteItem {
  id: string;
  category: Category;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remark: string;
  isReimburse: boolean; // 實報實銷
}

// 報價單基礎資訊
export interface QuoteInfo {
  quoteNo: string;
  date: string;
  customerName: string;
  phone: string;
  address: string;
  responsible: string;
}

// 付款方案
export interface PaymentPlan {
  id: string;
  name: string;
  stages: { name: string; percentage: number; remark?: string }[];
}

// 內置項目庫
export const STANDARD_ITEMS: Record<Category, { name: string; unit: string; priceRange: string; defaultRemark?: string }[]> = {
  '打拆工程': [
    { name: '全屋舊物清拆', unit: '項', priceRange: '21000-35000', defaultRemark: '清拆全屋大廳及房間原有物件/傢俬\n清拆原有地台磚連腳線\n主/客浴室牆及浴室地全拆(包括:牆身/地台瓦,浴缸)\n廚房牆地全拆(包括:牆身/地台瓦）\n拆除全屋門連舊冷氣機\n裝修期間及裝修結束清走建築廢料及泥頭徵費' },
    { name: '廚房拆除', unit: '項', priceRange: '26800-28880', defaultRemark: '廚房牆地全拆(包括:牆身/地台瓦）\n裝修期間及裝修結束清走建築廢料及泥頭徵費' },
    { name: '局部拆牆', unit: '項', priceRange: '2500-5000' },
  ],
  '水務': [
    { name: '廚房水喉', unit: '項', priceRange: '11000-14800', defaultRemark: '廚房 新造星盆冷熱水喉位,熱水爐冷熱水，露台洗衣機去水喉位,(包英國銅喉,明喉,連試磅谷磅)' },
    { name: '浴室水喉', unit: '項', priceRange: '12000-14800', defaultRemark: '新造洗手盤/花灑冷熱水喉位,地台及(企缸/浴屏)去水喉位,(包英國銅喉,入牆暗喉,連試磅谷磅)' },
    { name: '改糞喉', unit: '項', priceRange: '2000' },
  ],
  '電力': [
    { name: 'TV', unit: '個', priceRange: '800' },
    { name: '上網喉位', unit: '個', priceRange: '800' },
    { name: 'AV槽出線位', unit: '個', priceRange: '1600' },
    { name: '電箱改位', unit: '個', priceRange: '1500' },
    { name: '13A單蘇', unit: '個', priceRange: '750' },
    { name: '13A孖蘇', unit: '個', priceRange: '1120' },
    { name: '燈位', unit: '個', priceRange: '750' },
    { name: '20A燈曲', unit: '個', priceRange: '1500' },
    { name: '電箱', unit: '項', priceRange: '5000', defaultRemark: '新造大電箱(連工包料)' },
  ],
  '泥水': [
    { name: '地台鋪磚', unit: '平方呎', priceRange: '85', defaultRemark: '盪地台+鋪磚 (包沙,泥,連人工) (不包磁磚)實際面積以平方呎計算（600x600mm / 1200x200mm或以下）' },
    { name: '牆地鋪磚', unit: '平方呎', priceRange: '88' },
    { name: '浴室防水', unit: '項', priceRange: '3000' },
    { name: '廚房防水', unit: '項', priceRange: '2500' },
    { name: '企缸', unit: '項', priceRange: '300' },
  ],
  '木鋁門窗': [
    { name: '實心木門', unit: '扇', priceRange: '4300' },
    { name: '趟門', unit: '扇', priceRange: '500' },
    { name: '鋁天花', unit: '項', priceRange: '4000' },
    { name: '浴室浴屏', unit: '項', priceRange: '500' },
  ],
  '油漆': [
    { name: '全屋油漆', unit: '項', priceRange: '22800' },
  ],
  '雜項': [
    { name: '現場保護', unit: '項', priceRange: '1500' },
    { name: '安裝龍頭', unit: '個', priceRange: '500' },
    { name: '完工清潔', unit: '項', priceRange: '300' },
  ],
  '廚房傢俬': [
    { name: '地櫃', unit: '直呎', priceRange: '980' },
    { name: '吊櫃', unit: '直呎', priceRange: '980' },
    { name: '石英石台面', unit: '直呎', priceRange: '980' },
    { name: '開石孔', unit: '個', priceRange: '500' },
  ],
  '浴室傢俬': [
    { name: '地櫃/吊櫃/台面', unit: '直呎', priceRange: '980' },
    { name: '開石孔', unit: '個', priceRange: '500' },
  ],
  '客廳傢俬': [
    { name: '鞋櫃/餐邊櫃', unit: '直呎', priceRange: '1800' },
    { name: '電視櫃', unit: '直呎', priceRange: '900' },
    { name: '加高費', unit: '直呎', priceRange: '300' },
  ],
  '房間傢俬': [
    { name: '油壓床', unit: '張', priceRange: '5400起' },
    { name: '衣櫃', unit: '直呎', priceRange: '1300' },
    { name: '床頭櫃', unit: '直呎', priceRange: '700' },
    { name: '櫃桶', unit: '個', priceRange: '160' },
  ],
};

// 內置付款方案
export const PAYMENT_PLANS: PaymentPlan[] = [
  { id: '1', name: '純傢俬 (30%/50%/20%)', stages: [
    { name: '第一期', percentage: 30 },
    { name: '第二期', percentage: 50 },
    { name: '第三期', percentage: 20 },
  ]},
  { id: '2', name: '全屋綜合 (35%/30%/30%/5%)', stages: [
    { name: '第一期', percentage: 35 },
    { name: '第二期', percentage: 30 },
    { name: '第三期', percentage: 30 },
    { name: '第四期', percentage: 5 },
  ]},
  { id: '3', name: '傳統工程 (10%/25%/30%/30%/3%/2%)', stages: [
    { name: '第一期', percentage: 10 },
    { name: '第二期', percentage: 25 },
    { name: '第三期', percentage: 30 },
    { name: '第四期', percentage: 30 },
    { name: '第五期', percentage: 3 },
    { name: '第六期', percentage: 2 },
  ]},
  { id: '4', name: '自定義比例', stages: [] },
];

// 內置合約條款
export const DEFAULT_CLAUSES = [
  // (一) 工程範圍/工期事宜
  '1. 此合約不包括單位的水火險及第三者保險。',
  '2. 報價有效期為兩(2)星期，客戶於簽署或蓋印後則成一份正式合約，所有已收取的款項不會退還。',
  '3. 所有工程範圍及要求均以此報價單為準，所有口頭協議恕不接受。',
  '4. 此項合約工程期為(稍後了解後確定)工作天(星期六、日，公眾假期及紅雨、黑雨、颱風日不計算在內)內基本完成。基本完成泛指完成所有能讓客戶入住的必要工程項目。若客戶於接收單位前發現有任何非客戶或第三方所引致的損毀，本公司可於損毀保養期內進行維修。',
  '5. 如因客方原因而引致停工，在及後重新開工時需額外五(5)個工作天作安排人手重新進場。',
  '6.1 由第三方/客戶所引致的延誤，其中包括但不限於延遲交場至本公司、第三方工程延誤、客戶或第三方所提供的物料延誤、客戶未能如期確認工程資料等，本公司恕不負責。',
  '6.2 惡劣天氣及其對工程進度所引致的影響，本公司恕不負責。',
  '6.3 客戶額外之要求，其中包括工程變更項目，本公司恕不負責。',
  '6.4 客戶未能容許本公司進入工地，本公司恕不負責。',
  '6.5 客戶或第三方在工地上對施工人員造成影響，本公司恕不負責。',
  '6.6 不可抗力所引致的延誤，其中包括戰爭、入侵、火災、地震等，本公司恕不負責。',
  '6.7 因應特別情況所引致之延誤，本公司恕不負責。本公司會就以上情況與客戶確定所需之額外工程，同時本公司亦保留追討一切管理、營運或其他因上列情況所引致的費用之權利。',
  // (二) 工程變更及工程款項
  '7. 所有相關工程款項及物料費用必須清付後，本公司才會進行執修、補件等跟進事項。',
  '8. 如客戶需要後加工程，收費則須由本公司及客戶另行商議而定，而完工期亦會相應延長。',
  '9. 此工程合約會以按量計算為準則，然而各單一工程項目亦有最低銷費，在計算工程變更時客人需另行跟本公司作協商。',
  '10. 後加工程之定義包含，而不限於任何(1)附加工序(2)變更施工次序及工時(3)變更工程中使用之物料(4)變更已完成之工程成品(5)額外安裝服務等。',
  '11. 後加工程有可能引致價錢及(或)工期上之影響，需由雙方同意及文字確認作實。',
  // (三) 適用法規及爭議處理
  '12. 本合約須由香港特別行政區的法律解釋、詮釋及規限。有關本合約所引致的訴訟必須在香港特別行政區之法院或香港仲裁公會內進行。',
  '13. 凡因本合約所引起的或與之相關的任何爭議、糾紛、分歧或索賠，包括合同的存在、效力、解釋、履行、違反或終止，或因本合同引起的或與之相關的任何非合同性爭議，均應以下列程序處理：(爭議之金額少於HK$75,000)提交至香港特別行政區之小額錢債審裁處；(爭議之金額高於HK$75,000)提交香港仲裁公會並按照其現行有效的香港仲裁公會規則最終解決。',
  // (四) 承建商及客方之責任
  '14. 保修期由客戶接收單位起計十二(12)個月，客戶須注意部份缺陷維修工作會於保修期內進行。結構、防水及水電管道項目保養期為三十六(36)個月。',
  '15. 客人需在工程基本完成後，與本公司代表一同在單位驗收及確定缺陷維修項目清單。',
  '16. 本公司會於裝修期間及完工後拍攝照片及影片作記錄及宣傳之用。如客人不欲接受此條款，請於簽約前通知本公司。',
  '17. 工程費用需依從合約中之付款時間繳付，其中後加項目的付費時間亦依從合約中的付款時間表。工程所有費用在任何情況下均不設退款。若貴客未能依時繳交工程費用，本公司有權立刻停工並追討因停工而引致的損失。因延遲繳付工程費用而引致的任何工程延誤，由貴客自負。',
  '18. 除非另有說明，客人須負責向管理處或其他機構、部門申辦裝修申請或其他工程相關之准許及承擔其相關費用。',
  '19. 除非另有說明，工程造法及設計均以本公司既有準則作標準。',
  '20. 如有任何因本公司在安裝或運送過程中令客方物品(如小五金、燈飾等)引致損壞，本公司就該客方物品之最高賠償金額為港幣$500元。本公司並不負責一切保養及維修所有代工安裝或代客購買之物料。',
  '21. 本公司並不負責代付或檢驗客人自購之物料，客人需自行到單位檢驗其自購物料。所有自購之物料需直送至單位，本公司並不負責代工搬運任何物資。',
  '22. 除非另有說明，工程報價並未包含一切政府部門之申請費用。如需本公司代辦，可作另行商議。',
];

// 分類列表
export const CATEGORIES: Category[] = [
  '打拆工程', '水務', '電力', '泥水', '木鋁門窗', '油漆', '雜項',
  '廚房傢俬', '浴室傢俬', '客廳傢俬', '房間傢俬',
];

// 生成唯一ID
export const generateId = () => Math.random().toString(36).substring(2, 11);

// 格式化金額
export const formatMoney = (amount: number): string => {
  return amount.toLocaleString('zh-HK', { style: 'currency', currency: 'HKD' });
};

// 獲取當前日期
export const getToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 生成報價單號
export const generateQuoteNo = (): string => {
  const year = new Date().getFullYear();
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${year}-${random}`;
};