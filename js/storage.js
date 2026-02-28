/* ===== localStorage データ管理モジュール =====
 * window.StorageAPI として公開する共通モジュール。
 * sourceType: 'script'（ES modules 不使用、<script> タグで app.js より前に読み込む）
 *
 * データ構造（localStorage キー: 'workflowHistory'）:
 * {
 *   "history": [
 *     {
 *       "date": "2026-02-28",        // YYYY-MM-DD
 *       "slackProcessed": 3,         // AI で課題を生成した回数
 *       "backlogCreated": ["BLG-123"] // 登録した課題キーの配列
 *     }
 *   ]
 * }
 * ============================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'workflowHistory';

  // ---- 内部ユーティリティ ------------------------------------------

  /**
   * localStorage から履歴配列を取得する。
   * JSON が壊れている場合は空配列を返す。
   * @returns {Array}
   */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { return []; }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.history) ? parsed.history : [];
    } catch {
      return [];
    }
  }

  /**
   * 履歴配列を localStorage に保存する。
   * @param {Array} history
   */
  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: history }));
  }

  /**
   * 本日の日付文字列（YYYY-MM-DD）を返す。
   * @returns {string}
   */
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 指定日のレコードを取得する。なければ null を返す。
   * @param {Array}  history
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Object|null}
   */
  function findRecord(history, dateStr) {
    return history.find(function (r) { return r.date === dateStr; }) || null;
  }

  /**
   * 指定日のレコードを取得する。なければ新規作成して配列に追加する。
   * @param {Array}  history
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Object}
   */
  function getOrCreateRecord(history, dateStr) {
    let record = findRecord(history, dateStr);
    if (!record) {
      record = { date: dateStr, slackProcessed: 0, backlogCreated: [] };
      history.push(record);
    }
    return record;
  }

  // ---- 公開 API 関数 ---------------------------------------------

  /**
   * 当日の slackProcessed を +1 する。
   */
  function recordSlackProcessed() {
    const history = loadHistory();
    const record  = getOrCreateRecord(history, todayStr());
    record.slackProcessed += 1;
    saveHistory(history);
  }

  /**
   * 当日の backlogCreated に課題キーを追加する。
   * @param {string} issueKey - 例: 'BLG-123'
   */
  function recordBacklogCreated(issueKey) {
    const history = loadHistory();
    const record  = getOrCreateRecord(history, todayStr());
    if (!Array.isArray(record.backlogCreated)) {
      record.backlogCreated = [];
    }
    record.backlogCreated.push(String(issueKey));
    saveHistory(history);
  }

  /**
   * 指定日のレコードを返す。なければ null を返す。
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Object|null}
   */
  function getHistoryByDate(dateStr) {
    const history = loadHistory();
    return findRecord(history, dateStr);
  }

  /**
   * 指定月の全レコードを返す（配列）。
   * @param {string} yearMonth - YYYY-MM
   * @returns {Array}
   */
  function getHistoryByMonth(yearMonth) {
    const history = loadHistory();
    return history.filter(function (r) { return r.date.startsWith(yearMonth); });
  }

  /**
   * 指定日の集計オブジェクトを返す。
   * レコードが存在しない場合は { slackProcessed: 0, backlogCreated: [] } を返す。
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {{ slackProcessed: number, backlogCreated: string[] }}
   */
  function getDailySummary(dateStr) {
    const record = getHistoryByDate(dateStr);
    if (!record) {
      return { slackProcessed: 0, backlogCreated: [] };
    }
    return {
      slackProcessed: record.slackProcessed || 0,
      backlogCreated: Array.isArray(record.backlogCreated) ? record.backlogCreated : [],
    };
  }

  /**
   * 指定月の集計オブジェクトを返す。
   * @param {string} yearMonth - YYYY-MM
   * @returns {{ totalSlack: number, totalBacklog: number, byDate: Object }}
   */
  function getMonthlySummary(yearMonth) {
    const records    = getHistoryByMonth(yearMonth);
    let totalSlack   = 0;
    let totalBacklog = 0;
    const byDate     = {};

    records.forEach(function (r) {
      const slack   = r.slackProcessed || 0;
      const backlog = Array.isArray(r.backlogCreated) ? r.backlogCreated.length : 0;
      totalSlack   += slack;
      totalBacklog += backlog;
      byDate[r.date] = backlog;
    });

    return { totalSlack: totalSlack, totalBacklog: totalBacklog, byDate: byDate };
  }

  /**
   * 全履歴配列を返す。
   * @returns {Array}
   */
  function getAllHistory() {
    return loadHistory();
  }

  // ---- グローバル公開 --------------------------------------------

  window.StorageAPI = {
    recordSlackProcessed,
    recordBacklogCreated,
    getHistoryByDate,
    getHistoryByMonth,
    getDailySummary,
    getMonthlySummary,
    getAllHistory,
  };

}());
