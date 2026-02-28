/* ===== Gemini API クライアント =====
 * window.GeminiAPI として公開する共通モジュール。
 * sourceType: 'script'（ES modules 不使用、<script> タグで app.js より前に読み込む）
 *
 * 対応機能:
 *   - テキスト生成（generateText）
 *   - 画像 + テキスト生成（generateWithImages）
 *
 * モデル: gemini-2.0-flash
 * 無料枠: 15 RPM / 1,500 RPD
 * ===================================== */

(function () {
  'use strict';

  const MODEL    = 'gemini-2.0-flash';
  const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  // ---- 設定取得 --------------------------------------------------

  /**
   * localStorage から Gemini API キーを取得する。
   * @returns {string}
   */
  function getApiKey() {
    return localStorage.getItem('geminiApiKey') || '';
  }

  /**
   * API キーが設定されているか確認し、未設定なら Error を投げる。
   * @param {string} apiKey
   */
  function assertApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API キーが未設定です。設定画面で設定してください。');
    }
  }

  // ---- ヘルパー --------------------------------------------------

  /**
   * File オブジェクトを Base64 文字列（データ部分のみ）に変換する。
   * @param {File} file
   * @returns {Promise<string>}
   */
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload  = function () { resolve(reader.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- 共通 fetch ------------------------------------------------

  /**
   * Gemini API にリクエストを送り、生成テキストを返す。
   * @param {Object[]} parts - Gemini API の parts 配列
   * @returns {Promise<string>}
   */
  async function callGemini(parts) {
    const apiKey = getApiKey();
    assertApiKey(apiKey);

    const url = `${BASE_URL}?key=${encodeURIComponent(apiKey)}`;

    let res;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents: [{ parts: parts }],
        }),
      });
    } catch {
      throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
    }

    if (res.status === 429) {
      throw new Error('リクエストが多すぎます。しばらく待ってから再試行してください。');
    }

    if (!res.ok) {
      const body = await res.json().catch(function () { return {}; });
      const msg  = body.error?.message ?? `Gemini API エラー (${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text === undefined || text === null) {
      throw new Error('Gemini API から有効な応答が得られませんでした（安全フィルタ等が適用された可能性があります）。');
    }

    return text;
  }

  // ---- 公開 API 関数 ---------------------------------------------

  /**
   * テキストプロンプトから回答を生成する。
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async function generateText(prompt) {
    return callGemini([{ text: prompt }]);
  }

  /**
   * 画像ファイルを含むプロンプトで回答を生成する（Vision）。
   * @param {string}   prompt     - テキストプロンプト
   * @param {File[]}   imageFiles - 画像ファイルの配列（PNG / JPEG / GIF）
   * @returns {Promise<string>}
   */
  async function generateWithImages(prompt, imageFiles) {
    const parts = [{ text: prompt }];

    const imageConversions = Array.from(imageFiles).map(async function (file) {
      const base64 = await fileToBase64(file);
      return {
        inline_data: {
          mime_type: file.type || 'image/png',
          data:      base64,
        },
      };
    });

    const imageParts = await Promise.all(imageConversions);
    imageParts.forEach(function (part) { parts.push(part); });

    return callGemini(parts);
  }

  // ---- グローバル公開 --------------------------------------------

  window.GeminiAPI = {
    generateText,
    generateWithImages,
  };

}());
