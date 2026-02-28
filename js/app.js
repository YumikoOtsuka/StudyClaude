/* ===== Module-level state ===== */
let backlogProjects = []; // プロジェクト一覧キャッシュ（loadBacklogProjects で設定）
let dailyIssueData  = []; // 日次ダッシュボードの課題データ（CSV エクスポート用）


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

  // Load dashboard data when switching screens
  if (screenId === 'daily')   { initDailyDashboard(); }
  if (screenId === 'monthly') { initMonthlyCharts(); }
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
// type: 'success' | 'error' | 'warning' | '' (default dark)
function showToast(msg, type) {
  const area  = document.getElementById('toastArea');
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ` toast-${type}` : '');
  toast.textContent = msg;
  area.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

/* ===== Button loading helper ===== */
function setButtonLoading(btn, loading, loadingText) {
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.disabled    = true;
    btn.textContent = loadingText || '⏳ 処理中...';
  } else {
    btn.disabled    = false;
    btn.textContent = btn.dataset.origText || btn.textContent;
  }
}

/* ===== Skeleton rows helper ===== */
function skeletonRows(cols, count) {
  const cell = `<td><span class="skeleton" style="display:block;height:14px;border-radius:3px;">&nbsp;</span></td>`;
  const row  = `<tr>${cell.repeat(cols)}</tr>`;
  return row.repeat(count || 3);
}


/* ===== Settings: save / load ===== */
const SETTINGS_FIELDS = ['geminiApiKey', 'backlogSpace', 'backlogApiKey', 'backlogRepoName', 'backlogRemoteName'];

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
  showToast('設定を保存しました', 'success');
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
  const spaceUrl   = localStorage.getItem('backlogSpace')  || '';
  const backlogKey = localStorage.getItem('backlogApiKey') || '';
  if (!spaceUrl || !backlogKey) { return; }

  try {
    const projects = await BacklogAPI.getProjects();
    backlogProjects = projects;

    const savedId = localStorage.getItem('defaultProject') || '';

    // 設定画面の #defaultProject を更新
    const settingsSelect = document.getElementById('defaultProject');
    if (settingsSelect) {
      settingsSelect.innerHTML = '<option value="">選択してください</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value       = p.id;
        opt.textContent = `[${p.projectKey}] ${p.name}`;
        settingsSelect.appendChild(opt);
      });
      if (savedId) { settingsSelect.value = savedId; }
    }

    // Slack→Backlog 画面の #issueProject を更新
    const issueSelect = document.getElementById('issueProject');
    if (issueSelect) {
      issueSelect.innerHTML = '<option value="">— プロジェクトを選択 —</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value       = p.id;
        opt.textContent = `[${p.projectKey}] ${p.name}`;
        issueSelect.appendChild(opt);
      });
      if (savedId) {
        issueSelect.value = savedId;
        const savedProject = projects.find(function (p) { return String(p.id) === String(savedId); });
        if (savedProject) { localStorage.setItem('defaultProjectKey', savedProject.projectKey); }
        loadProjectDetails(savedId);
      }
    }
  } catch (err) {
    console.log('Backlog プロジェクト取得失敗:', err.message);
  }
}

/* ===== Project details: assignee / issueType / category ===== */
function populateSelect(id, items, getValue, getLabel) {
  const select = document.getElementById(id);
  if (!select) { return; }
  select.innerHTML = '<option value="">— 未選択 —</option>';
  items.forEach(function (item) {
    const opt = document.createElement('option');
    opt.value       = getValue(item);
    opt.textContent = getLabel(item);
    select.appendChild(opt);
  });
}

function setSelectLoading(id, loading) {
  const select = document.getElementById(id);
  if (!select) { return; }
  select.disabled = loading;
  if (loading) { select.innerHTML = '<option>読み込み中...</option>'; }
}

async function loadProjectDetails(projectId) {
  if (!projectId) { return; }

  setSelectLoading('issueAssignee', true);
  setSelectLoading('issueType',     true);
  setSelectLoading('issueCategory', true);

  try {
    const project    = backlogProjects.find(function (p) { return String(p.id) === String(projectId); });
    const projectKey = project ? project.projectKey : null;
    if (!projectKey) { throw new Error('プロジェクトキーが見つかりません'); }

    const results = await Promise.all([
      BacklogAPI.getProjectUsers(projectKey),
      BacklogAPI.getIssueTypes(projectId),
      BacklogAPI.getCategories(projectId),
    ]);

    populateSelect('issueAssignee', results[0], function (u) { return u.id; },  function (u) { return u.name; });
    populateSelect('issueType',     results[1], function (t) { return t.id; },  function (t) { return t.name; });
    populateSelect('issueCategory', results[2], function (c) { return c.id; },  function (c) { return c.name; });
  } catch (err) {
    showToast('プロジェクト情報の取得に失敗しました: ' + err.message, 'error');
    ['issueAssignee', 'issueType', 'issueCategory'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) { el.innerHTML = '<option value="">— 取得失敗 —</option>'; }
    });
  } finally {
    setSelectLoading('issueAssignee', false);
    setSelectLoading('issueType',     false);
    setSelectLoading('issueCategory', false);
  }
}

