/* ============================================
   art-generator.js - ジェネラティブアート生成エンジン

   睡眠データからユニークな抽象アートを生成する。

   仕組み:
   - 睡眠時間 → 作品の複雑さ（要素の数、レイヤー数）
   - 就寝時刻 → カラーパレット（早寝=青系、遅寝=暖色系）
   - 睡眠の質 → 色の調和度（7-8時間に近いほど調和的）
   - ランダムシード → 同じデータでも毎回同じ絵を再現可能

   描画レイヤー:
   1. 背景グラデーション
   2. 流れる曲線（オーロラ風）
   3. 浮遊する円（ボケ効果）
   4. 幾何学パターン
   5. 星空パーティクル
   6. ストリーク特殊効果
   ============================================ */

/**
 * SleepArtGenerator クラス
 * 睡眠データからアートを生成する
 */
class SleepArtGenerator {

  // === カラーパレット定義 ===
  // 就寝時刻に応じて異なるパレットを使用する
  static PALETTES = {
    // 早寝（~22時）: 穏やかな青・紫系
    serene: [
      '#1a1a4e', '#2d2b7f', '#3f51b5', '#7986cb', '#c5cae9',
      '#4fc3f7', '#81d4fa', '#b3e5fc',
    ],
    // 通常（22~0時）: バランスの取れた紫・ティール系
    twilight: [
      '#1a0a3e', '#4a148c', '#7b1fa2', '#ab47bc', '#ce93d8',
      '#00bcd4', '#26c6da', '#80deea',
    ],
    // 遅め（0~2時）: 温かみのあるピンク・オレンジ系
    midnight: [
      '#1a0a2e', '#880e4f', '#c62828', '#e91e63', '#f06292',
      '#ff7043', '#ffab91', '#ffd54f',
    ],
    // 深夜（2時~）: ゴールド・琥珀系
    latenight: [
      '#1a0f05', '#4e342e', '#bf360c', '#e65100', '#ff8f00',
      '#ffc107', '#ffecb3', '#fff8e1',
    ],
  };

