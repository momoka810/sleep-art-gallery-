/* ============================================
   app.js - メインアプリケーション

   アプリ全体の制御を行う:
   - 画面（ビュー）の切り替え
   - 時計の更新
   - 睡眠ボタンのイベント処理
   - ギャラリー（カレンダー）の表示
   - 実績の判定と通知
   ============================================ */

/* ============================================
   実績の定義
   ============================================ */
const ACHIEVEMENTS = [
  {
    id: 'first_night',
    name: 'はじめての夜',
    description: '初めて睡眠を記録する',
    icon: '🌟',
    // この実績が解除されるかチェックする関数
    check: (records) => records.length >= 1,
  },
  {
    id: 'early_bird',
    name: 'アーリーバード',
    description: '22時前に就寝する',
    icon: '🐦',
    check: (records) => records.some(r => {
      const hour = new Date(r.bedtime).getHours();
      return hour >= 18 && hour < 22;
    }),
  },
  {
    id: 'night_owl',
    name: 'ナイトオウル',
    description: '深夜2時以降に就寝する',
    icon: '🦉',
    check: (records) => records.some(r => {
      const hour = new Date(r.bedtime).getHours();
      return hour >= 2 && hour < 6;
    }),
  },
  {
    id: 'perfect_sleep',
    name: 'パーフェクトスリープ',
    description: '7〜8時間の理想的な睡眠をとる',
    icon: '💎',
    check: (records) => records.some(r => r.duration >= 7 && r.duration <= 8),
  },
  {
    id: 'long_sleep',
    name: 'ぐっすり',
    description: '9時間以上眠る',
    icon: '😴',
    check: (records) => records.some(r => r.duration >= 9),
  },
  {
    id: 'week_warrior',
    name: 'ウィークウォリアー',
    description: '7日連続で記録する',
    icon: '⚔️',
    check: (records, streak) => streak >= 7,
  },
  {
    id: 'two_week_master',
    name: '2週間マスター',
    description: '14日連続で記録する',
    icon: '🏅',
    check: (records, streak) => streak >= 14,
  },
  {
    id: 'art_collector',
    name: 'アートコレクター',
    description: '10作品のアートを集める',
    icon: '🎨',
    check: (records) => records.length >= 10,
  },
  {
    id: 'gallery_master',
    name: 'ギャラリーマスター',
    description: '30作品のアートを集める',
    icon: '🖼️',
    check: (records) => records.length >= 30,
  },
  {
    id: 'sleep_champion',
    name: 'スリープチャンピオン',
    description: '30日連続で記録する',
    icon: '👑',
    check: (records, streak) => streak >= 30,
  },
];

/* ============================================
   メインアプリケーションクラス
   ============================================ */
class SleepApp {

  constructor() {
    // 現在表示中のギャラリー月
    this.galleryDate = new Date();

    // アラーム関連の状態
    this.alarmTimerId = null;     // setTimeout のID（キャンセル用）
    this.alarmAudioCtx = null;    // Web Audio API のコンテキスト
    this.alarmOscillator = null;  // 発音中のオシレーター
    this.alarmGain = null;        // 音量制御ノード
    this.isAlarmRinging = false;  // アラーム鳴動中フラグ

    // 初期化処理を実行
    this.init();
  }

  /**
   * アプリの初期化
   */
  init() {
    // ナビゲーションのイベント設定
    this.setupNavigation();

    // 睡眠ボタンのイベント設定
    this.setupSleepButtons();

    // ギャラリーのイベント設定
    this.setupGallery();

    // モーダルのイベント設定
    this.setupModal();

    // アラームのイベント設定
    this.setupAlarm();

    // 時計の更新を開始（1秒ごと）
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // 就寝中の経過時間更新（1秒ごと）
    setInterval(() => this.updateSleepingElapsed(), 1000);

    // アラームチェック（1秒ごとに時刻を照合）
    setInterval(() => this.checkAlarmTime(), 1000);

    // 画面の初期表示を更新
    this.updateHomeView();

    // 既にアラームが設定済みならタイマーを復元
    this.restoreAlarm();
  }

