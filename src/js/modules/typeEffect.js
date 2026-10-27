export function typeEffect() {
  // 対象のタイトル
  const el = document.querySelector('.kv__title');
  if (!el) return;

  // 元の子ノードを配列にコピー
  const childNodes = Array.from(el.childNodes);
  el.textContent = ''; // 元の文字列は削除

  let charIndex = 0; // 文字ごとのインデックス

  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // テキストノードなら1文字ずつspanに
      node.textContent.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.setProperty('--char-index', charIndex);
        span.classList.add('char');
        el.appendChild(span);
        charIndex++;
      });
    } else if (node.nodeName === 'BR') {
      // 改行はそのまま追加
      el.appendChild(document.createElement('br'));
    }
  });

  // アニメーション開始
  el.classList.add('is-active');
}
