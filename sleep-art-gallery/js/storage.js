/* ============================================
   storage.js - データ永続化モジュール

   localStorageを使って睡眠データを保存・取得する。
   ブラウザを閉じてもデータが残る。

   データ構造:
   {
     records: [         // 睡眠記録の配列
       {
         id: "2024-01-15",  // 日付をIDとして使用
         bedtime: "...",     // 就寝時刻（ISO文字列）
         wakeTime: "...",    // 起床時刻（ISO文字列）
         duration: 7.5,      // 睡眠時間（時間）
         artSeed: 12345      // アート生成用のランダムシード
       }
     ],
     currentBedtime: null,   // 就寝中の場合、就寝時刻
     achievements: [],       // 解除済み実績のID配列
   }
   ============================================ */

// localStorageのキー名（アプリ固有の名前にして他と衝突しないようにする）
const STORAGE_KEY = 'sleep-art-gallery-data';

/**
 * SleepStorage クラス
 * データの保存・読み取りを担当する
 */
class SleepStorage {

  /**
   * ストレージからデータを読み込む
   * データがなければ初期値を返す
   */
  static load() {
    try {
      // localStorageからJSON文字列を取得
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) {
        // JSON文字列をオブジェクトに変換して返す
        return JSON.parse(json);
      }
    } catch (e) {
      // データが壊れていた場合はコンソールに警告を出す
      console.warn('データの読み込みに失敗しました:', e);
    }

    // データがない場合は初期値を返す
    return {
      records: [],
      currentBedtime: null,
      achievements: [],
      alarmTime: null,  // アラーム時刻（"HH:MM" 形式、未設定時はnull）
    };
  }

  /**
   * データをストレージに保存する
   * @param {Object} data - 保存するデータ
   */
  static save(data) {
    try {
      // オブジェクトをJSON文字列に変換して保存
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('データの保存に失敗しました:', e);
    }
  }

  // === 睡眠記録の操作 ===

  /**
   * 就寝を記録する（「おやすみ」ボタン押下時）
   * @param {Date} time - 就寝時刻（省略時は現在時刻）
   */
  static startSleep(time = new Date()) {
    const data = this.load();
    data.currentBedtime = time.toISOString();
    this.save(data);
    return data;
  }

  /**
   * 起床を記録する（「おはよう」ボタン押下時）
   * 睡眠時間を計算し、レコードを保存する
   * @param {Date} time - 起床時刻（省略時は現在時刻）
   */
  static endSleep(time = new Date()) {
    const data = this.load();

    // 就寝中でなければ何もしない
    if (!data.currentBedtime) return null;

    // 就寝時刻と起床時刻から睡眠時間を計算
    const bedtime = new Date(data.currentBedtime);
    const wakeTime = time;
    const durationMs = wakeTime - bedtime;
    const durationHours = durationMs / (1000 * 60 * 60);  // ミリ秒→時間

    // 日付IDを生成（起床日を基準にする）
    const dateId = this.formatDate(wakeTime);

    // アート用のランダムシードを生成
    const artSeed = Math.floor(Math.random() * 1000000);

    // 新しい睡眠記録を作成
    const record = {
      id: dateId,
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      duration: Math.round(durationHours * 100) / 100,  // 小数点2桁
      artSeed: artSeed,
    };

    // 同じ日付の記録があれば上書き、なければ追加
    const existingIndex = data.records.findIndex(r => r.id === dateId);
    if (existingIndex >= 0) {
      data.records[existingIndex] = record;
    } else {
      data.records.push(record);
    }

    // 就寝中状態をリセット
    data.currentBedtime = null;

    this.save(data);
    return record;
  }

  /**
   * 特定の日付の記録を取得する
   * @param {string} dateId - "YYYY-MM-DD" 形式の日付
   */
  static getRecord(dateId) {
    const data = this.load();
    return data.records.find(r => r.id === dateId) || null;
  }

  /**
   * 全記録を取得する
   */
  static getAllRecords() {
    const data = this.load();
    return data.records;
  }

  /**
   * 現在就寝中かどうかを確認する
   */
  static isSleeping() {
    const data = this.load();
    return data.currentBedtime !== null;
  }

  /**
   * 就寝中の場合、就寝時刻を取得する
   */
  static getCurrentBedtime() {
    const data = this.load();
    return data.currentBedtime ? new Date(data.currentBedtime) : null;
  }

  // === アラームの操作 ===

  /**
   * アラーム時刻を設定する
   * @param {string} timeStr - "HH:MM" 形式の時刻文字列
   */
  static setAlarm(timeStr) {
    const data = this.load();
    data.alarmTime = timeStr;
    this.save(data);
  }

  /**
   * アラーム時刻を取得する
   * @returns {string|null} "HH:MM" 形式、未設定時はnull
   */
  static getAlarm() {
    const data = this.load();
    return data.alarmTime || null;
  }

  /**
   * アラームをクリア（解除）する
   */
  static clearAlarm() {
    const data = this.load();
    data.alarmTime = null;
    this.save(data);
  }

  // === 実績の操作 ===

  /**
   * 実績を解除する
   * @param {string} achievementId - 実績のID
   * @returns {boolean} 新しく解除されたかどうか
   */
  static unlockAchievement(achievementId) {
    const data = this.load();
    if (!data.achievements.includes(achievementId)) {
      data.achievements.push(achievementId);
      this.save(data);
      return true;  // 新規解除
    }
    return false;  // 既に解除済み
  }

  /**
   * 解除済み実績の一覧を取得する
   */
  static getAchievements() {
    const data = this.load();
    return data.achievements;
  }

  // === 統計情報 ===

  /**
   * 連続記録日数（ストリーク）を計算する
   * 今日から遡って何日連続で記録があるかを数える
   */
  static getStreak() {
    const data = this.load();
    if (data.records.length === 0) return 0;

    let streak = 0;
    const today = new Date();

    // 今日から1日ずつ遡って確認
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateId = this.formatDate(checkDate);

      if (data.records.find(r => r.id === dateId)) {
        streak++;
      } else {
        // 今日の記録がない場合でも就寝中なら継続とみなす
        if (i === 0 && data.currentBedtime) {
          continue;
        }
        // 今日の記録がまだない場合は昨日から数え始める
        if (i === 0) {
          continue;
        }
        break;  // 記録が途切れたらストップ
      }
    }

    return streak;
  }

  /**
   * 平均睡眠時間を計算する
   * @param {number} days - 直近何日分を対象にするか（省略時は全件）
   */
  static getAverageDuration(days) {
    const data = this.load();
    let records = data.records;

    if (days) {
      // 直近N日分だけに絞る
      records = records.slice(-days);
    }

    if (records.length === 0) return 0;

    // 睡眠時間の合計 ÷ レコード数 = 平均
    const total = records.reduce((sum, r) => sum + r.duration, 0);
    return Math.round((total / records.length) * 10) / 10;  // 小数点1桁
  }

  // === ユーティリティ ===

  /**
   * Date オブジェクトを "YYYY-MM-DD" 形式の文字列に変換する
   * @param {Date} date
   */
  static formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