  // ============================
  // ナビゲーション
  // ============================

  /**
   * ナビゲーションボタンのクリックイベントを設定する
   */
  setupNavigation() {
    // 全ナビゲーションボタンにクリックイベントを設定
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewName = btn.dataset.view;
        this.switchView(viewName);
      });
    });
  }

  /**
   * ビュー（画面）を切り替える
   * @param {string} viewName - "home", "gallery", "achievements" のいずれか
   */
  switchView(viewName) {
    // 全ビューを非表示にする
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // 全ナビボタンのアクティブ状態を解除
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // 指定されたビューを表示
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // 対応するナビボタンをアクティブに
    const targetBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
    if (targetBtn) {
      targetBtn.classList.add('active');
    }

    // ビューごとの初期化処理
    if (viewName === 'gallery') {
      this.renderCalendar();
    } else if (viewName === 'achievements') {
      this.renderAchievements();
    }
  }

  // ============================
  // 時計
  // ============================

  /**
   * 画面上の時計を現在時刻で更新する
   */
  updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
  }

  // ============================
  // 睡眠記録
  // ============================

  /**
   * 睡眠ボタンのイベントを設定する
   */
  setupSleepButtons() {
    const btnSleep = document.getElementById('btn-sleep');
    const btnWake = document.getElementById('btn-wake');

    // 「おやすみ」ボタン
    btnSleep.addEventListener('click', () => this.handleSleep());

    // 「おはよう」ボタン
    btnWake.addEventListener('click', () => this.handleWake());
  }

  /**
   * 「おやすみ」ボタンが押された時の処理
   * → まずアラーム設定パネルを表示する
   */
  handleSleep() {
    // アラーム設定パネルを表示（就寝はまだ記録しない）
    const panel = document.getElementById('alarm-panel');
    panel.classList.remove('hidden');

    // おやすみボタンを一時的に無効化
    document.getElementById('btn-sleep').disabled = true;

    // ステータスメッセージを更新
    document.getElementById('status-message').textContent = '目覚ましを設定しますか？';
  }

  /**
   * アラーム設定を確定して就寝を記録する
   * @param {string|null} alarmTime - "HH:MM" 形式、スキップ時はnull
   */
  confirmSleep(alarmTime) {
    // アラーム設定パネルを非表示
    document.getElementById('alarm-panel').classList.add('hidden');

    // 就寝時刻を記録
    SleepStorage.startSleep();

    // アラームを設定（設定された場合のみ）
    if (alarmTime) {
      SleepStorage.setAlarm(alarmTime);
      this.scheduleAlarm(alarmTime);
    }

    // ボタンの状態を更新
    this.updateHomeView();

    // ステータスメッセージを更新
    if (alarmTime) {
      document.getElementById('status-message').textContent =
        `おやすみなさい... ${alarmTime} にお起こしします`;
    } else {
      document.getElementById('status-message').textContent = 'おやすみなさい...良い夢を';
    }
  }

  /**
   * 「おはよう」ボタンが押された時の処理
   */
  handleWake() {
    // アラームが鳴っていたら止める
    this.stopAlarm();

    // 起床を記録し、睡眠データを取得
    const record = SleepStorage.endSleep();

    if (record) {
      // ステータスメッセージを更新
      document.getElementById('status-message').textContent = 'おはようございます！アートを生成しました';

      // 今日のアートを表示
      this.showTodayArt(record);

      // 実績をチェック
      this.checkAchievements();
    }

    // ホーム画面を更新
    this.updateHomeView();
  }

  /**
   * ホーム画面の状態を更新する
   * （ボタンの有効/無効、統計情報など）
   */
  updateHomeView() {
    const isSleeping = SleepStorage.isSleeping();
    const btnSleep = document.getElementById('btn-sleep');
    const btnWake = document.getElementById('btn-wake');
    const sleepingInfo = document.getElementById('sleeping-info');

    // 就寝中かどうかでボタンの状態を切り替え
    btnSleep.disabled = isSleeping;
    btnWake.disabled = !isSleeping;

    // 就寝中の情報表示
    if (isSleeping) {
      sleepingInfo.classList.remove('hidden');
      const bedtime = SleepStorage.getCurrentBedtime();
      const timeStr = this.formatTime(bedtime);
      document.getElementById('sleeping-since').textContent = `${timeStr} から就寝中`;
      this.updateSleepingElapsed();

      // アラーム状態を表示
      const alarmTime = SleepStorage.getAlarm();
      const alarmStatus = document.getElementById('alarm-status');
      if (alarmTime) {
        alarmStatus.classList.remove('hidden');
        document.getElementById('alarm-status-time').textContent = `${alarmTime} にアラーム`;
      } else {
        alarmStatus.classList.add('hidden');
      }
    } else {
      sleepingInfo.classList.add('hidden');
    }

    // 統計情報を更新
    this.updateStats();

    // 今日の記録があれば表示
    const today = SleepStorage.formatDate(new Date());
    const todayRecord = SleepStorage.getRecord(today);
    if (todayRecord && !isSleeping) {
      this.showTodayArt(todayRecord);
    }
  }

  /**
   * 就寝中の経過時間を更新する
   */
  updateSleepingElapsed() {
    if (!SleepStorage.isSleeping()) return;

    const bedtime = SleepStorage.getCurrentBedtime();
    const elapsed = new Date() - bedtime;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

    const elapsedStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const elapsedEl = document.getElementById('sleeping-elapsed');
    if (elapsedEl) {
      elapsedEl.textContent = elapsedStr;
    }
  }

  /**
   * 統計カードの値を更新する
   */
  updateStats() {
    const streak = SleepStorage.getStreak();
    const records = SleepStorage.getAllRecords();
    const avg = SleepStorage.getAverageDuration();

    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-total').textContent = records.length;
    document.getElementById('stat-avg').textContent = avg > 0
      ? `${avg}h`
      : '-';
  }

  /**
   * 今日のアート作品を生成して表示する
   */
  showTodayArt(record) {
    const section = document.getElementById('today-art-section');
    const canvas = document.getElementById('today-art-canvas');
    const info = document.getElementById('today-sleep-info');

    // セクションを表示
    section.classList.remove('hidden');

    // アートを生成
    const streak = SleepStorage.getStreak();
    SleepArtGenerator.generate(canvas, record, { streak });

    // 睡眠情報を表示
    const bedtime = new Date(record.bedtime);
    const wakeTime = new Date(record.wakeTime);
    const hours = Math.floor(record.duration);
    const minutes = Math.round((record.duration - hours) * 60);

    info.innerHTML = `
      <div class="sleep-duration">${hours}時間${minutes}分</div>
      <div>就寝: ${this.formatTime(bedtime)} → 起床: ${this.formatTime(wakeTime)}</div>
    `;

    // アートクリックでモーダル表示
    const container = document.querySelector('.today-art-container');
    container.onclick = () => this.openModal(record);
  }

  // ============================
  // アラーム機能
  // ============================

  /**
   * アラーム関連のイベントを設定する
   */
  setupAlarm() {
    // 「セットして寝る」ボタン
    document.getElementById('alarm-set-btn').addEventListener('click', () => {
      const timeInput = document.getElementById('alarm-time-input');
      this.confirmSleep(timeInput.value);
    });

    // 「設定せずに寝る」ボタン
    document.getElementById('alarm-skip-btn').addEventListener('click', () => {
      this.confirmSleep(null);
    });

    // アラーム取消ボタン（就寝中の表示内）
    document.getElementById('alarm-cancel-btn').addEventListener('click', () => {
      this.cancelAlarm();
    });

    // アラーム停止ボタン（鳴動オーバーレイ内）
    document.getElementById('alarm-stop-btn').addEventListener('click', () => {
      this.stopAlarm();
    });

    // ブラウザ通知の許可をリクエスト（ユーザー操作時に行う）
    document.getElementById('alarm-set-btn').addEventListener('click', () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, { once: true });
  }

  /**
   * アラーム時刻をスケジュールする
   * 指定時刻に鳴動するようsetTimeoutを設定する
   *
   * @param {string} timeStr - "HH:MM" 形式の時刻
   */
  scheduleAlarm(timeStr) {
    // 既存のタイマーがあればクリア
    if (this.alarmTimerId) {
      clearTimeout(this.alarmTimerId);
    }

    const [hours, minutes] = timeStr.split(':').map(Number);

    // 目標時刻を計算
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    // 既に過ぎていたら翌日に設定
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    // 目標時刻までのミリ秒を計算
    const msUntilAlarm = target - now;

    console.log(`アラーム設定: ${timeStr}（${Math.round(msUntilAlarm / 60000)}分後）`);

    // setTimeoutでスケジュール
    this.alarmTimerId = setTimeout(() => {
      this.triggerAlarm();
    }, msUntilAlarm);
  }

  /**
   * ページ再読み込み後にアラームを復元する
   * （タブを閉じなければアラームが維持される）
   */
  restoreAlarm() {
    if (SleepStorage.isSleeping()) {
      const alarmTime = SleepStorage.getAlarm();
      if (alarmTime) {
        this.scheduleAlarm(alarmTime);
      }
    }
  }

  /**
   * アラームを発動する
   * - 音を鳴らす
   * - オーバーレイを表示する
   * - ブラウザ通知を送る
   */
  triggerAlarm() {
    this.isAlarmRinging = true;

    // アラーム音を再生（Web Audio API）
    this.playAlarmSound();

    // アラーム発動オーバーレイを表示
    const overlay = document.getElementById('alarm-overlay');
    overlay.classList.remove('hidden');

    // 現在時刻を表示
    const now = new Date();
    document.getElementById('alarm-ring-time').textContent = this.formatTime(now);

    // ブラウザ通知を送信
    this.sendAlarmNotification();
  }

  /**
   * Web Audio API でアラーム音を生成・再生する
   * 穏やかなベル風の音を繰り返し鳴らす
   */
  playAlarmSound() {
    try {
      // AudioContextを作成
      this.alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.alarmAudioCtx;

      // 音量制御ノード（マスターボリューム）
      this.alarmGain = ctx.createGain();
      this.alarmGain.gain.value = 0.3;  // 控えめな音量
      this.alarmGain.connect(ctx.destination);

      // 穏やかなメロディを繰り返し鳴らす
      this.playAlarmMelody(ctx, this.alarmGain);

    } catch (e) {
      console.warn('アラーム音の再生に失敗しました:', e);
    }
  }

  /**
   * アラームのメロディを鳴らす
   * 心地よい周波数のトーンを順番に鳴らす
   */
  playAlarmMelody(ctx, gainNode) {
    // 穏やかなメロディ（周波数: Hz）
    // C5 → E5 → G5 → C6 の和音的なパターン
    const notes = [523, 659, 784, 1047, 784, 659];
    const noteDuration = 0.3;   // 1音の長さ（秒）
    const noteGap = 0.15;       // 音と音の間隔（秒）
    const patternGap = 1.5;     // パターン間の休止（秒）

    let time = ctx.currentTime;

    // メロディパターンを1回分鳴らす
    notes.forEach((freq) => {
      // オシレーター（音源）を作成
      const osc = ctx.createOscillator();
      osc.type = 'sine';       // サイン波（柔らかい音）
      osc.frequency.value = freq;

      // 個別の音量エンベロープ（ふわっと鳴ってふわっと消える）
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(0.5, time + 0.05);  // アタック
      noteGain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration);  // リリース

      osc.connect(noteGain);
      noteGain.connect(gainNode);

      osc.start(time);
      osc.stop(time + noteDuration);

      time += noteDuration + noteGap;
    });

    // パターンの総時間を計算
    const patternDuration = notes.length * (noteDuration + noteGap) + patternGap;

    // アラームが鳴り続けている間、メロディを繰り返す
    this.alarmMelodyTimer = setTimeout(() => {
      if (this.isAlarmRinging) {
        this.playAlarmMelody(ctx, gainNode);
      }
    }, patternDuration * 1000);
  }

  /**
   * ブラウザ通知を送信する
   */
  sendAlarmNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Sleep Art Gallery', {
        body: 'おはようございます！起きる時間です',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
      });
    }
  }

  /**
   * 1秒ごとにアラーム時刻を照合する
   * （setTimeoutの精度補完として使用）
   */
  checkAlarmTime() {
    if (!SleepStorage.isSleeping() || this.isAlarmRinging) return;

    const alarmTime = SleepStorage.getAlarm();
    if (!alarmTime) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 時刻が一致したらアラーム発動
    if (currentTime === alarmTime && now.getSeconds() < 2) {
      this.triggerAlarm();
    }
  }

  /**
   * アラームを停止する
   * - 音を止める
   * - オーバーレイを閉じる
   * - タイマーをクリアする
   */
  stopAlarm() {
    this.isAlarmRinging = false;

    // メロディの繰り返しを停止
    if (this.alarmMelodyTimer) {
      clearTimeout(this.alarmMelodyTimer);
      this.alarmMelodyTimer = null;
    }

    // AudioContextを閉じて音を完全に止める
    if (this.alarmAudioCtx) {
      this.alarmAudioCtx.close().catch(() => {});
      this.alarmAudioCtx = null;
    }

    // タイマーをクリア
    if (this.alarmTimerId) {
      clearTimeout(this.alarmTimerId);
      this.alarmTimerId = null;
    }

    // オーバーレイを閉じる
    document.getElementById('alarm-overlay').classList.add('hidden');

    // ストレージからアラームをクリア
    SleepStorage.clearAlarm();

    // ホーム画面を更新
    this.updateHomeView();
  }

  /**
   * アラームをキャンセルする（就寝中にアラームだけ解除）
   */
  cancelAlarm() {
    // タイマーをクリア
    if (this.alarmTimerId) {
      clearTimeout(this.alarmTimerId);
      this.alarmTimerId = null;
    }

    // ストレージからアラームをクリア
    SleepStorage.clearAlarm();

    // 画面を更新
    this.updateHomeView();

    document.getElementById('status-message').textContent = 'アラームを解除しました';
  }

  // ============================
  // ギャラリー（カレンダー）
  // ============================

  /**
   * ギャラリーのイベントを設定する
   */
  setupGallery() {
    // 前月・翌月ボタン
    document.getElementById('prev-month').addEventListener('click', () => {
      this.galleryDate.setMonth(this.galleryDate.getMonth() - 1);
      this.renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      this.galleryDate.setMonth(this.galleryDate.getMonth() + 1);
      this.renderCalendar();
    });
  }

  /**
   * カレンダーを描画する
   */
  renderCalendar() {
    const year = this.galleryDate.getFullYear();
    const month = this.galleryDate.getMonth();

    // 月の表示を更新
    const monthNames = [
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    document.getElementById('gallery-month').textContent =
      `${year}年 ${monthNames[month]}`;

    // カレンダーのボディをクリア
    const body = document.getElementById('calendar-body');
    body.innerHTML = '';

    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();  // 0=日曜
    const daysInMonth = lastDay.getDate();

    // 今日の日付（比較用）
    const today = SleepStorage.formatDate(new Date());

    // カレンダーの空白セルを追加（月の最初の曜日まで）
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day';
      body.appendChild(emptyCell);
    }

    // 各日のセルを作成
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dateId = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      cell.className = 'calendar-day current-month';

      // 今日の日付にマーク
      if (dateId === today) {
        cell.classList.add('today');
      }

      // この日の睡眠記録があるかチェック
      const record = SleepStorage.getRecord(dateId);

      if (record) {
        // 睡眠記録がある → アートのサムネイルを生成
        cell.classList.add('has-art');

        // サムネイル用の小さなキャンバスを作成
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 80;
        thumbCanvas.height = 80;
        cell.appendChild(thumbCanvas);

        // アートを生成（サムネイルサイズ）
        const streak = SleepStorage.getStreak();
        SleepArtGenerator.generate(thumbCanvas, record, { streak });

        // クリックでモーダル表示
        cell.addEventListener('click', () => this.openModal(record));
      }

      // 日付番号を表示
      const dayNum = document.createElement('span');
      dayNum.className = 'day-number';
      dayNum.textContent = day;
      cell.appendChild(dayNum);

      body.appendChild(cell);
    }
  }

  // ============================
  // モーダル
  // ============================

  /**
   * モーダルのイベントを設定する
   */
  setupModal() {
    const modal = document.getElementById('art-modal');
    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');

    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', () => this.closeModal());

    // 閉じるボタン
    closeBtn.addEventListener('click', () => this.closeModal());

    // Escキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  /**
   * モーダルを開いてアートを拡大表示する
   * @param {Object} record - 睡眠記録
   */
  openModal(record) {
    const modal = document.getElementById('art-modal');
    const canvas = document.getElementById('modal-art-canvas');
    const info = document.getElementById('modal-sleep-info');

    // モーダルを表示
    modal.classList.remove('hidden');

    // 大きなサイズでアートを生成
    const streak = SleepStorage.getStreak();
    SleepArtGenerator.generate(canvas, record, { streak });

    // 睡眠データの詳細を表示
    const bedtime = new Date(record.bedtime);
    const wakeTime = new Date(record.wakeTime);
    const hours = Math.floor(record.duration);
    const minutes = Math.round((record.duration - hours) * 60);

    info.innerHTML = `
      <strong>${record.id}</strong>のアート<br>
      睡眠時間: <strong>${hours}時間${minutes}分</strong><br>
      就寝: ${this.formatTime(bedtime)} → 起床: ${this.formatTime(wakeTime)}
    `;

    // スクロールを無効化
    document.body.style.overflow = 'hidden';
  }

  /**
   * モーダルを閉じる
   */
  closeModal() {
    const modal = document.getElementById('art-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ============================
  // 実績
  // ============================

  /**
   * 実績の解除条件をチェックする
   * 新しく解除された実績があればトースト通知を表示する
   */
  checkAchievements() {
    const records = SleepStorage.getAllRecords();
    const streak = SleepStorage.getStreak();
    const unlockedIds = SleepStorage.getAchievements();

    // 全実績をチェック
    for (const achievement of ACHIEVEMENTS) {
      // まだ解除されていない実績のみチェック
      if (!unlockedIds.includes(achievement.id)) {
        // 解除条件を満たしているかチェック
        if (achievement.check(records, streak)) {
          // 実績を解除
          const isNew = SleepStorage.unlockAchievement(achievement.id);
          if (isNew) {
            // トースト通知を表示
            this.showAchievementToast(achievement);
          }
        }
      }
    }
  }

  /**
   * 実績解除のトースト通知を表示する
   * @param {Object} achievement - 解除された実績
   */
  showAchievementToast(achievement) {
    const toast = document.getElementById('achievement-toast');
    const message = document.getElementById('toast-message');

    message.textContent = `${achievement.icon} ${achievement.name}`;

    // トーストを表示（アニメーション付き）
    toast.classList.remove('hidden');

    // 4秒後に非表示
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }

  /**
   * 実績一覧を描画する
   */
  renderAchievements() {
    const list = document.getElementById('achievements-list');
    const unlockedIds = SleepStorage.getAchievements();

    list.innerHTML = '';

    for (const achievement of ACHIEVEMENTS) {
      const isUnlocked = unlockedIds.includes(achievement.id);

      const card = document.createElement('div');
      card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;

      card.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">
            ${isUnlocked ? '解除済み！' : achievement.description}
          </div>
        </div>
      `;

      list.appendChild(card);
    }
  }

  // ============================
  // ユーティリティ
  // ============================

  /**
   * Date オブジェクトを "HH:MM" 形式の文字列に変換する
   * @param {Date} date
   * @returns {string} "HH:MM" 形式の時刻文字列
   */
  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/* ============================================
   アプリ起動
   ============================================ */

// DOMの読み込み完了後にアプリを起動
document.addEventListener('DOMContentLoaded', () => {
  // グローバル変数にアプリのインスタンスを保存
  // （デバッグ時に便利）
  window.app = new SleepApp();
});
