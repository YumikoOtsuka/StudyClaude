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

  showApiBanner(screenId);

  // Draw charts when monthly screen becomes visible
  if (screenId === 'monthly') {initMonthlyCharts();}
}

function showApiBanner(screenId) {
  const banner = document.getElementById('apiBanner');
  const msgEl  = document.getElementById('apiBannerMsg');
  if (!banner || !msgEl) { return; }

  const geminiKey  = localStorage.getItem('geminiApiKey')  || '';
  const spaceUrl   = localStorage.getItem('backlogSpace')  || '';
  const backlogKey = localStorage.getItem('backlogApiKey') || '';

  const needsGemini  = screenId === 'slack2backlog' || screenId === 'coding';
  const needsBacklog = screenId === 'slack2backlog' || screenId === 'coding' ||
                       screenId === 'daily'          || screenId === 'monthly';

  let warning = '';
  if (needsGemini && needsBacklog) {
    const missingGemini  = !geminiKey;
    const missingBacklog = !spaceUrl || !backlogKey;
    if (missingGemini && missingBacklog) {
      warning = '⚠️ Gemini API キーと Backlog API キーが未設定です。';
    } else if (missingGemini) {
      warning = '⚠️ Gemini API キーが未設定です。';
    } else if (missingBacklog) {
      warning = '⚠️ Backlog API キーが未設定です。';
    }
  } else if (needsBacklog) {
    if (!spaceUrl || !backlogKey) {
      warning = '⚠️ Backlog API キーが未設定です。';
    }
  }

  if (warning) {
    msgEl.textContent     = warning + ' ';
    banner.style.display  = 'flex';
  } else {
    banner.style.display  = 'none';
  }
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
const SETTINGS_FIELDS = ['geminiApiKey', 'backlogSpace', 'backlogApiKey'];

function saveSettings() {
  SETTINGS_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {localStorage.setItem(id, el.value);}
  });
  // defaultProject を保存（選択済みの場合のみ上書き）
  const projectSel = document.getElementById('defaultProject');
  if (projectSel && projectSel.value) {
    localStorage.setItem('defaultProject', projectSel.value);
  }
  showToast('設定を保存しました');
  loadBacklogProjects();
}

function loadSettings() {
  SETTINGS_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {el.value = localStorage.getItem(id) || '';}
  });
  loadBacklogProjects();
}

async function loadBacklogProjects() {
  const select = document.getElementById('defaultProject');
  if (!select) { return; }

  const spaceUrl  = localStorage.getItem('backlogSpace')  || '';
  const backlogKey = localStorage.getItem('backlogApiKey') || '';
  if (!spaceUrl || !backlogKey) { return; }

  try {
    const projects = await BacklogAPI.getProjects();
    const savedId  = localStorage.getItem('defaultProject') || '';
    select.innerHTML = '<option value="">選択してください</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = `[${p.projectKey}] ${p.name}`;
      select.appendChild(opt);
    });
    if (savedId) { select.value = savedId; }
  } catch (err) {
    console.log('Backlog プロジェクト取得失敗:', err.message);
  }
}

document.getElementById('saveSettings')?.addEventListener('click', saveSettings);

document.getElementById('testConnection')?.addEventListener('click', async () => {
  const geminiKey = localStorage.getItem('geminiApiKey') || '';
  try {
    const projects = await BacklogAPI.getProjects();
    showToast(`✓ Backlog 接続成功: ${projects.length} プロジェクト取得`);
  } catch (err) {
    showToast(`✗ Backlog 接続エラー: ${err.message}`);
  }
  if (geminiKey) {
    showToast('✓ Gemini API キー設定済み');
  } else {
    showToast('✗ Gemini API キーが未設定です');
  }
});

document.getElementById('apiBannerLink')?.addEventListener('click', e => {
  e.preventDefault();
  navigate('settings');
});

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


/* ===== Slack URL バリデーション ===== */
function isValidSlackUrl(url) {
  return /^https:\/\/[a-zA-Z0-9-]+\.slack\.com\/archives\/[A-Z0-9]+\/p[0-9]+/.test(url);
}


/* ===== AI 生成ボタン ===== */
document.getElementById('btnGenerate')?.addEventListener('click', async () => {
  const slackText = document.getElementById('slackText').value.trim();
  if (!slackText) { showToast('Slack テキストを入力してください'); return; }

  const btn      = document.getElementById('btnGenerate');
  const origText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '⏳ 生成中...';

  const slackUrl = document.getElementById('slackUrl').value.trim();
  let slackSection = '';
  if (slackUrl) {
    if (isValidSlackUrl(slackUrl)) {
      slackSection = `\n\n## 参照元 Slack\n${slackUrl}`;
    } else {
      showToast('Slack URL の形式が正しくありません');
    }
  }

  const prompt = `あなたは業務管理のアシスタントです。
以下の Slack 投稿内容から Backlog 課題を作成してください。

【Slack 投稿内容】
${slackText}

以下の JSON 形式で出力してください。余分なテキストや markdown コードブロックは不要です。
{
  "title": "課題タイトル（簡潔に、50文字以内）",
  "description": "課題の詳細説明（箇条書きや見出しを使い、作業内容・背景・完了条件を含める）"
}`;

  try {
    const rawText = await GeminiAPI.generateText(prompt);

    let title, description;
    try {
      const jsonStr = rawText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const parsed  = JSON.parse(jsonStr);
      title       = parsed.title       || slackText.slice(0, 50);
      description = parsed.description || rawText;
    } catch {
      title       = slackText.slice(0, 50);
      description = rawText;
    }

    if (uploadedImages.length > 0) {
      const imagePrompt = `以下の画像はSlack投稿に添付されたスクリーンショット・資料です。
画像の内容を日本語で詳しく説明してください。
Backlog課題の説明文に含めるため、業務的な観点で重要な情報を中心に記述してください。`;
      const imageDesc = await GeminiAPI.generateWithImages(imagePrompt, uploadedImages);
      description += `\n\n## 添付画像の内容\n${imageDesc}`;
    }

    document.getElementById('issueTitle').value = title;
    document.getElementById('issueDesc').value  = description + slackSection;

    StorageAPI.recordSlackProcessed();
    showToast('AI が課題を生成しました');
  } catch (err) {
    showToast(`エラー: ${err.message}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = origText;
  }
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
