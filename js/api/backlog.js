/* ===== Backlog API クライアント =====
 * window.BacklogAPI として公開する共通モジュール。
 * sourceType: 'script'（ES modules 不使用、<script> タグで app.js より前に読み込む）
 *
 * 対応エンドポイント:
 *   GET  /api/v2/projects
 *   GET  /api/v2/projects/{key}/users
 *   GET  /api/v2/projects/{id}/issueTypes
 *   GET  /api/v2/projects/{id}/categories
 *   GET  /api/v2/issues
 *   GET  /api/v2/issues/{key}
 *   POST /api/v2/issues
 * ===================================== */

(function () {
  'use strict';

  // ---- 設定取得 --------------------------------------------------

  /**
   * localStorage から Backlog 接続設定を取得する。
   * @returns {{ spaceUrl: string, apiKey: string }}
   */
  function getConfig() {
    return {
      spaceUrl: (localStorage.getItem('backlogSpace') || '').replace(/\/$/, ''),
      apiKey:    localStorage.getItem('backlogApiKey') || '',
    };
  }

  /**
   * 設定が揃っているか確認し、未設定なら Error を投げる。
   * @param {{ spaceUrl: string, apiKey: string }} config
   */
  function assertConfig(config) {
    if (!config.spaceUrl || !config.apiKey) {
      throw new Error(
        'Backlog の設定が未完了です。設定画面でスペース URL と API キーを設定してください。'
      );
    }
  }

  // ---- 共通 fetch ------------------------------------------------

  /**
   * Backlog API への GET リクエスト。
   *
   * params のうち配列値は key[]=val1&key[]=val2 形式で展開する。
   * @param {string} path   - APIパス（例: '/projects'）
   * @param {Object} [params] - クエリパラメータ
   * @returns {Promise<any>}
   */
  async function backlogGet(path, params) {
    const config = getConfig();
    assertConfig(config);

    const url = new URL(`${config.spaceUrl}/api/v2${path}`);
    url.searchParams.set('apiKey', config.apiKey);

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (Array.isArray(val)) {
          val.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
        } else if (val !== undefined && val !== null && val !== '') {
          url.searchParams.set(key, String(val));
        }
      });
    }

    let res;
    try {
      res = await fetch(url.toString());
    } catch {
      throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg  = body.errors?.[0]?.message ?? `Backlog API エラー (${res.status})`;
      throw new Error(msg);
    }

    return res.json();
  }

  /**
   * Backlog API への POST リクエスト（Content-Type: application/x-www-form-urlencoded）。
   *
   * Backlog API の仕様上、POST ボディは JSON 不可。
   * 配列パラメータ（categoryId[] 等）は呼び出し元で URLSearchParams.append を
   * 複数回呼んで渡すこと。
   * @param {string} path               - APIパス（例: '/issues'）
   * @param {URLSearchParams|Object} params - リクエストボディ
   * @returns {Promise<any>}
   */
  async function backlogPost(path, params) {
    const config = getConfig();
    assertConfig(config);

    const url  = `${config.spaceUrl}/api/v2${path}?apiKey=${encodeURIComponent(config.apiKey)}`;
    const body = params instanceof URLSearchParams
      ? params
      : new URLSearchParams(params || {});

    let res;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
    } catch {
      throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg     = errBody.errors?.[0]?.message ?? `Backlog API エラー (${res.status})`;
      throw new Error(msg);
    }

    return res.json();
  }

  // ---- 公開 API 関数 ---------------------------------------------

  /**
   * プロジェクト一覧を取得する。
   * @returns {Promise<Array<{id: number, projectKey: string, name: string}>>}
   */
  const getProjects = () => backlogGet('/projects');

  /**
   * プロジェクトのメンバー一覧を取得する。
   * @param {string} projectKey - プロジェクトキー（例: 'BLG'）
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  const getProjectUsers = projectKey =>
    backlogGet(`/projects/${encodeURIComponent(projectKey)}/users`);

  /**
   * プロジェクトの課題種別一覧を取得する。
   * @param {number|string} projectId - プロジェクト ID
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  const getIssueTypes = projectId =>
    backlogGet(`/projects/${encodeURIComponent(projectId)}/issueTypes`);

  /**
   * プロジェクトのカテゴリ一覧を取得する。
   * @param {number|string} projectId - プロジェクト ID
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  const getCategories = projectId =>
    backlogGet(`/projects/${encodeURIComponent(projectId)}/categories`);

  /**
   * 課題を登録する。
   *
   * 必須: projectId, summary, issueTypeId, priorityId
   * 配列パラメータ（categoryId[] 等）は URLSearchParams.append で複数回追加すること。
   * @param {URLSearchParams} params - 課題登録パラメータ
   * @returns {Promise<{id: number, issueKey: string, summary: string}>}
   */
  const createIssue = params => backlogPost('/issues', params);

  /**
   * 課題一覧を取得する（1回最大 100 件）。
   *
   * ページネーション例:
   *   getIssues({ count: 100, offset: 0, createdSince: '2026-02-28', createdUntil: '2026-02-28' })
   * @param {Object} [params] - フィルタパラメータ
   * @returns {Promise<Array>}
   */
  const getIssues = params => backlogGet('/issues', params);

  /**
   * 課題の詳細を取得する。
   * @param {string} issueKey - 課題キー（例: 'BLG-123'）
   * @returns {Promise<Object>}
   */
  const getIssue = issueKey =>
    backlogGet(`/issues/${encodeURIComponent(issueKey)}`);

  // ---- グローバル公開 --------------------------------------------

  window.BacklogAPI = {
    getProjects,
    getProjectUsers,
    getIssueTypes,
    getCategories,
    createIssue,
    getIssues,
    getIssue,
  };

}());
