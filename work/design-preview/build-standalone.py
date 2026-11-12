from pathlib import Path

directory = Path(__file__).parent
fragment = (directory / "ayr-direction.html").read_text(encoding="utf-8")
head = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AYR 디자인 시안</title>
<style>
:root { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
body { margin:0; background:light-dark(#eeeee8,#131710); color:light-dark(#252b20,#f2f3e9); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif; }
header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; padding:24px max(20px,calc((100% - 760px)/2)); border-bottom:1px solid light-dark(#d9ddd1,#394032); }
header strong { font-size:18px; }
header p { margin:8px 0 0; font-size:13px; color:light-dark(#626a59,#b6bdaa); line-height:1.6; }
.preview-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.preview-controls button { min-height:42px; padding:9px 15px; font:inherit; font-size:13px; border:1px solid light-dark(#c9cfc0,#4e5746); border-radius:22px; background:transparent; color:inherit; cursor:pointer; }
.preview-controls button[aria-pressed="true"] { color:#253019; background:#d5f56b; border-color:#d5f56b; }
button:focus-visible { outline:3px solid #71942c; outline-offset:3px; }
main { max-width:760px; margin:auto; }
footer { text-align:center; padding:0 20px 26px; font-size:12px; color:light-dark(#626a59,#b6bdaa); }
[hidden] { display:none!important; }
</style></head><body>
<header><div><strong>AYR · 디자인 시안</strong><p>가짜 데이터로 만든 비교용 화면입니다.<br>오늘·월별·잠금화면을 눌러 확인하세요.</p></div>
<div class="preview-controls" role="group" aria-label="시안 선택">
<button type="button" data-design="금액 먼저" aria-pressed="true">금액 먼저</button>
<button type="button" data-design="한마디 먼저" aria-pressed="false">한마디 먼저</button>
<button type="button" id="appearance" aria-pressed="false">다크 모드</button>
</div></header><main>
"""
tail = """
</main><footer>디자인 검토용 · 실제 iOS 위젯·Live Activity 실행 화면이 아닙니다.</footer>
<script>
document.querySelectorAll('[data-design]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-variant]').forEach(variant => {
      variant.hidden = variant.dataset.variant !== button.dataset.design;
    });
    document.querySelectorAll('[data-design]').forEach(choice => {
      choice.setAttribute('aria-pressed', String(choice === button));
    });
  });
});
document.getElementById('appearance').addEventListener('click', event => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.getElementById('ayr-directions').style.colorScheme = dark ? 'dark' : 'light';
  event.currentTarget.setAttribute('aria-pressed', String(dark));
  event.currentTarget.textContent = dark ? '라이트 모드' : '다크 모드';
});
</script></body></html>
"""
fragment = fragment.replace("#ayr-directions { color-scheme: light dark;", "#ayr-directions { color-scheme: light;")
destination = directory / "index.html"
destination.write_text(head + fragment + tail, encoding="utf-8")
print(destination.resolve())