document.getElementById('issueProject')?.addEventListener('change', function () {
  loadProjectDetails(this.value);
});

document.getElementById('saveSettings')?.addEventListener('click', saveSettings);

document.getElementById('testConnection')?.addEventListener('click', async () => {
  const geminiKey = localStorage.getItem('geminiApiKey') || '';
  try {
    const projects = await BacklogAPI.getProjects();
    showToast(`✓ Backlog 接続成功: ${projects.length} プロジェクト取得`, 'success');
  } catch (err) {
    showToast(`✗ Backlog 接続エラー: ${err.message}`, 'error');
  }
  if (geminiKey) {
    showToast('✓ Gemini API キー設定済み', 'success');
  } else {
    showToast('✗ Gemini API キーが未設定です', 'warning');
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
  if (!slackText) { showToast('Slack テキストを入力してください', 'warning'); return; }

  const btn = document.getElementById('btnGenerate');
  setButtonLoading(btn, true, '⏳ 生成中...');

  const slackUrl = document.getElementById('slackUrl').value.trim();
  let slackSection = '';
  if (slackUrl) {
    if (isValidSlackUrl(slackUrl)) {
      slackSection = `\n\n## 参照元 Slack\n${slackUrl}`;
    } else {
      showToast('Slack URL の形式が正しくありません', 'warning');
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
    showToast('AI が課題を生成しました', 'success');
  } catch (err) {
    showToast(`エラー: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});


/* ===== Backlog 登録ボタン ===== */
document.getElementById('btnRegister')?.addEventListener('click', async () => {
  const projectId   = document.getElementById('issueProject').value;
  const summary     = document.getElementById('issueTitle').value.trim();
  const issueTypeId = document.getElementById('issueType').value;

  if (!projectId)   { showToast('プロジェクトを選択してください', 'warning');  return; }
  if (!summary)     { showToast('課題タイトルを入力してください', 'warning');   return; }
  if (!issueTypeId) { showToast('課題種別を選択してください', 'warning');       return; }

  const params = new URLSearchParams();
  params.append('projectId',   projectId);
  params.append('summary',     summary);
  params.append('issueTypeId', issueTypeId);
  params.append('priorityId',  document.getElementById('issuePriority').value || '3');

  const description = document.getElementById('issueDesc').value;
  if (description) { params.append('description', description); }

  const dueDate = document.getElementById('issueDue').value;
  if (dueDate) { params.append('dueDate', dueDate); }

  const assigneeId = document.getElementById('issueAssignee').value;
  if (assigneeId && !isNaN(parseInt(assigneeId, 10))) {
    params.append('assigneeId', assigneeId);
  }

  const categoryId = document.getElementById('issueCategory').value;
  if (categoryId && !isNaN(parseInt(categoryId, 10))) {
    params.append('categoryId[]', categoryId);
  }

  const btn = document.getElementById('btnRegister');
  setButtonLoading(btn, true, '⏳ 登録中...');

  try {
    const issue = await BacklogAPI.createIssue(params);
    StorageAPI.recordBacklogCreated(issue.issueKey);
    showToast(`✓ 課題 ${issue.issueKey} を登録しました`, 'success');

    document.getElementById('issueTitle').value    = '';
    document.getElementById('issueDesc').value     = '';
    document.getElementById('issueProject').value  = '';
    document.getElementById('issueAssignee').value = '';
    document.getElementById('issueDue').value      = '';

    uploadedImages.length = 0;
    const previewList = document.getElementById('imagePreviewList');
    if (previewList) { previewList.innerHTML = ''; }
  } catch (err) {
    showToast(`エラー: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});


/* ===== Git コマンド生成 ===== */
function generateGitCommands(branchName) {
  const spaceUrl   = localStorage.getItem('backlogSpace')       || '';
  const repoName   = localStorage.getItem('backlogRepoName')    || '';
  const projectKey = localStorage.getItem('defaultProjectKey')  || '';
  const remoteName = localStorage.getItem('backlogRemoteName')  || 'origin';

  const checkout = `git checkout -b ${branchName}`;
  let addRemote  = '';
  const push     = `git push ${remoteName} ${branchName}`;

  if (spaceUrl && repoName && projectKey) {
    const spaceId  = spaceUrl.replace('https://', '').replace('.backlog.com', '').replace(/\/$/, '');
    const remoteUrl = `https://${spaceId}.git.backlog.com/${projectKey}/${repoName}.git`;
    addRemote = `git remote add ${remoteName} ${remoteUrl}`;
  }

  return { checkout, addRemote, push };
}


/* ===== コーディング準備 生成ボタン ===== */
document.getElementById('btnCodingGen')?.addEventListener('click', async () => {
  const issueKey = document.getElementById('issueKey').value.trim().toUpperCase();
  if (!issueKey) { showToast('Backlog 課題番号を入力してください', 'warning'); return; }

  const btn = document.getElementById('btnCodingGen');
  setButtonLoading(btn, true, '⏳ 生成中...');

  try {
    const issue = await BacklogAPI.getIssue(issueKey);

    const prompt = `あなたはソフトウェアエンジニアのアシスタントです。
以下の Backlog 課題に対するコーディング準備を手伝ってください。

【課題キー】${issue.issueKey}
【課題タイトル】${issue.summary}
【課題説明】${issue.description || '（説明なし）'}

以下の JSON 形式で出力してください（余分なテキスト・コードブロック不要）:
{
  "tasks": [
    "タスク1の説明",
    "タスク2の説明"
  ],
  "branchName": "feature/${issue.issueKey.toLowerCase()}-{summary-kebab-case}",
  "commitMessage": "[${issue.issueKey}] {動詞}: {簡潔な説明}",
  "notes": "実装上の注意点があれば記述（なければ空文字）"
}`;

    const rawText = await GeminiAPI.generateText(prompt);

    let tasks, branchName, commitMessage;
    try {
      const jsonStr = rawText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const parsed  = JSON.parse(jsonStr);
      tasks         = Array.isArray(parsed.tasks) ? parsed.tasks : [rawText];
      branchName    = parsed.branchName    || `feature/${issueKey.toLowerCase()}-task`;
      commitMessage = parsed.commitMessage || `[${issueKey}] 機能実装`;
    } catch {
      tasks         = [rawText];
      branchName    = `feature/${issueKey.toLowerCase()}-task`;
      commitMessage = `[${issueKey}] 機能実装`;
    }

    const cmds = generateGitCommands(branchName);

    document.getElementById('outTasks').textContent    = tasks.map(function (t, i) { return `${i + 1}. ${t}`; }).join('\n');
    document.getElementById('outCheckout').textContent = cmds.checkout;
    document.getElementById('outBranch').textContent   = branchName;
    document.getElementById('outCommit').textContent   = commitMessage;
    document.getElementById('outPush').textContent     = cmds.push;

    const remoteBlock = document.getElementById('outAddRemoteBlock');
    if (cmds.addRemote) {
      document.getElementById('outAddRemote').textContent = cmds.addRemote;
      if (remoteBlock) { remoteBlock.style.display = 'block'; }
    } else {
      if (remoteBlock) { remoteBlock.style.display = 'none'; }
    }

    document.getElementById('codingOutput').style.display = 'block';
    showToast('コーディング準備情報を生成しました', 'success');
  } catch (err) {
    showToast(`エラー: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});


/* ===== CSV export ===== */
function formatDateTime(isoStr) {
  if (!isoStr) { return ''; }
  const d = new Date(isoStr);
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvEscape(val) {
  return `"${String(val === null || val === undefined ? '' : val).replace(/"/g, '""')}"`;
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
  if (dailyIssueData.length === 0) { showToast('エクスポートするデータがありません', 'warning'); return; }

  const headers = ['課題番号', 'タイトル', 'プロジェクト', '優先度', '担当者', '作成日時', 'ステータス'];
  const rows = dailyIssueData.map(function (issue) {
    const project     = backlogProjects.find(function (p) { return p.id === issue.projectId; });
    const projectName = project ? project.name : String(issue.projectId || '');
    return [
      issue.issueKey,
      issue.summary,
      projectName,
      issue.priority  ? issue.priority.name  : '',
      issue.assignee  ? issue.assignee.name  : '',
      formatDateTime(issue.created),
      issue.status    ? issue.status.name    : '',
    ].map(csvEscape).join(',');
  });

  const csv = [headers.map(csvEscape).join(',')].concat(rows).join('\r\n');
  const dateInput = document.getElementById('dailyDate');
  const dateStr   = dateInput ? dateInput.value : new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `backlog_daily_${dateStr}.csv`);
  showToast('CSV をダウンロードしました', 'success');
});


/* ===== Daily Dashboard ===== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initDailyDashboard() {
  const dateInput = document.getElementById('dailyDate');
  if (!dateInput) { return; }
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  loadDailyData(dateInput.value);
}

async function loadDailyData(dateStr) {
  if (!dateStr) { return; }

  const summary  = StorageAPI.getDailySummary(dateStr);
  const slackEl  = document.getElementById('dailySlackCount');
  if (slackEl) { slackEl.textContent = summary.slackProcessed; }

  const tbody = document.getElementById('dailyTableBody');
  if (tbody) { tbody.innerHTML = skeletonRows(6); }

  const backlogEl    = document.getElementById('dailyBacklogCount');
  const incompleteEl = document.getElementById('dailyIncomplete');

  try {
    const params = { createdSince: dateStr, createdUntil: dateStr, count: 100 };
    const defaultProject = localStorage.getItem('defaultProject');
    if (defaultProject) { params.projectId = [Number(defaultProject)]; }

    const issues = await BacklogAPI.getIssues(params);
    dailyIssueData = issues;

    if (backlogEl)    { backlogEl.textContent    = issues.length; }
    if (incompleteEl) {
      const incomplete = issues.filter(function (i) {
        return !(i.status && (i.status.name === '完了' || i.status.name === '処理済み'));
      }).length;
      incompleteEl.textContent = incomplete;
    }

    if (tbody) {
      if (issues.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">データがありません</td></tr>';
      } else {
        tbody.innerHTML = issues.map(renderDailyIssueRow).join('');
      }
    }
  } catch (err) {
    if (backlogEl)    { backlogEl.textContent    = '—'; }
    if (incompleteEl) { incompleteEl.textContent = '—'; }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function renderDailyIssueRow(issue) {
  const spaceUrl = (localStorage.getItem('backlogSpace') || '').replace(/\/$/, '');
  const issueUrl = spaceUrl ? `${spaceUrl}/browse/${issue.issueKey}` : '#';

  const project     = backlogProjects.find(function (p) { return p.id === issue.projectId; });
  const projectName = project ? project.name : String(issue.projectId || '');

  const priorityName  = issue.priority ? issue.priority.name : '—';
  const priorityClass = { '高': 'badge-high', '中': 'badge-mid', '低': 'badge-low' }[priorityName] || 'badge-mid';

  const assigneeName = issue.assignee ? issue.assignee.name : '—';

  const created = issue.created
    ? new Date(issue.created).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return `<tr>
    <td><a href="${escapeHtml(issueUrl)}" target="_blank" class="issue-key">${escapeHtml(issue.issueKey)}</a></td>
    <td>${escapeHtml(issue.summary)}</td>
    <td>${escapeHtml(projectName)}</td>
    <td><span class="badge ${priorityClass}">${escapeHtml(priorityName)}</span></td>
    <td>${escapeHtml(assigneeName)}</td>
    <td>${created}</td>
  </tr>`;
}

document.getElementById('dailyDate')?.addEventListener('change', function () {
  loadDailyData(this.value);
});

document.getElementById('btnRefreshDaily')?.addEventListener('click', function () {
  const dateInput = document.getElementById('dailyDate');
  if (dateInput) { loadDailyData(dateInput.value); }
});


/* ===== Monthly charts (Chart.js) ===== */
let barChart      = null;
let doughnutChart = null;

function initMonthlyCharts() {
  // 月ピッカーを当月に初期化（未設定時のみ）
  const picker = document.getElementById('monthPicker');
  if (picker && !picker.value) {
    picker.value = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  }

  // Chart.js インスタンスを初回のみ生成
  if (!barChart) {
    const barCtx = document.getElementById('chartBar').getContext('2d');
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Backlog 起票件数',
          data: [],
          backgroundColor: '#2563eb99',
          borderColor: '#2563eb',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
  }

  if (!doughnutChart) {
    const pieCtx = document.getElementById('chartPie').getContext('2d');
    doughnutChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#0d9488', '#d97706', '#dc2626'],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      },
    });
  }

  if (picker && picker.value) {
    loadMonthlyData(picker.value);
  }
}

async function loadMonthlyIssues(yearMonth) {
  const parts    = yearMonth.split('-').map(Number);
  const firstDay = `${yearMonth}-01`;
  const lastDay  = new Date(parts[0], parts[1], 0).toISOString().split('T')[0];

  let allIssues = [];
  let offset    = 0;
  const count   = 100;

  const defaultProject = localStorage.getItem('defaultProject');

  while (true) {
    const params = { createdSince: firstDay, createdUntil: lastDay, count: count, offset: offset };
    if (defaultProject) { params.projectId = [Number(defaultProject)]; }

    const batch = await BacklogAPI.getIssues(params);
    allIssues = allIssues.concat(batch);
    if (batch.length < count) { break; }
    offset += count;
  }
  return allIssues;
}

function aggregateByDate(issues, yearMonth) {
  const parts       = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(parts[0], parts[1], 0).getDate();
  const counts      = Array(daysInMonth).fill(0);
  issues.forEach(function (issue) {
    const day = new Date(issue.created).getDate();
    counts[day - 1]++;
  });
  return counts;
}

function aggregateByProject(issues) {
  const map = {};
  issues.forEach(function (issue) {
    const project = backlogProjects.find(function (p) { return p.id === issue.projectId; });
    const key     = project ? project.projectKey : String(issue.projectId || 'その他');
    map[key]      = (map[key] || 0) + 1;
  });
  return map;
}

async function loadMonthlyData(yearMonth) {
  if (!yearMonth) { return; }

  const tbody = document.getElementById('monthlyTableBody');
  if (tbody) { tbody.innerHTML = skeletonRows(6); }

  // localStorage から Slack 処理件数
  const storageSummary = StorageAPI.getMonthlySummary(yearMonth);
  const slackEl        = document.getElementById('monthlySlackCount');
  if (slackEl) { slackEl.textContent = storageSummary.totalSlack; }

  try {
    const issues = await loadMonthlyIssues(yearMonth);

    // サマリーカード更新
    const backlogEl = document.getElementById('monthlyBacklogCount');
    if (backlogEl)  { backlogEl.textContent = issues.length; }

    const doneCount = issues.filter(function (i) {
      return i.status && (i.status.name === '完了' || i.status.name === '処理済み');
    }).length;
    const doneEl = document.getElementById('monthlyDoneCount');
    if (doneEl) { doneEl.textContent = doneCount; }

    // 棒グラフ更新
    const parts       = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(parts[0], parts[1], 0).getDate();
    const countsByDay = aggregateByDate(issues, yearMonth);
    barChart.data.labels              = Array.from({ length: daysInMonth }, function (_, i) { return `${i + 1}日`; });
    barChart.data.datasets[0].data    = countsByDay;
    barChart.update();

    // ドーナツグラフ更新
    const byProject = aggregateByProject(issues);
    doughnutChart.data.labels              = Object.keys(byProject);
    doughnutChart.data.datasets[0].data    = Object.values(byProject);
    doughnutChart.update();

    // テーブル更新
    if (tbody) {
      if (issues.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">データがありません</td></tr>';
      } else {
        tbody.innerHTML = issues.map(renderMonthlyIssueRow).join('');
      }
    }
  } catch (err) {
    ['monthlyBacklogCount', 'monthlyDoneCount'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) { el.textContent = '—'; }
    });
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function renderMonthlyIssueRow(issue) {
  const spaceUrl = (localStorage.getItem('backlogSpace') || '').replace(/\/$/, '');
  const issueUrl = spaceUrl ? `${spaceUrl}/browse/${issue.issueKey}` : '#';

  const project     = backlogProjects.find(function (p) { return p.id === issue.projectId; });
  const projectName = project ? project.name : String(issue.projectId || '');

  const priorityName  = issue.priority ? issue.priority.name : '—';
  const priorityClass = { '高': 'badge-high', '中': 'badge-mid', '低': 'badge-low' }[priorityName] || 'badge-mid';

  const assigneeName = issue.assignee ? issue.assignee.name : '—';
  const created      = issue.created ? formatDateTime(issue.created) : '—';

  return `<tr>
    <td><a href="${escapeHtml(issueUrl)}" target="_blank" class="issue-key">${escapeHtml(issue.issueKey)}</a></td>
    <td>${escapeHtml(issue.summary)}</td>
    <td>${escapeHtml(projectName)}</td>
    <td><span class="badge ${priorityClass}">${escapeHtml(priorityName)}</span></td>
    <td>${escapeHtml(assigneeName)}</td>
    <td>${escapeHtml(created)}</td>
  </tr>`;
}

document.getElementById('monthPicker')?.addEventListener('change', function () {
  loadMonthlyData(this.value);
});

document.getElementById('btnRefreshMonthly')?.addEventListener('click', function () {
  const picker = document.getElementById('monthPicker');
  if (picker) { loadMonthlyData(picker.value); }
});
