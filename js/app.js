/* ===== Navigation ===== */
const NAV_ITEMS = document.querySelectorAll('.nav-item');
const SCREENS  = document.querySelectorAll('.screen');

const SCREEN_META = {
  settings:      { title: '設定',                   sub: 'API キーと接続情報を管理します' },
  slack2backlog:  { title: 'Slack → Backlog 変換',   sub: 'Slack の依頼を AI が Backlog 課題に変換します' },
  coding:        { title: 'コーディング準備',           sub: 'Backlog 課題からブランチ・タスク・コミットメッセージを生成します' },
  daily:         { title: '分析 — 日次',              sub: '当日の Slack 処理件数・Backlog 起票件数を確認します' },
  monthly:       { title: '分析 — 月次',              sub: '月間の起票推移とプロジェクト別内訳を確認します' },
};

function navigate(screenId) {
  SCREENS.forEach(s => s.classList.toggle('active', s.id === screenId));
  NAV_ITEMS.forEach(n => n.classList.toggle('active', n.dataset.screen === screenId));

  const meta = SCREEN_META[screenId];
  if (meta) {
    document.querySelector('.topbar-title').textContent = meta.title;
    document.querySelector('.topbar-sub').textContent   = meta.sub;
  }

  // Draw charts when monthly screen becomes visible
  if (screenId === 'monthly') {initMonthlyCharts();}
}

NAV_ITEMS.forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.screen));
});

// Start on Slack→Backlog screen
navigate('slack2backlog');


/* ===== Copy to clipboard ===== */
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ コピー済';
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}

document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.querySelector(btn.dataset.copy);
    if (target) {copyText(target.textContent.trim(), btn);}
  });
});


/* ===== Toast helper ===== */
function showToast(msg) {
  const area  = document.getElementById('toastArea');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  area.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}


/* ===== Settings: save / load ===== */
const SETTINGS_FIELDS = ['claudeApiKey', 'backlogSpace', 'backlogApiKey', 'defaultProject'];

function saveSettings() {
  SETTINGS_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {localStorage.setItem(id, el.value);}
  });
  showToast('設定を保存しました');
}

function loadSettings() {
  SETTINGS_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {el.value = localStorage.getItem(id) || '';}
  });
}

document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
loadSettings();


/* ===== Drag-and-drop image upload (mockup) ===== */
const dropzone = document.getElementById('dropzone');
const previewList = document.getElementById('imagePreviewList');
const uploadedImages = [];

if (dropzone) {
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  dropzone.addEventListener('click', () => document.getElementById('imageInput').click());
  document.getElementById('imageInput')?.addEventListener('change', e => handleFiles(e.target.files));
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) {return;}
    uploadedImages.push(file);
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      item.appendChild(img);
    };
    reader.readAsDataURL(file);
    previewList?.appendChild(item);
  });
}


/* ===== AI 生成ボタン (mockup) ===== */
document.getElementById('btnGenerate')?.addEventListener('click', () => {
  const slackText = document.getElementById('slackText').value.trim();
  if (!slackText) { showToast('Slack テキストを入力してください'); return; }

  const slackUrl = document.getElementById('slackUrl').value.trim();
  const slackSection = slackUrl
    ? `\n\n## 参照元 Slack\n${slackUrl}`
    : '';

  // Mockup: fill form with dummy data
  document.getElementById('issueTitle').value = '【依頼】' + slackText.slice(0, 40) + (slackText.length > 40 ? '…' : '');
  document.getElementById('issueDesc').value  =
    `## 依頼内容\n${slackText}\n\n## 対応方針\n（AI 生成後にここに入ります）\n\n## 完了条件\n- [ ] 対応完了${slackSection}`;
  showToast('AI が課題を生成しました（モック）');
});


/* ===== Backlog 登録ボタン (mockup) ===== */
document.getElementById('btnRegister')?.addEventListener('click', () => {
  const title = document.getElementById('issueTitle').value.trim();
  if (!title) { showToast('タイトルを入力してください'); return; }
  showToast(`Backlog に課題を登録しました（モック）: ${title}`);
});


/* ===== コーディング準備 生成ボタン (mockup) ===== */
document.getElementById('btnCodingGen')?.addEventListener('click', () => {
  const issueKey = document.getElementById('issueKey').value.trim();
  if (!issueKey) { showToast('Backlog 課題番号を入力してください'); return; }

  const branchName = `feature/${issueKey.toLowerCase()}-description`;
  const commitMsg  = `[${issueKey}] 機能実装: 説明をここに記入`;
  const pushCmd    = `git push origin ${branchName}`;

  document.getElementById('outBranch').textContent  = branchName;
  document.getElementById('outCommit').textContent  = commitMsg;
  document.getElementById('outPush').textContent    = pushCmd;
  document.getElementById('outTasks').textContent   =
    `1. 仕様確認・設計\n2. DB マイグレーション（必要であれば）\n3. バックエンド実装\n4. フロントエンド実装\n5. 単体テスト作成\n6. コードレビュー依頼\n7. ${issueKey} ステータス更新`;

  document.getElementById('codingOutput').style.display = 'block';
  showToast('コーディング準備情報を生成しました（モック）');
});


/* ===== CSV export ===== */
function tableToCSV(tableId) {
  const table = document.querySelector(`#${tableId} table`);
  if (!table) {return '';}
  const rows = Array.from(table.querySelectorAll('tr'));
  return rows.map(row =>
    Array.from(row.querySelectorAll('th, td'))
      .map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
      .join(',')
  ).join('\r\n');
}

function downloadCSV(csv, filename) {
  const bom = '\uFEFF'; // BOM for Excel Japanese support
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btnExportDailyCsv')?.addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  const csv = tableToCSV('daily');
  if (!csv) { showToast('エクスポートするデータがありません'); return; }
  downloadCSV(csv, `backlog_daily_${today}.csv`);
  showToast('CSV をダウンロードしました');
});


/* ===== Monthly charts (Chart.js) ===== */
let chartsInitialized = false;

function initMonthlyCharts() {
  if (chartsInitialized) {return;}
  chartsInitialized = true;

  // Bar chart: daily issue count
  const barCtx = document.getElementById('chartBar').getContext('2d');
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 28 }, (_, i) => `${i + 1}日`),
      datasets: [{
        label: 'Backlog 起票件数',
        data: Array.from({ length: 28 }, () => Math.floor(Math.random() * 5)),
        backgroundColor: '#2563eb99',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });

  // Pie chart: by project
  const pieCtx = document.getElementById('chartPie').getContext('2d');
  new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['Project A', 'Project B', 'Project C'],
      datasets: [{
        data: [12, 7, 4],
        backgroundColor: ['#2563eb', '#7c3aed', '#0891b2'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
      },
    },
  });
}