  /**
   * シード付き乱数生成器を作成する
   * 同じシードからは常に同じ乱数列が生成される
   * これにより、同じ睡眠データからは同じアートが再現される
   *
   * @param {number} seed - 乱数のシード値
   * @returns {Function} 0〜1の乱数を返す関数
   */
  static createRandom(seed) {
    // Mulberry32 アルゴリズム（高速で質の良いシード付きPRNG）
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 就寝時刻からカラーパレットを選択する
   * @param {string} bedtimeISO - 就寝時刻のISO文字列
   * @returns {string[]} カラーコードの配列
   */
  static selectPalette(bedtimeISO) {
    const hour = new Date(bedtimeISO).getHours();

    // 時間帯に応じてパレットを返す
    if (hour >= 20 && hour < 22) return this.PALETTES.serene;
    if (hour >= 22 || hour < 0) return this.PALETTES.twilight;
    if (hour >= 0 && hour < 2) return this.PALETTES.midnight;
    return this.PALETTES.latenight;
  }

  /**
   * 2色間を補間する（グラデーション用）
   * @param {string} color1 - 開始色（#RRGGBB形式）
   * @param {string} color2 - 終了色（#RRGGBB形式）
   * @param {number} t - 補間率（0〜1）
   * @returns {string} 補間された色
   */
  static lerpColor(color1, color2, t) {
    // 16進数カラーコードをRGBに分解
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    // 線形補間
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * メインのアート生成関数
   * キャンバスに睡眠データに基づくアートを描画する
   *
   * @param {HTMLCanvasElement} canvas - 描画先のキャンバス
   * @param {Object} record - 睡眠記録
   * @param {Object} options - オプション（streak: 連続日数）
   */
  static generate(canvas, record, options = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const streak = options.streak || 0;

    // シード付き乱数を初期化
    const rand = this.createRandom(record.artSeed);

    // 睡眠データからアートパラメータを計算
    const duration = record.duration;          // 睡眠時間
    const palette = this.selectPalette(record.bedtime);  // カラーパレット

    // 睡眠の「質」スコア（7.5時間を理想として計算）
    // 理想に近いほど1に近く、離れるほど0に近い
    const idealDiff = Math.abs(duration - 7.5);
    const quality = Math.max(0, 1 - idealDiff / 5);

    // 各レイヤーの複雑さ（睡眠時間に比例）
    const complexity = Math.min(1, duration / 10);

    // === レイヤー1: 背景グラデーション ===
    this.drawBackground(ctx, w, h, palette, rand);

    // === レイヤー2: オーロラ風の曲線 ===
    this.drawAurora(ctx, w, h, palette, rand, complexity, quality);

    // === レイヤー3: 浮遊するボケ円 ===
    this.drawOrbs(ctx, w, h, palette, rand, duration, quality);

    // === レイヤー4: 幾何学パターン ===
    this.drawGeometry(ctx, w, h, palette, rand, quality);

    // === レイヤー5: 星空パーティクル ===
    this.drawStars(ctx, w, h, rand, complexity);

    // === レイヤー6: ストリーク特殊効果 ===
    if (streak >= 3) {
      this.drawStreakEffect(ctx, w, h, palette, rand, streak);
    }

    // === 最終仕上げ: ビネット効果（周囲を暗く） ===
    this.drawVignette(ctx, w, h);
  }

  // ============================
  // 各描画レイヤーの実装
  // ============================

  /**
   * レイヤー1: 背景グラデーション
   * 放射状グラデーションで宇宙のような背景を作る
   */
  static drawBackground(ctx, w, h, palette, rand) {
    // メインの放射状グラデーション
    const cx = w * (0.3 + rand() * 0.4);  // 中心を少しランダムにずらす
    const cy = h * (0.3 + rand() * 0.4);
    const radius = Math.max(w, h) * 0.8;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, palette[1] || '#1a1a4e');
    gradient.addColorStop(0.5, palette[0] || '#0a0a2e');
    gradient.addColorStop(1, '#050510');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 2つ目の微妙なグラデーションを重ねて奥行きを出す
    const cx2 = w * rand();
    const cy2 = h * rand();
    const gradient2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, radius * 0.6);
    gradient2.addColorStop(0, this.withAlpha(palette[2] || '#3f51b5', 0.15));
    gradient2.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient2;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * レイヤー2: オーロラ風の曲線
   * 正弦波を重ね合わせて滑らかな帯を描く
   */
  static drawAurora(ctx, w, h, palette, rand, complexity, quality) {
    // 曲線の本数（複雑さに応じて3〜7本）
    const numCurves = 3 + Math.floor(complexity * 4);

    for (let i = 0; i < numCurves; i++) {
      ctx.beginPath();

      // 各曲線のパラメータをランダムに決定
      const amplitude = h * (0.05 + rand() * 0.15);  // 振れ幅
      const frequency = 1 + rand() * 3;               // 周波数
      const phase = rand() * Math.PI * 2;             // 位相
      const yOffset = h * (0.2 + rand() * 0.6);       // Y位置

      // 色を選択（質が高いほど調和的な隣接色を使う）
      const colorIdx = quality > 0.7
        ? Math.floor(rand() * 3) + 2       // 高品質: 調和的な色
        : Math.floor(rand() * palette.length);  // それ以外: ランダム

      // 曲線を描画（左端から右端まで）
      ctx.moveTo(0, yOffset);
      for (let x = 0; x <= w; x += 2) {
        // 複数の正弦波を重ねて自然な曲線を作る
        const y = yOffset
          + Math.sin((x / w) * Math.PI * frequency + phase) * amplitude
          + Math.sin((x / w) * Math.PI * frequency * 2.3 + phase * 1.7) * amplitude * 0.3;
        ctx.lineTo(x, y);
      }

      // 下端まで閉じて塗りつぶす
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      // 半透明のグラデーションで塗る
      const grad = ctx.createLinearGradient(0, yOffset - amplitude, 0, h);
      grad.addColorStop(0, this.withAlpha(palette[colorIdx] || palette[0], 0.08 + quality * 0.06));
      grad.addColorStop(0.5, this.withAlpha(palette[colorIdx] || palette[0], 0.03));
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /**
   * レイヤー3: 浮遊するボケ円
   * 写真のボケ効果のような美しい半透明の円を散りばめる
   */
  static drawOrbs(ctx, w, h, palette, rand, duration, quality) {
    // 円の数（睡眠時間に比例して5〜25個）
    const numOrbs = 5 + Math.floor(duration * 2.5);

    for (let i = 0; i < numOrbs; i++) {
      const x = rand() * w;
      const y = rand() * h;
      // サイズ: 質が高いほど大きくて柔らかい円
      const radius = (10 + rand() * 40) * (0.5 + quality * 0.5) * (w / 400);
      const color = palette[Math.floor(rand() * palette.length)];

      // 放射状グラデーションで柔らかいボケ効果
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, this.withAlpha(color, 0.15 + rand() * 0.15));
      gradient.addColorStop(0.6, this.withAlpha(color, 0.05));
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * レイヤー4: 幾何学パターン
   * 中央に放射状の幾何学模様を描く（マンダラ風）
   */
  static drawGeometry(ctx, w, h, palette, rand, quality) {
    const cx = w / 2;
    const cy = h / 2;

    // 対称の回転数（質に応じて4〜12）
    const symmetry = 4 + Math.floor(quality * 8);
    const angleStep = (Math.PI * 2) / symmetry;

    // 幾何学要素のサイズ
    const maxRadius = Math.min(w, h) * (0.15 + quality * 0.1);

    ctx.save();
    ctx.translate(cx, cy);

    // 各方向に対称な線を描く
    for (let i = 0; i < symmetry; i++) {
      ctx.save();
      ctx.rotate(angleStep * i);

      // 放射線
      const lineLen = maxRadius * (0.5 + rand() * 0.5);
      const color = palette[2 + Math.floor(rand() * (palette.length - 2))];

      ctx.beginPath();
      ctx.moveTo(0, 0);

      // ベジェ曲線で有機的な線を描く
      const cp1x = lineLen * 0.3 * (rand() - 0.5);
      const cp1y = -lineLen * 0.4;
      const cp2x = lineLen * 0.3 * (rand() - 0.5);
      const cp2y = -lineLen * 0.8;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, 0, -lineLen);

      ctx.strokeStyle = this.withAlpha(color, 0.3);
      ctx.lineWidth = 1 + rand() * 1.5;
      ctx.stroke();

      // 先端に小さな円
      ctx.beginPath();
      ctx.arc(0, -lineLen, 2 + rand() * 4, 0, Math.PI * 2);
      ctx.fillStyle = this.withAlpha(color, 0.4);
      ctx.fill();

      ctx.restore();
    }

    // 中央のリング
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = maxRadius * (0.2 + ring * 0.2) * (0.8 + rand() * 0.4);
      const ringColor = palette[Math.floor(rand() * palette.length)];

      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.withAlpha(ringColor, 0.15 + quality * 0.1);
      ctx.lineWidth = 0.5 + rand() * 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * レイヤー5: 星空パーティクル
   * 小さな光の点を散りばめて星空のような効果を出す
   */
  static drawStars(ctx, w, h, rand, complexity) {
    // 星の数（複雑さに応じて30〜150個）
    const numStars = 30 + Math.floor(complexity * 120);

    for (let i = 0; i < numStars; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const size = 0.5 + rand() * 2;
      const brightness = 0.3 + rand() * 0.7;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.5})`;
      ctx.fill();

      // 一部の星にはキラキラ効果（十字の光条）
      if (rand() > 0.85) {
        const glowSize = size * 4;
        ctx.beginPath();
        ctx.moveTo(x - glowSize, y);
        ctx.lineTo(x + glowSize, y);
        ctx.moveTo(x, y - glowSize);
        ctx.lineTo(x, y + glowSize);
        ctx.strokeStyle = `rgba(255, 255, 255, ${brightness * 0.2})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  /**
   * レイヤー6: ストリーク（連続記録）特殊効果
   * 連続記録日数に応じて特別なエフェクトを追加
   */
  static drawStreakEffect(ctx, w, h, palette, rand, streak) {
    // 3日以上: 黄金の輝き効果
    if (streak >= 3) {
      const numGlows = Math.min(streak, 20);
      for (let i = 0; i < numGlows; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const size = 20 + rand() * 30;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 193, 7, 0.03)');
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // 7日以上: 虹色のリング
    if (streak >= 7) {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.35;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 虹色のグラデーションリング
      const segments = 36;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const nextAngle = ((i + 1) / segments) * Math.PI * 2;
        const hue = (i / segments) * 360;

        ctx.beginPath();
        ctx.arc(cx, cy, radius * (0.95 + rand() * 0.1), angle, nextAngle);
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.08)`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // 14日以上: 中央にダイヤモンド
    if (streak >= 14) {
      const cx = w / 2;
      const cy = h / 2;
      const size = Math.min(w, h) * 0.06;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);

      ctx.beginPath();
      ctx.rect(-size / 2, -size / 2, size, size);

      const dGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      dGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      dGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.08)');
      dGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = dGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * 最終仕上げ: ビネット効果
   * 画面の四隅を暗くして作品にまとまりを出す
   */
  static drawVignette(ctx, w, h) {
    const gradient = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.3,
      w / 2, h / 2, Math.max(w, h) * 0.7
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // ============================
  // ユーティリティ関数
  // ============================

  /**
   * 16進数カラーにアルファ値を追加する
   * @param {string} hex - "#RRGGBB" 形式のカラーコード
   * @param {number} alpha - 透明度（0〜1）
   * @returns {string} "rgba(r,g,b,a)" 形式の文字列
   */
  static withAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
