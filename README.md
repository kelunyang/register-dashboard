# 學生報到系統 - Student Check-in Dashboard

基於 Google Apps Script 的學生報到管理系統，提供即時的學生報到狀態查看和統計分析。
這個儀錶板是搭配[GAS報到機](https://github.com/kelunyang/register-scanner)， 本來這種儀表板都是使用Google Looker Studio來做，但是在即時報到時發現Looker Studio如果沒有資料的情況下，使用合成資料會導致儀表板無法載入，然後Looker Studio在大量存取同一個sheet的時候超卡，所以決定改寫一個GAS的版本，應付報到時的流量

## 功能特色

- 📊 即時學生報到狀態統計
- 📈 動態圖表顯示報到趨勢
- 🔄 自動刷新機制
- 📱 響應式設計，支援多種裝置
- 🎨 科幻風格的使用者介面

## 系統需求

- Google 帳號
- Google Apps Script 存取權限
- Google Sheets 存取權限
- Node.js 16+ (用於本地開發)

## 安裝說明

### 1. 本地開發環境設定

```bash
# 克隆專案
git clone <repository-url>
cd register-dashboard

# 安裝依賴
npm install

# 本地開發
npm run dev
```

### 2. Google Apps Script 部署

#### 2.1 初始設定

```bash
# 安裝 Google Apps Script CLI
npm install -g @google/clasp

# 登入 Google 帳號
clasp login

# 建立新的 GAS 專案
npm run setup:gas
```

#### 2.2 部署到 Google Apps Script

```bash
# 建置並部署
npm run deploy:gas
```

### 3. Google Apps Script Properties Service 設定

部署完成後，需要在 Google Apps Script 中設定以下 Properties Service 變數：

#### 必要設定變數

登入 [Google Apps Script Console](https://script.google.com/)，選擇你的專案，然後到 **設定** > **指令碼屬性**，新增以下屬性：

| 屬性名稱 | 說明 | 範例值 | 必要性 |
|---------|------|--------|--------|
| `controlSheet` | 控制表單的 Google Sheets ID | `1A2B3C4D5E6F7G8H9I0J` | ✅ 必要 |
| `autorefreshGem` | 自動刷新驗證 Token | `your-secret-token-here` | ⚠️ 選用 |
| `refreshInterval` | 自動刷新間隔（秒） | `30` | ⚠️ 選用 |

#### 取得 Google Sheets ID

1. 開啟你的 Google Sheets
2. 從網址列複製 Sheet ID
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
   ```
3. 將 `{SHEET_ID}` 部分設定為 `controlSheet` 屬性

#### 設定步驟

1. 開啟 [Google Apps Script Console](https://script.google.com/)
2. 選擇你的專案
3. 點選左側選單的 **設定**
4. 在 **指令碼屬性** 區域點選 **新增指令碼屬性**
5. 依照上表逐一新增屬性

### 4. Google Sheets 資料結構

本儀錶板是搭配 [GAS報到／借用機](https://github.com/kelunyang/register-scanner)使用，所以基本的Google Sheet都和報到機相同
但要顯示在儀表板上，進行以下步驟

1. 修改「條碼主控台」，新增以下欄位(H-I欄)
- 啟動時間timestamp：有了這個，儀表板才會知道你的報到啥時開始
- 顯示用看板Markdown：這是歡迎詞，可以使用Markdown
2. 新增「看板顯示欄位」工作表到你個別活動的活頁簿中，工作表裡面需要以下欄位（A-E欄）
- 欄位名稱：就是你放在程式寫入表或是原始資料表裡的欄位名稱
- 欄位性質：Text、Category、Timestamp，自己挑一個
- 顯示區塊： StudentTable或是TypeStatistic任選一個，table是細目表格、type是類別篩選器，可以有很多個欄位都被對應給type，那就會導致出現很多個篩選器
- 預處理： 請參考預處理欄位說明，這會影響遮罩
- 特殊功能：必須有一個欄位當作唯一值，那個欄位請給他 UID

### 5. 權限設定

在 Google Apps Script 中確認以下權限：

- Google Sheets API 存取權限
- Web App 執行權限設定為 `USER_DEPLOYING`
- 存取權限設定為 `ANYONE_ANONYMOUS`（如需公開存取）

## 使用說明

### 開發模式

```bash
# 啟動開發伺服器
npm run dev
```

### 建置部署

```bash
# 建置專案
npm run build

# 準備 GAS 部署檔案
npm run prepare:gas

# 完整部署流程
npm run deploy:gas
```

## 專案結構

```
register-dashboard/
├── src/                    # Vue.js 前端源碼
│   ├── components/         # Vue 組件
│   ├── services/          # 服務層
│   └── main.js            # 入口檔案
├── gas-deploy/            # GAS 部署檔案
│   ├── Backend.gs         # 後端 GAS 程式碼
│   ├── Frontend.gs        # 前端 GAS 程式碼
│   ├── Index.html         # HTML 模板
│   └── appsscript.json    # GAS 專案設定
├── scripts/               # 建置腳本
└── package.json           # 專案設定
```

## 故障排除

### 常見問題

1. **無法存取 Google Sheets**
   - 確認 `controlSheet` 屬性設定正確
   - 檢查 Google Sheets 權限設定

2. **自動刷新無法運作**
   - 確認 `autorefreshGem` 和 `refreshInterval` 設定
   - 檢查網路連線狀態

3. **部署失敗**
   - 確認 `clasp` 已正確安裝並登入
   - 檢查 Google Apps Script API 是否啟用

### 除錯方法

1. 查看 Google Apps Script 執行記錄
2. 使用瀏覽器開發者工具檢查前端錯誤
3. 確認 Properties Service 設定正確

## 技術棧

- **前端**: Vue.js 3, Element Plus, ECharts, D3.js
- **後端**: Google Apps Script
- **資料庫**: Google Sheets
- **建置工具**: Vite, Babel
- **部署工具**: Google Clasp

## 授權

CC-BY-SA
使用到的套件有各自授權依照該套件授權使用

---

## 更新記錄

- v20250707: 初始版本
  - 基本學生報到功能
  - 即時統計圖表
  - 自動刷新機制