/* =============================================================================
   Ukraine Alert Map 3 — віджет для Übersicht (macOS)
   -----------------------------------------------------------------------------
   ЩО ПОКАЗУЄ
   • карту областей (чорне скло) з тривогами по ОБЛАСТЯХ і РАЙОНАХ; чим довше
     триває тривога — тим темніший колір;
   • цілі з реалістичними силуетами (шахед, розвідник, крилата й балістична
     ракета, КАБ, винищувач, бомбардувальник) за координатами й курсом;
     роботу ППО по областях;
   • стрічку повідомлень (як новинна) і ІСТОРІЮ цілей/тривог (клік по стрічці);
   • сповіщення macOS про тривогу та наближення цілей до обраного міста/району.

   ДЖЕРЕЛА ДАНИХ (безкоштовні)
   1) NEPTUN — https://neptun.in.ua/developers — БЕЗ ключа: треки цілей, тривоги
      по районах/областях, повідомлення з Telegram-каналів, межі районів.
      Умова: видиме посилання на NEPTUN (є внизу віджета).
   2) alerts.in.ua — https://alerts.in.ua/api-request — токен НА ЗАПИТ,
      необов'язковий: рівні red/yellow, загрози по областях (у т. ч. ППО).

   ТОКЕН alerts.in.ua (одне з двох)
   • файл ~/.config/ukraine-alert-widget/alerts_in_ua.token (один рядок), або
   • вставте нижче в команді: TOKEN='ваш_токен'

   НАЛАШТУВАННЯ І КЛІКИ
   • Значки праворуч угорі: годинник — історія, повзунки — налаштування.
     Кліки працюють, лише якщо в Übersicht → Preferences задано «Interaction
     shortcut» (і дано доступ у System Settings → Privacy & Security →
     Accessibility).
   • Стартові значення — у блоці `config`; зміни з панелі зберігаються локально
     й мають пріоритет; «Reset» повертає до `config`.

   СПОВІЩЕННЯ
   • Надсилаються через macOS (osascript). Якщо банер не з'являється: System
     Settings → Notifications → «Script Editor» → Allow Notifications.
   • Обране місто/район не залишає ваш Mac (зберігається лише в localStorage).

   ВАЖЛИВО: джерела неофіційні, дані можуть запізнюватися або бути неточними.
   Віджет НЕ замінює сирени та офіційні оповіщення.
   ========================================================================== */

// Виконується кожні refreshFrequency мс. Вивід — секції «@@ім'я код@@» + тіло
// відповіді (розбирає createApp().parseOutput). Немає мережі → віджет покаже
// «немає даних», а НЕ «тривог немає».
command: `
UA='UkraineAlertWidget/3.0 (Ubersicht; personal widget)'
D=/tmp/ukraine-alert-widget
mkdir -p "$D"
TOKEN=''
TF="$HOME/.config/ukraine-alert-widget/alerts_in_ua.token"
if [ -z "$TOKEN" ] && [ -r "$TF" ]; then TOKEN=$(tr -d '[:space:]' < "$TF"); fi
get() {
  n=$1; u=$2; shift 2
  rm -f "$D/$n.body" "$D/$n.code"
  c=$(/usr/bin/curl -s --compressed -m 8 -A "$UA" -o "$D/$n.body" -w '%{http_code}' "$@" "$u" 2>/dev/null)
  [ -n "$c" ] || c=000
  echo "$c" > "$D/$n.code"
}
getc() {
  n=$1; t=$2; u=$3; shift 3
  age=$(( $(date +%s) - $(/usr/bin/stat -f %m "$D/$n.code" 2>/dev/null || echo 0) ))
  case "$(cat "$D/$n.code" 2>/dev/null)" in 200) ttl=$t;; 429) ttl=60;; 401|403) ttl=120;; *) ttl=0;; esac
  if [ "$age" -ge "$ttl" ]; then get "$n" "$u" "$@"; fi
}
emit() {
  echo "@@$1 $(cat "$D/$1.code" 2>/dev/null || echo 000)@@"
  cat "$D/$1.body" 2>/dev/null
  echo
}
RB="$D/raions.b64"
fetch_raions() {
  /usr/bin/curl -s --compressed -m 60 -A "$UA" https://neptun.in.ua/raions.geojson | /usr/bin/sed -E 's/([0-9]+[.][0-9][0-9])[0-9]+/\\1/g' | /usr/bin/gzip -c | /usr/bin/base64 > "$RB.tmp"
  if [ "$(wc -c < "$RB.tmp")" -gt 20000 ]; then mv "$RB.tmp" "$RB"; else rm -f "$RB.tmp"; fi
}
get nt https://neptun.in.ua/api/v1/threats & p1=$!
get na https://neptun.in.ua/api/v1/alerts & p2=$!
getc nm 20 https://neptun.in.ua/api/v1/messages & p3=$!
if [ -n "$TOKEN" ]; then getc au 20 https://api.alerts.in.ua/v1/alerts/active.json -H "Authorization: Bearer $TOKEN" & p4=$!; fi
if [ ! -s "$RB" ] || [ -n "$(find "$RB" -mtime +7 2>/dev/null)" ]; then
  if [ ! -f "$D/raions.lock" ] || [ -n "$(find "$D/raions.lock" -mmin +10 2>/dev/null)" ]; then
    touch "$D/raions.lock"
    ( fetch_raions ) </dev/null >/dev/null 2>&1 &
  fi
fi
wait $p1 $p2 $p3 $p4
emit nt
emit na
emit nm
if [ -n "$TOKEN" ]; then emit au; else echo '@@au nokey@@'; echo; fi
if [ -s "$RB" ] && { [ ! -f "$D/raions.sent" ] || [ -n "$(find "$D/raions.sent" -mmin +360 2>/dev/null)" ]; }; then
  echo '@@rg 200@@'; cat "$RB"; echo; touch "$D/raions.sent"
fi
`,

// NEPTUN просить REST не частіше ніж раз на 5 с; 10 с — комфортно для всіх.
refreshFrequency: 10000,

// ---------------------------------------------------------------------------
// Стартові налаштування (їх можна змінювати з панелі у віджеті)
// ---------------------------------------------------------------------------
config: {
  lang: 'en',               // 'en' | 'uk'
  appearance: 'dark',       // 'dark' (чорне скло) | 'light' | 'auto' (як система)
  palette: 'ember',         // 'ember' | 'classic'
  darkestAfterMin: 360,     // за скільки хвилин тривога стає найтемнішою
  size: 1,                  // 0.8 | 1 | 1.2 | 1.4
  compact: false,           // лише лічильники, без карти
  cats: { drone: true, missile: true, tact: true, strat: true, ad: true, other: true },
  minConfidence: 0,         // NEPTUN: 0 будь-яка | 1 середня | 2 висока
  alertsSource: 'auto',     // 'auto' | 'neptun' | 'aiu' (alerts.in.ua)
  feedSource: 'auto',       // джерело стрічки/історії: 'auto' | 'neptun' | 'aiu'
  regionThreats: true,      // іконки «по області» з alerts.in.ua (без координат)
  districts: true,          // райони: межі та підсвітка (потрібен raions.geojson від NEPTUN)
  partial: true,            // штрихувати область, якщо райони недоступні
  course: true,             // лінія курсу та слід цілей
  advisory: true,           // «спостереження» NEPTUN (напр. зліт МіГ-31К) — приглушено
  stale: false,             // застарілі треки NEPTUN
  ticker: true,             // стрічка повідомлень внизу
  tickerSpeed: 1,           // 0.7 | 1 | 1.4
  historyHours: 24,         // скільки годин зберігати історію (6 | 24 | 72)
  home: '',                 // «моя область», напр. 'ivano-frankivsk'
  place: '',                // «моє місто», напр. 'bila-tserkva'
  notify: false,            // сповіщення macOS
  nAlert: true,             // сповіщати про початок тривоги/загрози у моїй області/районі
  nEnd: true,               // …і про відбій
  nNear: true,              // сповіщати про цілі поблизу мого міста
  nRadius: 50,              // км: 25 | 50 | 100 | 150
  nSound: true,             // звук сповіщення
  // нижче — лише тут, у панелі їх немає
  extrapolateMaxSec: 300,   // скільки секунд екстраполювати рух цілі між оновленнями
  staleAfterSec: 45,        // після цього — жовта крапка «дані можуть бути застарілі»
  offlineAfterSec: 120      // після цього — «немає даних» (а не «спокійно»)
},

// Контейнер: лише позиція (Übersicht компілює цей рядок як Stylus). Вигляд — у render().
style: `
  top: 20px
  right: 20px
  width: 440px
  z-index: 100
  pointer-events: none
`,

render: function () {
  return `<style>
.uaw{--fg:rgba(255,255,255,.96);--fg2:rgba(255,255,255,.68);--fg3:rgba(255,255,255,.44);
  --reg:rgba(3,3,6,.97);--reg-line:rgba(255,255,255,.22);--rg-line:rgba(255,255,255,.075);--halo:rgba(0,0,0,.92);
  --glass-a:rgba(10,11,16,.74);--glass-b:rgba(0,0,0,.86);--sheen:rgba(255,255,255,.12);
  --rim-hi:rgba(255,255,255,.72);--rim-lo:rgba(255,255,255,.12);--shadow:rgba(0,0,0,.62);
  --ctl:rgba(255,255,255,.08);--ctl-on:rgba(255,255,255,.2);--line:rgba(255,255,255,.1);--pill:rgba(255,255,255,.075);
  --c-drone:#FFB224;--c-recon:#FFD060;--c-missile:#FF6A3D;--c-tact:#5CC8FF;--c-strat:#F5F5F7;--c-ad:#34D399;--c-other:#B4B4BE;
  --u-drone:#FFB224;--u-recon:#FFD060;--u-missile:#FF6A3D;--u-tact:#5CC8FF;--u-strat:#F5F5F7;--u-ad:#34D399;--u-other:#B4B4BE;
  --dot:#8E8E93}
@media (prefers-color-scheme: light){
  .uaw[data-theme="auto"]{--fg:rgba(16,16,24,.92);--fg2:rgba(16,16,24,.66);--fg3:rgba(16,16,24,.46);
    --reg:rgba(14,15,22,.92);--reg-line:rgba(255,255,255,.55);--rg-line:rgba(255,255,255,.16);--halo:rgba(255,255,255,.94);
    --glass-a:rgba(255,255,255,.62);--glass-b:rgba(232,236,247,.54);--sheen:rgba(255,255,255,.8);
    --rim-hi:rgba(255,255,255,.98);--rim-lo:rgba(255,255,255,.45);--shadow:rgba(30,36,64,.3);
    --ctl:rgba(20,24,48,.08);--ctl-on:rgba(255,255,255,.92);--line:rgba(20,24,48,.12);--pill:rgba(20,24,48,.07);--u-drone:#E58A00;--u-recon:#C99700;--u-missile:#E8441A;--u-tact:#0A84C8;--u-strat:#4B4B58;--u-ad:#12A150;--u-other:#85858F;}
}
.uaw[data-theme="light"]{--fg:rgba(16,16,24,.92);--fg2:rgba(16,16,24,.66);--fg3:rgba(16,16,24,.46);
  --reg:rgba(14,15,22,.92);--reg-line:rgba(255,255,255,.55);--rg-line:rgba(255,255,255,.16);--halo:rgba(255,255,255,.94);
  --glass-a:rgba(255,255,255,.62);--glass-b:rgba(232,236,247,.54);--sheen:rgba(255,255,255,.8);
  --rim-hi:rgba(255,255,255,.98);--rim-lo:rgba(255,255,255,.45);--shadow:rgba(30,36,64,.3);
  --ctl:rgba(20,24,48,.08);--ctl-on:rgba(255,255,255,.92);--line:rgba(20,24,48,.12);--pill:rgba(20,24,48,.07);--u-drone:#E58A00;--u-recon:#C99700;--u-missile:#E8441A;--u-tact:#0A84C8;--u-strat:#4B4B58;--u-ad:#12A150;--u-other:#85858F;}

.uaw,.uaw *{box-sizing:border-box}
.uaw{font-family:"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;color:var(--fg);width:100%;display:flex;justify-content:flex-end;pointer-events:none;--w:440px;--s:1}
.uaw button{font:inherit;color:inherit}
.uaw[data-state="live"]{--dot:#32D74B}
.uaw[data-state="warn"],.uaw[data-state="stale"]{--dot:#FFD60A}
.uaw[data-state="off"]{--dot:#FF453A}
.uaw .c-drone{--c:var(--c-drone)}.uaw .c-recon{--c:var(--c-recon)}.uaw .c-missile{--c:var(--c-missile)}.uaw .c-tact{--c:var(--c-tact)}
.uaw .c-strat{--c:var(--c-strat)}.uaw .c-ad{--c:var(--c-ad)}.uaw .c-other{--c:var(--c-other)}
.uaw :is(.cell,.chip,.hi).c-drone{--c:var(--u-drone)}.uaw :is(.cell,.chip,.hi).c-recon{--c:var(--u-recon)}.uaw :is(.cell,.chip,.hi).c-missile{--c:var(--u-missile)}.uaw :is(.cell,.chip,.hi).c-tact{--c:var(--u-tact)}.uaw :is(.cell,.chip,.hi).c-strat{--c:var(--u-strat)}.uaw :is(.cell,.chip,.hi).c-ad{--c:var(--u-ad)}.uaw :is(.cell,.chip,.hi).c-other{--c:var(--u-other)}

/* --- скло: глибокий чорний, напівпрозорий; блюр фону; дзеркальний край --- */
.uaw .card{position:relative;width:var(--w);padding:16px;border-radius:32px;transform:scale(var(--s));transform-origin:100% 0;
  background:radial-gradient(120% 80% at 0% 0%,var(--sheen) 0%,rgba(255,255,255,0) 44%),linear-gradient(170deg,var(--glass-a),var(--glass-b));
  -webkit-backdrop-filter:blur(34px) saturate(165%);backdrop-filter:blur(34px) saturate(165%);
  box-shadow:inset 0 1.5px 1px -.5px var(--rim-hi),inset 0 -1px 1px -.5px var(--rim-lo),
    inset 10px 10px 24px -18px rgba(255,255,255,.4),inset -10px -10px 24px -20px rgba(255,255,255,.2),
    0 22px 56px -14px var(--shadow),0 2px 12px rgba(0,0,0,.3)}
.uaw .card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;
  background:conic-gradient(from 200deg at 50% 50%,rgba(255,255,255,.7),rgba(255,255,255,.06) 18%,rgba(255,255,255,.16) 48%,rgba(255,255,255,.6) 62%,rgba(255,255,255,.06) 82%,rgba(255,255,255,.7));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.uaw[data-layout="compact"]{--w:284px}

/* --- шапка --- */
.uaw .top{display:flex;align-items:center;gap:8px;margin-bottom:12px;min-height:28px}
.uaw .flag{width:16px;height:16px;flex:none;border-radius:50%;background:linear-gradient(#0057B7 50%,#FFD700 50%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 1px 3px rgba(0,0,0,.4)}
.uaw .ttl{font-size:14px;font-weight:650;letter-spacing:-.01em;white-space:nowrap}
.uaw .grow{flex:1}
.uaw .dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dot);box-shadow:0 0 8px var(--dot)}
.uaw .asof{font-size:12px;color:var(--fg2);white-space:nowrap;margin-right:2px}
.uaw .asof b{color:var(--fg);font-weight:600;font-variant-numeric:tabular-nums}
.uaw .ibtn{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;border-radius:50%;background:var(--ctl);color:var(--fg2);pointer-events:auto;cursor:pointer;padding:0;transition:background .15s,color .15s}
.uaw .ibtn:hover{color:var(--fg);background:var(--ctl-on)}
.uaw .ibtn.on{color:var(--fg);background:var(--ctl-on)}
.uaw .ibtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.uaw .ibtn circle.f{fill:currentColor;stroke:none}
.uaw[data-layout="compact"] .asof{display:none}

/* --- банер сповіщення --- */
.uaw .banner{display:none;margin:-2px 0 12px;padding:9px 12px;border-radius:14px;background:rgba(255,69,58,.22);box-shadow:inset 0 0 0 1px rgba(255,69,58,.5);font-size:12.5px;line-height:1.35;pointer-events:auto;cursor:pointer}
.uaw .banner.on{display:block;animation:uaw-flash 1.2s ease-out 2}
.uaw .banner b{display:block;font-weight:650;font-size:13px}
@keyframes uaw-flash{0%{background:rgba(255,69,58,.6)}100%{background:rgba(255,69,58,.22)}}

/* --- тіло: карта + лічильники --- */
.uaw .body{display:flex;gap:14px;align-items:stretch}
.uaw .map{position:relative;flex:1;min-width:0;display:flex;align-items:center}
.uaw[data-layout="compact"] .map{display:none}
.uaw .mapsvg{width:100%;height:auto;display:block;overflow:visible}
.uaw .side{width:152px;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
.uaw[data-layout="compact"] .side{width:100%}
.uaw .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 2px}
.uaw .cell{display:flex;align-items:center;gap:6px;height:36px;padding:0 4px;border-radius:12px;transition:opacity .3s}
.uaw .cell.z{opacity:.34}
.uaw .cell.x{opacity:.18}
.uaw .cell .ic{width:21px;height:21px;flex:none;fill:var(--c);filter:drop-shadow(0 0 5px color-mix(in srgb,var(--c) 50%,transparent))}
.uaw .cell .n{font-size:25px;font-weight:700;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.uaw .pcard{padding:9px 10px;border-radius:15px;background:var(--pill);font-size:11px;line-height:1.4;color:var(--fg2);min-height:50px;overflow-wrap:anywhere}
.uaw .pcard b{display:block;color:var(--fg);font-weight:650;font-size:12.5px;overflow-wrap:anywhere}
.uaw .pcard .st{display:flex;align-items:center;gap:6px}
.uaw .pcard .sd{width:7px;height:7px;border-radius:50%;flex:none;background:var(--hc,#32D74B);box-shadow:0 0 7px var(--hc,#32D74B)}
.uaw .pcard .nr{margin-top:2px;color:var(--fg3)}
.uaw .pcard .nr i{font-style:normal;color:var(--fg2)}

.uaw .msg{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;padding:10px;font-size:12px;color:var(--fg2)}
.uaw .msg b{font-size:14px;color:var(--fg);font-weight:650}
.uaw[data-state="off"] .msg,.uaw[data-state="loading"] .msg{display:flex}
.uaw[data-state="off"] .reg,.uaw[data-state="loading"] .reg{opacity:.5}
.uaw[data-state="off"] .layer,.uaw[data-state="loading"] .layer{display:none}

/* --- карта --- */
.uaw .reg{fill:var(--reg);stroke:var(--reg-line);stroke-width:.8px;stroke-linejoin:round;vector-effect:non-scaling-stroke;transition:fill .8s}
.uaw .rg{fill:transparent;stroke:var(--rg-line);stroke-width:.6px;stroke-linejoin:round;vector-effect:non-scaling-stroke;transition:fill .8s}
.uaw[data-districts="0"] .rgs{display:none}
.uaw .homeline{fill:none;stroke:var(--fg);stroke-width:1.7px;vector-effect:non-scaling-stroke;stroke-linejoin:round;opacity:.9}
.uaw .pl{fill:#fff;stroke:rgba(0,0,0,.75);stroke-width:1.5px;vector-effect:non-scaling-stroke}
.uaw .plr{fill:none;stroke:#fff;stroke-width:1.2px;vector-effect:non-scaling-stroke;opacity:.7}
.uaw .i{vector-effect:non-scaling-stroke}
.uaw .mk{fill:var(--c);stroke:var(--halo);stroke-width:1.6px;paint-order:stroke fill;stroke-linejoin:round;filter:drop-shadow(0 0 1.5px rgba(0,0,0,.6))}
.uaw .mk.adv{opacity:.55}
.uaw .mk.old{opacity:.45}
.uaw .course{stroke:var(--c);stroke-width:1.2px;stroke-dasharray:3 2.5;vector-effect:non-scaling-stroke;opacity:.85}
.uaw .trail{fill:none;stroke:var(--c);stroke-width:1.3px;vector-effect:non-scaling-stroke;opacity:.55;stroke-linecap:round;stroke-linejoin:round}
.uaw .ring{fill:var(--halo);fill-opacity:.4;stroke:var(--fg2);stroke-opacity:.55;stroke-width:.9px;stroke-dasharray:2.5 2;vector-effect:non-scaling-stroke}
.uaw .pulse{fill:none;stroke:var(--c);stroke-width:1.4px;vector-effect:non-scaling-stroke;transform-box:fill-box;transform-origin:center;animation:uaw-pulse 2s ease-out infinite}
.uaw .bd{fill:var(--fg);stroke:var(--halo);stroke-width:2.4px;paint-order:stroke fill;font-weight:700;font-family:inherit;text-anchor:start}
@keyframes uaw-pulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(1.9);opacity:0}}

/* --- стрічка --- */
.uaw .ticker{display:none;margin-top:14px;height:32px;border-radius:16px;background:var(--pill);align-items:center;overflow:hidden;pointer-events:auto;cursor:pointer;transition:background .15s}
.uaw .ticker.on{display:flex}
.uaw .ticker:hover{background:var(--ctl)}
.uaw .tk-src{flex:none;display:flex;align-items:center;gap:7px;padding:0 11px 0 12px;font-size:11.5px;font-weight:650;color:var(--fg2);height:100%}
.uaw .tk-src i{width:6px;height:6px;border-radius:50%;background:#FF453A;box-shadow:0 0 7px #FF453A;animation:uaw-blink 1.6s ease-in-out infinite}
.uaw .tk-view{flex:1;min-width:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 16px,#000 calc(100% - 22px),transparent);mask-image:linear-gradient(90deg,transparent,#000 16px,#000 calc(100% - 22px),transparent)}
.uaw .tk-track{display:inline-flex;white-space:nowrap;animation:uaw-marq var(--dur,80s) linear infinite;will-change:transform}
.uaw .ticker:hover .tk-track{animation-play-state:paused}
.uaw .tk-item{display:inline-block;padding-right:40px;font-size:12.5px;color:var(--fg)}
.uaw .tk-item time{color:var(--fg3);margin-right:6px;font-variant-numeric:tabular-nums}
.uaw .tk-item b{font-weight:650;margin-right:6px;color:var(--fg2)}
.uaw .tk-empty{font-size:12px;color:var(--fg3);padding-left:4px}
@keyframes uaw-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes uaw-blink{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.uaw .tk-track{animation:none}.uaw .pulse{animation:none;opacity:.4}.uaw .tk-src i{animation:none}.uaw .banner.on{animation:none}}

/* --- панелі: історія / налаштування --- */
.uaw .panel{display:none;margin-top:14px;padding-top:10px;border-top:1px solid var(--line);pointer-events:auto}
.uaw .panel.on{display:block}
.uaw .legal{margin-top:12px;font-size:10px;line-height:1.4;color:var(--fg3)}
.uaw .legal a{color:var(--fg2);text-decoration:none;border-bottom:1px solid var(--fg3);pointer-events:auto;cursor:pointer}
.uaw .seg{display:inline-flex;align-items:center;background:var(--ctl);border-radius:10px;padding:2px;gap:1px;max-width:100%}
.uaw .seg button,.uaw .seg .lbl{font-size:11.5px;line-height:1;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:var(--fg2);cursor:pointer;white-space:nowrap}
.uaw .seg .lbl{cursor:default;color:var(--fg);max-width:150px;overflow:hidden;text-overflow:ellipsis}
.uaw .seg button.on{background:var(--ctl-on);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.3)}
.uaw .seg button:hover:not(.on){color:var(--fg)}
.uaw .tabs{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.uaw .row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px;font-size:12px;color:var(--fg2)}
.uaw .row>span:first-child{flex:none}
.uaw .chips{display:flex;gap:4px}
.uaw .chip{width:32px;height:28px;display:grid;place-items:center;border:0;border-radius:9px;background:var(--ctl);cursor:pointer;padding:0;opacity:.4}
.uaw .chip.on{opacity:1;background:var(--ctl-on)}
.uaw .chip svg{width:17px;height:17px;fill:var(--c)}
.uaw .togs{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin:4px 0}
.uaw .tog{display:flex;align-items:center;gap:8px;border:0;background:transparent;padding:5px 0;font-size:11.5px;color:var(--fg2);cursor:pointer;text-align:left}
.uaw .tog i{width:26px;height:15px;border-radius:8px;background:var(--ctl);position:relative;flex:none;transition:background .2s}
.uaw .tog i::after{content:"";position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:var(--fg2);transition:transform .2s,background .2s}
.uaw .tog.on{color:var(--fg)}
.uaw .tog.on i{background:#32D74B}
.uaw .tog.on i::after{transform:translateX(11px);background:#fff}
.uaw .hint{margin-top:6px;font-size:11px;line-height:1.5;color:var(--fg3)}
.uaw .hint b{font-weight:600;color:var(--fg2)}
.uaw .btn{margin-top:8px;margin-right:6px;font-size:11.5px;border:0;border-radius:9px;padding:6px 12px;background:var(--ctl);color:var(--fg2);cursor:pointer}
.uaw .btn:hover{color:var(--fg);background:var(--ctl-on)}

/* --- історія --- */
.uaw .hlist{max-height:290px;overflow-y:auto;margin-top:6px;margin-right:-6px;padding-right:6px;scrollbar-width:thin}
.uaw .hlist::-webkit-scrollbar{width:5px}
.uaw .hlist::-webkit-scrollbar-thumb{background:var(--ctl-on);border-radius:3px}
.uaw .hrow{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:start;padding:9px 0;border-top:1px solid var(--line);font-size:12.5px;line-height:1.35}
.uaw .hrow:first-child{border-top:0}
.uaw .hrow .hi{width:19px;height:19px;fill:var(--c);margin-top:1px}
.uaw .hrow .tx{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.uaw .hrow .sub{font-size:11px;color:var(--fg3);margin-top:2px}
.uaw .hrow .tm{font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums;white-space:nowrap}
.uaw .hempty{padding:18px 0;text-align:center;font-size:12px;color:var(--fg3)}
.uaw .tk-track.st{animation:none}
</style>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <g id="uaw-i-drone"><path class="i" d="M0-5.2 11 7.4H1.5V6.4H-1.5V7.4H-11ZM0-12.4C.9-11 1-9 1 -7V10.6H-1V-7C-1-9-.9-11 0-12.4ZM-1.6 6.4H1.6V10.6H-1.6ZM10 3.2H11.6V8H10ZM-10 3.2H-11.6V8H-10Z"/><path class="i" d="M-3.8 12H3.8" style="stroke-width:1.2px"/></g>
    <path id="uaw-i-recon" class="i" d="M0-10 1.1-8V-1.4H11.6V2L1.1 2.4V7.4L4.8 8.2V10L0 9.4-4.8 10V8.2L-1.1 7.4V2.4L-11.6 2V-1.4H-1.1V-8Z"/>
    <path id="uaw-i-cruise" class="i" d="M0-12C1.3-10.2 1.8-7.6 1.8-5V-.4L6.9 3.6V5.2L1.8 4.2V8.2L4.1 10.8V12L0 10.7-4.1 12V10.8L-1.8 8.2V4.2L-6.9 5.2V3.6L-1.8-.4V-5C-1.8-7.6-1.3-10.2 0-12Z"/>
    <path id="uaw-i-ballistic" class="i" d="M0-12.2C1.7-9.6 2.4-6 2.4-2V5.6L6.6 11V12.2L2.4 10.2V11.9H-2.4V10.2L-6.6 12.2V11L-2.4 5.6V-2C-2.4-6-1.7-9.6 0-12.2Z"/>
    <path id="uaw-i-kab" class="i" d="M0-11.8C2.5-10.6 3.2-7 3.2-3V9H-3.2V-3C-3.2-7-2.5-10.6 0-11.8ZM3.2-1.6H9.6V2H3.2ZM-3.2-1.6H-9.6V2H-3.2ZM3.2 8.4H5.8V11.6H-5.8V8.4H-3.2Z"/>
    <path id="uaw-i-fighter" class="i" d="M0-12 1.3-7.4 1.6-3.4 9.6 2.8V5.4L1.9 3.7 2.3 8.4 4.7 10.3V12L1.3 11.2 0 12.2-1.3 11.2-4.7 12V10.3L-2.3 8.4-1.9 3.7-9.6 5.4V2.8L-1.6-3.4-1.3-7.4Z"/>
    <g id="uaw-i-bomber"><path class="i" d="M0-12.4 1.3-8.6 1.4-3 12 3.6V6L1.4 3.6 1.2 8.6 4.6 10.2V12L0 10.9-4.6 12V10.2L-1.2 8.6-1.4 3.6-12 6V3.6L-1.4-3-1.3-8.6Z"/><path class="i" d="M4.2-.3V3.9M7.8 1.8V6M-4.2-.3V3.9M-7.8 1.8V6" style="stroke-width:2.1px;stroke-linecap:round;fill:none;stroke:var(--c)"/></g>
    <g id="uaw-i-shield"><path class="i" d="M0-11.5 9-8V.5C9 6.2 5 10 0 12-5 10-9 6.2-9 .5V-8Z"/><path class="i" d="M-3.6 2.4 0-2 3.6 2.4" style="fill:none;stroke:var(--halo);stroke-width:1.5px"/></g>
    <path id="uaw-i-diamond" class="i" d="M0-9 9 0 0 9-9 0Z"/>
    <path id="uaw-i-alert" class="i" d="M0-10 10.4 8H-10.4ZM-1 -3.6H1V3.2H-1ZM-1 4.6H1V6.4H-1Z" style="fill-rule:evenodd"/>
    <path id="uaw-i-msg" class="i" d="M-10 -8H10V4H2L-3 9V4H-10Z"/>
  </defs>
</svg>
<div class="uaw" data-state="loading" data-layout="full" data-theme="dark" data-districts="1">
  <div class="card">
    <div class="top">
      <span class="flag"></span><span class="ttl">Ukraine Alert Map</span><span class="grow"></span>
      <span class="dot"></span><span class="asof">as of <b>—</b></span>
      <button class="ibtn" data-act="panel" data-val="history" title="History"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.5"/></svg></button>
      <button class="ibtn" data-act="panel" data-val="settings" title="Settings"><svg viewBox="0 0 16 16"><path d="M2 4.5H8.2M12.8 4.5H14M2 11.5H3.2M7.8 11.5H14"/><circle class="f" cx="10.5" cy="4.5" r="1.9"/><circle class="f" cx="5.5" cy="11.5" r="1.9"/></svg></button>
    </div>
    <div class="banner" data-act="banner"></div>
    <div class="body">
      <div class="map">
        <svg class="mapsvg" viewBox="-8 -8 1016 686">
          <defs class="pats"></defs>
          <g class="regions">
          <path class="reg" id="uaw-r-crimea" data-r="crimea" data-cx="673.7" data-cy="600.7" d="M712.1 564.2l1.4-0.9 2.3 4.7 15.9 23.6 8.3 5.8 2 0.2 11-3.6 2-3.6 2.2-2 0.7-2.9 1.6-1.8 1.5 0.9-0.4 3.6 7.3 4.1 2.1-0.5 2.5-4.8 2.7-2.2 7.5-0.3 1.7-1.2 1.3 1.2-0.4 1.4 2.3-1.1 3.9 1.7 4.4-0.6 2.3 2.7 1.9-1.3 1.8 0.4 1.8 3.6-0.1 2.7-2.4 0.5-4.7-1-1 2.4 0.4 1.9-2.2 0.6-1.4 2.6-0.9 8 2.5 4.6-0.1 1.2-4.7 2.2-5.6 0.4-1.3 2.5-1 0.3-9.8-3.2-3 3.9-8.1 0.5-1.1-0.6-2.5-4.5-4.2-2.9-6.4-2-4.7 0.5-5.5 4-0.4 2.9 2 1.6-3.4 0.5-0.8 1.9 0.4 2.4-2.7-2.1-1.1 1.1-1.4-0.8-1 0.6-2.2 3.5-3.4 1-4.1 8.4-2.4-0.4-1.7-2.8-3-0.5-3.4 1.8-1.9-0.4-1.6 0.9-3.9-0.7-5.9 3.4-8.3 2.7-1.4 1.5-0.3-0.5-3.1 4.4-4.6 9.9-3.3 0-1.6 3-3.3 1.1-2.6 4-9.8 4.5-2.4 0-3.5-1.4-6.8 0.3 2-0.6 1.1-1.5 3.7-0.5-2.6-7.4-1.5-0.4-0.5-1.9-2.2 0.2-0.9-2.2 2.1-3.3-2.3-3.3-4.7 0.4-0.7-4.6 4.3-2.6-0.8-2.9-3.2-2-2-0.2-0.6-2.6 2.2-1.5 0.5-4.7-3.1-12.7-1.4-1.8-7.8-5.7-7.6 2.6-1.1-1.8-3.7-1.4-5.2-5.9-9.9-6.5-8.3-0.7-2.1 0.8-2.7 2.6-4 0-4.3-1.6-1.8-5.4 2.4-3.9 6.6-5 3.4-0.7 2.9-2.7 3.9 0.2 0.2-3.1 2-2.3 17.1-8.9 0.3-1-1.3-1 0.6-1.3 3.4 2.7 1.9-0.3 6.1-3.4 1.9-2.3 4-2.3 2.7 1 4.4-3.1 1.8 0.4 0.9 1.3 1.8-0.1 0.1-4.2 4.6-1.2-2-1.5-3.2-0.8-2.8 1.1-0.7-0.5 1.5-2.3-0.8-0.7 0.7-2.1-0.9-4.3 1.1-1.7-1.1-2.8 1.8-1.9 0.5-5.5 3.5 5.7 3 2 1-1.8 0-2.7 2.3 1 0.3 2.6-0.7 1.4 2.6 3.9-1.1 0.5 0 1.7 2.6-1.7 3.8 3.4-0.3-3.5 1.1-0.5-3.1-2.5 3.2-0.2 2.2 1.1 2.3 3.3 4.9 3.8-1.3 1.5-1.8-0.4 2.3 3.8 2.4-1.1 0.2-3-4.7-4.6 0-1.1 2.5 1.7 0.4-0.6 3.3 1.3-0.7 0.9 0.6 1.1 2.8-3.3 0.2 3 1 0.7 1.1 0.1 0.7-2.2 1.1 0 2 2.7-1.5 0.6 2.8 2.2-0.2 1.6-1.9 1.3-0.7 3.1 1.5-1.7-0.4 1.7 1.5-1.1 0.3 2.4 1.8-5.4 2.1 0.2-1.1 1.6 1.4 2.8 2.4-3.6 2.1 0.2 0.5-1-1.9-3.2 4.6 1.8-0.2 3.5-1.3 1.8-3 1.5-0.2 1.8-4.4 5.4 4.6-1.6 5.7-5.3 3.2-1 2.4-2.5-0.1 3.5-3.7 0.8-1.9 5 4.3-2.2 1.4 0.6 0.8 1.8-2.7 4.7 4.2 0.5 4.5-1.6-1.9 2.7 1.9 0.5 1.5 2.3 4.3 0.4 5 8.1 1.6 6.9-0.5 1.3-4.3 2.8 3 4.5 3.3 2.6 3.9-0.4 2.3 1.8 6.3 2.3 3 2.7 2.9-2.2-6.5-4.8-14.1-19.6-3.3-5.9-1.4-1z"/>
          <path class="reg" id="uaw-r-mykolaiv" data-r="mykolaiv" data-cx="569.6" data-cy="432.0" d="M539.1 499.9l-2 3.2-3.8-1.4-2 0.4-1.4 1.9 0 3.3-1.3-3.4-7.7-7.4-0.9-1.9 4.1 3.5 9.7-0.8zM604.6 382.1l0.6 0.5-0.7 3.6 2 0.4 0.7 1.3-1.2 5.4 0 5.1 1.5 2.6-5.8 2.2 2.1 5.6-1.6 3.6 5.4 1.3 0 2.8 1.6 2 0.5 8.6-2.4 0.3-1.4-3-1.8 3.8 0.9 1.3 3 0.4 1.3 2.9-0.9 6.3 1.8 3.9-0.6 1.6-2.3-0.3-2.7 2.5-3.3-0.7-3.2 6.2 0.4 2.9 1.7 0 3.2 1.9 2.6 2.7-2 3.9-2.8-2.4-1.3 1.1 0.2 2.4 3 0.7 0.1 1-3.6 1.3-1.7 1.6-6 1.4 1.1 1.2 6.4 0.5-6.6 2.8-6.3 0.3-3.8-2.9-5.4-1.2-1.1 3.3-2.9 0.2-1.1-1.3-3.4 0.6-2.5 3.6-6-1.2-3.5 5.1-3.3 0.9-2.2-0.9-3.1 1.7-2.9 0.3-1.6-6.3 3.7-7.7 0.2-2.9-3.9-2 2.3-4.4-1.8-0.8-3.5 0.4-0.9-1 1.8-5.4-0.8-2.1-2.1-1.2-0.8-4.3-4-2.4-0.9-3.5-0.9 3.1 2 1.7 2.4 0.6 0.8 6.2 3 1.8-1.6 3.3-0.4 3.7 1.7 0.8 4.3-0.1-2.6 4.5 0.5 1.4 1 0.3 2.3-1.1 0.3 1.7-1.6 4.6-2.5 1.3-1.9 3 0 2.1 2.3 3.4 0.1 6.1-2.1 2.4-3.1 0.8-7.8-2.5-3.3 0.3-1.9 2.6-5.2-1.2-0.3-1.1 4.4-9.1 3.2-4.4-0.6-1-1.3 2.6-4.2 3.9-3.7-4.5 0.8 3.8 2.8 2.7-4.3 6.7-5 2.9-8.3-2.2-1.4-15.9-5.9-5.8-1.3-3.3 0.1-1.2 3-0.2 1.4-1.6 5.9 0 2.3-2.2 1.8-3.9 0.5-4.2-1.9-0.7-2.5-4.5-2.3 0.6-3.6-2 0-2 3-2.7-1-2.5-6.6 1.6-1.1-1.4-5.5-0.7-4.5-12.4 2.1-6.9-0.2-2.5-2-3-2.6-0.5-0.3-3.9-3.1 0.7-1.6 3.1-1.6-3.1-4-1-2.2 1.6-1.5-0.8-2.8 0.5-3.1-2.2-1-3.2 0.7-2.7-2-2.2 1.2-2.1-0.3-1.6-3.9-3.1-1.5-9.6-2.3-3.2-2-0.7 0.4-4.6-1-1.4 5.9-2.3-1.2-3.6 2 0 1-2.3 9.5 0.1 5.6 1.5 0.9-1.5 3.8-1.6 4.6 0.3 1.9 1.6 1.9-2.3 2.7 2.5 3.9-2.1 1-2 2.6-1.1 7 0.6 0.9 0.3 0.3 3.1 2.1 1 0.2 2.3 1.1 0.9 5.6 0.7 1.8-1.1 1.7 1.5 4.7-1 0.7 1.3-0.7 3.6 0.6 0.4 0.8-0.3 0.5-2.3 2.5 0.2 0.6-2.1 1.4-0.8 4.9 2.2 3-0.2 0.6 4-3.3 2.5 3.2 5.3 3 0.6 2.2 4 0.3 1.4-1.5 2.5 0.9 4.3 5.5 0.2 1.1-1.4 2.6 0.2 2.5 1.6 1.3 2.3 2.6 1.2 1.4-0.4 3.9-5.6 3-0.1 3.3 2.2 2.2-0.4 4.4 1.6 9.9-1.6 0.4-3.1 1.6-0.7-0.9-4.7 2.7-0.7 0-1.5-1.7-0.8 0.5-2.4 5-1.7 1.3 1.6 1.3 0.2 0.8-1.6 2.3-0.8-0.3-1.8 0.8-1.4 4.7-0.7 2 5.5z"/>
          <path class="reg" id="uaw-r-chernihiv" data-r="chernihiv" data-cx="535.0" data-cy="93.8" d="M624.8 3.2l-2.3 8.7-2.3 3.5 0.3 4.3 0.4 1 2.7 1 3.6 4.6 2.3 0.4-0.1 1.6-0.7 1.4-1.5 0.5-2 0.1-1.6-1.1-0.4 4.7-1 1.3 1.2 1.9-0.5 2-5.2 1.6-2.6 2.1-3.6 0.1 0.4 1.8-1.4 0.4-1.1 2.6-2.8 3.1-0.5 2.1 1.2 4.6 3.8 4.3-1 3.2 1.2 1.7 0.3 4 1.1 1.3-1.6 1.3 0 1.6 1.9 2.7-1.2 1.6-2.4-1.1 0.5 2.8-1.3 2.1 1.2 3.2-0.8 4-3.3 0.5-1.9-2.5-1.1 1.4 1.2 3.3 1.8 0.7-0.3 2.6 1.3 1.7-0.1 3.1-2.3 2.1-0.1 2.7-3.6 1.8 0.4 3.4-1.7 3.7 4.5 1.9 2.1-0.2 0.3 1.1-1.1 1.5 2.2 1.5 3.2 0.6 1.7-3.1 1.8 0.7-2.8 4.8 1.7 2.7-0.1 4.4-2 3.2-1.4 5.9 0.3 3.6 2.2 2.6-1.8 2.3-0.6 3.6-1.2 1-0.4 5.4-4 9.6-2.8 2-1.2 2.1-2.5 1.3-1.5 2.8-3.7 0.8-4.7 2.6-2 0-0.8-0.8-9.6-0.2-1.7-3.3-3.6 1.4-1.3-1.4-1.8 0-3.5 1.6-3.1 3.8-5.1-0.4-3.4-2-0.6-0.9 1.1-2.1-3.7-1-0.7-2.8-1.9-2.1 1-2.1 2.2-0.4-0.2-3.5-3.6-0.5-5.9-6.2-3.3 0.6-0.7 3.3-2 2.1-3.4 0-4 3.1-2.9 0.7-3.4-0.8-2.1 1.6-4.3-1.1-3.1 0.4-3-1.1-0.9-3.2-1.8-0.2-2.5-2.5 0.3-1.6 1.8-1.4-0.3-3.2-3-3.7 0-1.2-2.5-0.7 0.1-1.6-1.4-2.3-2.7 1-4.3-0.2-1.8 1.1-3.3-0.8-2 1.6-2.3-2-3.1 0 1.9-4.5 0.2-3.2-6.7-3.9 0.5-5.7-0.8-2.5-1.9-1.6-3.3-1.2-1.9 0.8-0.5-0.8-0.1-8 1.2-6.4-1-3.5 2.2-0.8 1.4-6.6 3.3-2.9-0.3-2.5 0.7-0.3-1.5-4.5-1.7-0.8-0.1-2.2 1.8-0.6 0-0.7-1.7-1.3-0.1-2.5-1.3-1.1 1.2-1.8-3.4-1.8 1.1-1.8-1.5-1.9 2.3-1.7 0.7-6.9 3-0.5 1.2-4.3-1.5-0.7 2.9-2.6-0.5-2.6 4-4.8 0.4-2.2 2.6-0.2 1.2-1.6-0.4-1.9 3.7-2.3 1-2.7 3 0.1-0.1-2.4-1.6-0.2 0.4-3.3 0.9-0.9 11.1-0.7 5.2 3.5 1.3-0.6 2.9-4.7 4.3-1.9 5.1 0 9.7 1.9 11.5-0.3 1.3 1.3 0.6 4.5 1 0.6 5.9-1.9 4.4 0.9 7.6-3.6 2.4-2 1.7-3.5 1.1-7 2.2-2.6-1.5-3.6 0.7-3.1 2.3-0.5 4.8 1.8 2.6-0.8 10.9 5.8 6.6-0.9 3.6 1.9 6.7-5.7 2.7-0.2 5.8-5.5 9.7 0.8z"/>
          <path class="reg" id="uaw-r-rivne" data-r="rivne" data-cx="254.7" data-cy="94.8" d="M307.3 79.9l-4.4 1.6-0.6 3.1 1.4 4.1-5.3-4.5-0.9 5.9 1.2 3-1.3 2.1-3.9 1.4 2.1 5.1-0.7 2.5-2.4 2.2-2.1 4.1-0.9 4.7-2.7 4.3-4 1.4-1.3 2.8 2.1 5.7-1.2 1.3 1.4 2.9-0.9 7.2 2.6 5.6-4.4 10.4 2.4 3.1-2.4 3.6-2.7-0.6-1-3-1.5-0.4-1.4 2.5-2.8 1.1-2.5 2.3-4.2-1.1-5.2 2.7-0.6 3.4-3.1-0.3-2.1 4.5-2.9 2.5-0.4 2.2-9 9.2-5.4 0.8-4.4 5.9-3.9 2.1-0.3-3-1.4-1.5 1.6-3.9-0.5-1.1-3.8 1.7-4.6-2-2.7 1-4.1-1-7.7 7.4-7.4 0.8-2.2 1.7-1.6-0.9-2.2 1.8-6.3-1.9-0.6 2.6 1.4 2.3-2.8 3.1-0.3 3.6-2-0.7-0.4 2-9.2-7.1-1-3.9 0.5-4-1.5-2.3 2.3-3.2-0.4-2.9-1.7-1-4.7 1.3-1.2-1.3 7.8-7.4-6.1-6.7 0.2-0.8 2.2-0.1 1.8-2.9-2.3-2-0.3-1.4 1.2-1.1 7 1.1 1.5-0.8 0.4-2.3-1-3.1 5.4-0.3-1.8-1.9 0.7-3.7 4.7 2.1 8.5-4.6 2.9 0 1.8 1.1 1.6 2.8 2.8 0.6 2 2 1.6 0 2-5.3 0.4-8.7 3.7-2.9 2.5 0.1 0.9-0.9-2.1-2 2.7-4-2.2-3.3 0.2-1 5-1.3 1.5-1.6-1.2-4.5-1.8-2.6-1-0.7-2.4 0.9-1.9-1 0.6-3.6 3.9-0.8 1.1-1 0.7-4-3-3-4.2-2.1-3.8-4-0.4-1.8-1.9-1.1-0.7-1.3 0.7-4.6-2.6 1.2-1.9-1.6-2.1 2.3-4.4-0.2-2.1 2.8-1.4-1.2 0.5-10.2-0.8-5.7 2.8-5-2-1.4-0.5-1.4-2.4-0.2-0.5-5.6 1-4.2 6.4-8.2-0.5-4.5 1.8-2.1-5.4-0.6-1-2 7.6 0.1 4.6-0.9 11.9 2.2 3.8-0.1 1.7 0.4 5.2 3.9 12.9 0.5 0.6 2.7 1.5 1.4 12.2 0.4 10.4 4.6 3.7 0.6 5.6-1.9 7.1 0.7 1.5 0.8 0.4 1.4 0.2 6.1 4.9 1.1-1.3 5 0.8 0.7 3.4-0.9 4.4 0.5 3.8-2.9 11.9 3.1 0.7 1.9z"/>
          <path class="reg" id="uaw-r-chernivtsi" data-r="chernivtsi" data-cx="210.7" data-cy="357.5" d="M236.2 336.3l1.3-1.5 3.6-0.3 2.5 2 2.1 4.1 2.9 1.1 0.9-0.5-0.8-2.9 0.5-1.2 1.5 1.2 3.6-0.3-1.1-1.8-4.1-1.9-0.1-0.9 1.1-0.9 5 2.3 0.9-1.9-1.3-1.7 0.1-1.4 1.3 0.5 1 3.2 0.8-0.1 0.8-4.2 1.7-0.4 0.5 3.8 1.8 1.7 1.4-0.2 3.3-3.2 3.3 0.5 1.1 1.2 0.7-0.6 4.8 0.6 1.3-1.8 5.6 1 0.7-2.1-1.4-0.8-0.1-1.1 3.4 0.2 1.5 1.3 2.7-2.5 2.1 0.8 2.7 3.6 2.6 8.8-1.3 1.8-4.3 3.3-3.4-2.1-7.4 6.3-9.5-3.2-0.6 0.2 0.4 3.1-5 0.7-3.7-2.7-2.4-0.6-0.9 1.6-1.6-0.4-0.6 0.9 0.7 4.9-0.8 1.6-2.2-0.3-3.1-3.2-0.6 1.7-2.4 2.2-0.4 2-15.9 4.2-1.5-0.3-1.8 9.8-3.7 4.7-1.7 3.7-2.6 1.2-12.5 1-8.2 2.6-27.2 3-2.3 1.6-5.4 9-2.3 2.2-8.4 2.4 0.2-3.3 2.9-7.5-3.2-12 3.4-9.1 8.4-6.8 0-4.2 3.1-2 5.3-7 4.3-3.3 6.8-2 4.9 1.2 1.1-3.6 0.3-7.4-2.3-8.7 1.9-2.8 2.1-1.6 4.3 1.1 1.5 2.9 2.9-3.3 3.6 4.3 0.2 1.5 3.6 1.1 1.8-0.8 1.4-2.2 1.9 0.6 0.7-2.3 0.9-0.4 0.7 1.7-0.5 4.7 1.5 2 2.1 0.5 0.7-1.1-1.5-4.3 1.7-0.2 0.9 5.8 1.7 1.1 3.2-0.7 4.9 1.9z"/>
          <path class="reg" id="uaw-r-ivano-frankivsk" data-r="ivano-frankivsk" data-cx="143.0" data-cy="324.7" d="M143.5 254l4.5 7 2.5 5.9-0.5 2.2 0.7 4.1 1.9 1.7 0.6 2.3-1.7 4 0.5 4.4 1.1 0.7 2-1 2.8 0.8 0.8 1.2 0.6 3.6-1.1 0.8-3.8-1.2-0.3 1.8 2.9 1.6 2.3 4.4 4.1-0.3 3 1.8 0.1 3.7 2.4 3.5 1.3-3.8 1.7-1.6 1.4-0.1-1.1 7.5 1.4-1.5 4.3 1.5-1.2 1.2-3.1 0.9-0.6 1.4 0.6 2.1 4.3-3.3 1.4 0.1 0.1-3.5 3.3 0.7 0.9-0.2 0-1.5 0.9-0.1 1.3 0.5-1.2 2.2 1.8 1.9 3.7 1.2 4.5 3.3 0.6 1.3-0.7 2.2 1 1.8-0.5 1.6-4 4.4 2.3 8.7-0.3 7.4-1.1 3.6-4.9-1.2-6.8 2-4.3 3.3-5.3 7-3.1 2 0 4.2-8.4 6.8-3.4 9.1 3.2 12.7-2.9 6.8-0.2 3.3-1.8 0.3-4.9-7-7.1-3.7-2.5-5.6-3.6-2.4 1-4.9 3-4.7-6.3-7.7-0.4-2.1 1.3-2.8-2.7-5.1-6.1-5.7-2-0.2-0.7-2.8-1.7-1.5-2.7 3-4.4-0.2-1.5-1.2-1.1-4.7 0.2-8.8-7.3 2.6-2.8 2.3-1.3 0.1-1.2-1.1 0.6-2.6-0.8-2.3-6.2-4.3-0.8-4-4.6-0.2-4.5-5-4.4-1.6 2.4-9.3-1.5-4.6 1.5-6.8 3.6-3.5 2.9-7.1 3.4-1.7 8.3 0.6 2.5-1.7 3 0.9 4.1-2.4 4.4 0.9 5.9-1.5 5.1-2.5 3.8-0.3 1.2-1.9-1.6-2.3-3.4-0.5 0.2-5-0.8-0.4-2.8 1.6-0.7-1.3 0.5-1.1 4.3-1 3-3.5-2.2-2.3 2.4-4.7-0.8-2.9 0.8-2 0.9-0.9 3 0.5 4.8-1.1 3.6 2.3z"/>
          <path class="reg" id="uaw-r-khmelnytskyi" data-r="khmelnytskyi" data-cx="269.3" data-cy="250.0" d="M281.1 163.5l4.2 4.8 2 0.7-3.1 3.2-1 5.1 3.2 1.3 1.1 2.4 5.3 3.6-0.2 1.9 1.5 0.2 3 2.3 0.4 2.1 3.4 0.4 2-3.3 1.2 0.7-0.1 3.7 2.4 3.9-1.2 2 1.1 1.8-1.5 3.3 2.2 1.8 0.2 2.2-2.7 2.4-3.9-0.2 2 4.8-1.8 0.7-0.2 2.8 2.9 1.5 0.1 2.3 3.4 5.8 11.5 3.3-1 1.3-2.1 0.5 1.4 1.2-0.8 1.4-1 0.7-2-0.3-0.9 1.5 0.2 1.4 2.9 2 0.4 1.4-2.7 5.5 1 2.6-0.9 1-2-0.2-0.4 2.3 2.1 2.6-1.2 1.2 0.1 1.6 4.6 0.5 1.1 2.3-2.4 2.1 0.9 3.2 1.9 1.1-0.1 2 1.4 2.3-1.2 3 1.9 6.7-0.9 1-3.5 0.8-1.8 2.1-9-3.6-2.3 3.1-4-0.3-0.7 0.7-1 3.6-4 4.6-1 2.5 1 2.9-1.5 1.9 3 13.9-1.5 0.4-0.3 6.8-1.2 4.5-2 2.4-2.2-1.2-3.4-0.2 0.1 1.1 1.4 0.8-0.7 2.1-5.6-1-1.9 1.9-4.2-0.7-0.7 0.6-1.1-1.2-3.3-0.5-3.3 3.2-1.4 0.2-1.8-1.7-0.5-3.8-1.7 0.4-0.8 4.2-0.8 0.1-1-3.2-1.3-0.5-0.1 1.4 1.3 1.7-0.9 1.9-5-2.3-1.1 0.9 0.1 0.9 4.1 1.9 1.1 1.8-3.6 0.3-1.5-1.2-0.5 1.2 0.8 2.9-2.1 0.4-1.7-1-2.1-4.1-2.5-2-3.6 0.3-1.3 1.5-1.5-3.8 1-1-3.6-2.6 0.5-3.2-1.7 0.2-0.2-1.7-2.6-2 0.9-5.7-1.3-2.2 2-2.7-2.6-2.2 0.3-5-1.6-0.5 0.5-2.7-0.8-1.9 1-1.1-0.4-1.5 1.2-1-1.2-3.5 1.8-2.8-1.1-3.4 0.6-2.8-1.3-2.3 0.3-3.7 2.3-2.2 0.7-3.9-1.4-2.9-0.2-6.2-1.9-1.8-2.6-8.3 1.1-2.8 2.4-1.9 0.5-3.9 1.8-3.9-2.6-2.9 1.4-3.3 0.2-3.2-2.7-4.3 0.4-3.8-2-2.4 0.5-2.4-0.9-3.7 4.5-2.5 0.1-1.5-2.1-1.3 2-2.8-1.5-2 3.1-1 0.7-1.3-0.8-1.6-2.9-1.2 5.4-3 4.4-5.9 5.4-0.8 9-9.2 0.4-2.2 2.9-2.5 2.1-4.5 2.8 0.5 0.9-3.6 4.9-2.6 4.5 1 2.5-2.3 2.8-1.1 1.4-2.5 1.5 0.4 1 3z"/>
          <path class="reg" id="uaw-r-lviv" data-r="lviv" data-cx="86.1" data-cy="243.5" d="M163.2 184.9l0.4 0.9 1.9 0.5 3.6-1.4 1.5 0.6 0.6 3.3-2.3 2.8 1.5 2.7 0 7.2 5.7 5.3 4 2.5 3.6 6.4-2.2 1 0.2 3.2-1.2 1.5-7.5 3.2-8.1 1.6-0.8 3.4 1.5 4.1-2.2 1.5-2.5-0.5-4 7.7-9.6 5.4-2.3 0.3-1.5 5.9-3.2-0.5-3.6-2.3-8.3 1-1.2 2.5 0.8 2.9-2.4 4.7 2.2 2.3-3 3.5-4.3 1-0.5 1.5 1.2 0.9 1.7-1.4 1.4 0.2-0.2 5 3.4 0.5 1.5 2-0.2 1.5-15.7 5-4.4-0.9-4.1 2.4-3-0.9-2.5 1.7-8.3-0.6-2.4 0.9-1.7 1.8-2.2 6.1-3.6 3.5-1.5 6.8 1.5 4.6-2.4 9.3-8.1-0.9-2-3.2-2.3 1.8-0.6-2.6-2.2 0.8-3.1-0.4-5-7.9-5.1 1.3-2.1-0.3-4.8-5.9 0.3-5.3-2-1.8-1.2-2.6 0.6-3.5-4.2-3-3.1-3.5-0.9-0.6-1.3 0.7 3.1-9.7-1-9.2-2.4-3.5-2-8.9 7-12.4 3.3-2 3.4-6.2 2.5-1.8 1-3.1 8.3-11.2 18.6-20.4 7.1-5.6 4.4-4.7 2.1-4.9 3.6-1.8 10-0.1 2.9-1.2 1.5-3.8 0.2-3.9 3.5-1.9 1.8-2.1-1.2-5.7 1.7-2.9 2-0.6 3.6 4.8 2.3 1.2 5.5-3 2.2 1.8 0.4 1.9 1.6 1.6 3.7 0.3 1.9 2.4 0 1.6-4.7 2.6 3 3 0.2 2.4 1.6 0 1.2-2.7 1.4 1.8 2.8 0.4 0.3 1.4 2.7 1.8 0.9 2.4 1 0.5 3.6 0.2 3.3-1.2 4.2 0.5 0.5-1.8 3.9 2.1 2.3-0.3 1.1 1.3z"/>
          <path class="reg" id="uaw-r-ternopil" data-r="ternopil" data-cx="188.0" data-cy="263.7" d="M228 197.3l-1.5 0.9 2.9 1.2 0.8 1.6-0.7 1.3-3.1 1 1.5 2-2 2.8 2.1 1.3-0.1 1.5-4.5 2.5 0.9 3.7-0.5 2.4 2 2.4-0.4 3.8 2.7 4.3-0.2 3.2-1.4 3.3 2.6 2.9-1.8 3.9-0.5 3.9-2.4 1.9-1.1 2.8 2.6 8.3 1.9 1.8 0.2 6.2 1.4 2.9-0.7 3.9-2.3 2.2-0.3 3.7 1.3 2.3-0.6 2.8 1.1 3.4-1.8 2.8 1.2 3.5-1.2 1 0.4 1.5-1 1.1 0.8 1.9-0.5 2.7 1.6 0.5-0.3 5 2.6 2.2-2 2.7 1.3 2.2-0.9 5.7 2.6 2 0.2 1.7 1.7-0.2-0.5 3.2 3.6 2.6-1 1 1.5 3.8-1.5 0.5-5.4-1.9-4.2 0.6-1.7-1.1-0.9-5.8-1.7 0.2 1.5 4.3-0.7 1.1-2.1-0.5-1.5-2 0.5-4.7-0.7-1.7-0.9 0.4-0.7 2.3-1.9-0.6-1.4 2.2-1.8 0.8-3.6-1.1-0.2-1.5-3.6-4.3-2.9 3.3-1.5-2.9-4.3-1.1 0.5-1.6-1-1.8 0.7-2.2-0.6-1.3-4.5-3.3-3.7-1.2-1.8-1.9 1.2-2.2-1.3-0.5-0.9 0.1 0 1.5-0.9 0.2-3.3-0.7-0.1 3.5-1.4-0.1-4.3 3.3-0.6-2.1 0.6-1.4 3.1-0.9 1.2-1.2-4.3-1.5-1.4 1.5 1.1-7.5-1.4 0.1-1.7 1.6-1.3 3.8-2.4-3.5-0.1-3.7-3-1.8-4.1 0.3-2.3-4.4-2.9-1.6 0.3-1.8 3.8 1.2 1.1-0.8-0.6-3.6-0.8-1.2-2.8-0.8-2 1-1.1-0.7-0.5-4.4 1.7-4-0.6-2.3-1.9-1.7-0.7-4.1 0.5-2.2-2.5-5.9-4.5-7 1.5-5.9 2.3-0.3 9.6-5.4 3.7-7.4 3.2 0.1 1.8-1.4-1.5-4.1 0.8-3.4 8.4-1.7 8-3.8 0.2-4 2.3-1.3-3.6-5 0-2.4 0.6-0.8 1.7 0.8 0.3-3.6 2.8-3.1-1.4-2.3 0.6-2.6 6.3 1.9 2.2-1.8 1.6 0.9 2.2-1.7 8.2-1.2 6.9-7 4.1 1 2.7-1 4.6 2 3.8-1.7 0.5 1.1-1.6 3.9 1.4 1.5z"/>
          <path class="reg" id="uaw-r-zakarpattia" data-r="zakarpattia" data-cx="44.5" data-cy="340.8" d="M41.5 294.6l2 1.8-0.3 5.3 4.8 5.9 2.1 0.3 5.1-1.3 5 7.9 3.1 0.4 2.2-0.8 0.6 2.6 2.7-1.7 1.6 3.1 6.2 0.2 4.2 1.3 2.1 1 4.5 5 4.3 0 1.1 4.2 6.2 4.3 0.8 5.7 1.4 0.4 3.3-2.5 7.3-2.6-0.2 8.8 1.1 4.7 1.5 1.2 4.4 0.2 2.7-3 1.7 1.5 0.7 2.8 2 0.2 6.1 5.7 2.5 4.4-1.1 3.5 0.4 2.1 6.3 7.7-3 4.7-1 4.9-8.9-1.2-3.4 2.5-2.7 0.1-4.9 1.9-4.4-1.4-2-2-4.7-1.9-8.5 2.2-4.2-4.4-3.9 0.2-8.1-1.7-2.7 0.6-1.4 1.9-1.6 0.4-3.8-1.9-1.8 0.1-7.1-7.2-5.1-1.5-2.2 2.2-2 5.3-3.2 2-4.5-1.8-0.5 3.8-2.1 1-2.5-2.7 1-1.1 0.3-4.5-3-3.7-3.1-2.1-2.9 1.3-4.7 0.4-2.9-6.7-4.1-5.4-6.5 0.3-3.1-4.6-0.9-5.3-1.9 0 0.8-3.8-3.9-1.3-2.3 1.4-1.5-0.3 0.9-8.6-0.6-5.1 4.5-4.3 1.3-2.6 3.7-2.5 1.2-6.3 1.8-2.6-0.1-4.8 2.7-3.6 2.1-7.1 4-1.8 1-6.7 1.2-1.1 4.5 3.5 6.3-0.1 1.5 2 4 2.3z"/>
          <path class="reg" id="uaw-r-volyn" data-r="volyn" data-cx="143.4" data-cy="99.6" d="M190 41.6l1 2 5.4 0.6-1.8 2.1 0.5 4.5-6.4 8.2-1 4.2 0.5 5.6 2.4 0.2 0.5 1.4 2 1.4-2.8 5 0.8 5.7-0.5 10.2 1.4 1.2 2.1-2.8 4.4 0.2 2.1-2.3 1.9 1.6 2.6-1.2-0.7 4.6 0.7 1.3 1.9 1.1 0.4 1.8 3.8 4 4.2 2.1 3 3-0.7 4-1.1 1-3.9 0.8-0.6 3.6 1.9 1 2.4-0.9 1 0.7 2 3.1 0.9 4.4-1.9 1.4-4.5 1.1-0.2 1 2.2 3.3-2.7 4 2.1 2-0.9 0.9-2.5-0.1-3.7 2.9-0.4 8.7-2 5.3-1.6 0-2-2-2.8-0.6-1.6-2.8-1.8-1.1-2.9 0-8.5 4.6-5-2-0.3 4 1.7 1.5-5.4 0.3 1 3.1-0.4 2.3-1.5 0.8-7-1.1-1.2 1.1 0.3 1.4 2.3 2-1.8 2.9-2.2 0.1-0.2 0.8 6.1 6.7-7.8 7.4-0.5-4.3-2.8-0.1-3.4-2-0.7 0.1-0.3 1.6-4.2-0.5-3.3 1.2-3.6-0.2-1-0.5-0.9-2.4-2.7-1.8-0.3-1.4-2.8-0.4-1.4-1.8-1.2 2.7-1.8-0.2 0-2.2-3-3 4.7-2.6 0-1.6-1.9-2.4-3.7-0.3-1.6-1.6-0.4-1.9-2.2-1.8-5.5 3-2.3-1.2-2.6-2.8-0.3-1.6-1.5-0.4-1.6 1.2-1.9-5.2 0.4-2-3-1.3-0.8-1.4 0.7-2-2.9-0.8-0.8-1.1-0.1-1.7 2-2.5 3 0.6 4.6-0.8 0.7-1.6-9.1-7.1-1.9-5-1.8-1.1-0.4-4.9-2.8-5.2 1.1-1.3-0.6-1.1-6.7-6-3-6.7-2.9-1.1-0.1-3.1 2.8-2.7-0.3-2.1 1-0.9-2.7-4.4 0.8-2.4-2.7-1.5-0.4-1.8 1 0.2 0.1-2.3-1.8-5.7 1.9-2.1 6.7-1.4 7.5 2.2 3.1 3.4 2.2-0.4 8.3-7.5 6.3-4.3 1.5-2.2 2.2-7.6 2-3 2.4-1.7 13.8-1.1 4.5 0.9 15.6-2.5 7.5-3.5 11.8 2.5z"/>
          <path class="reg" id="uaw-r-cherkasy" data-r="cherkasy" data-cx="536.5" data-cy="261.5" d="M551.1 189.8l1.4 0.1 2.6 4.8 2.8 1.3 1.3 1.7 2.1-1.3 0.9 0.5 0.1 2.2-2.3 1.1 1.2 4.4 2.3 1.5 2-0.2 2.5 5 2.3 2.3-0.5 6.4-2.3 0.7 0.4 1.8 3 4.9 2.3 0 1.9 2.3 1.5-0.3 1.8 1.5 0.5 5.2 6.7 2.9 0.7 3.8 2.6 2.9 0.1 3.9-2 1.7-2.3 4.3 4 6.1 2.3 6.1-0.1 6.1-2 6.9 1.7 1.8 0.9 6.9 1.4 4 1.7 1-0.2 1.1-3.8 3.6-2.1-0.2-3.1-1.9-3.3 3.7-3.4-1.2-0.9 2.2-1.4 0.4-1-3.3-3-4.6-0.1-3-2.4 1.3-2.2-0.4-2.1-3.7-2.3 1.7-0.1 1.7-2.6-0.2-2.7 4.4-2.7 2-0.6 1.3 0.6 2.1-1.2 2.2-1.9-0.8-2 0.3-1.4-1-4.8 2.6-2.9 3.1-1-0.5-1.5-3.7-6.1-2.8-2.6 0-1.8 2.2-5.5-0.8-1.2 1.3-0.2 6.4-2.6 2.6-1 3.6-7.2 3.1-1.3-1.6-4.7-0.9-2 0.1-4 2.1-3.4 0-5.8-2.3-7.2 0.5-1.1-0.9-4.8-0.6-5.9 4.4-0.4 4.6-3.2 3.4 2 1.5-0.5 3.3-4.9 0.7-1-1.3-2.6-0.2-1.6 3.4-7.7 4.5-2.9-1.4-4.8 3.4-3.6-1.7-4.5 1.4-0.1-1.4 3.2-3.9 0.2-1.5-3.2-6-0.4-4.1-5.4-3.3 0.1-2 1.6-1.5-2-1.9-4.5-0.6-1.5-6.6-2.3-1.6 1.1-2.5-0.5-1.8-4.3-2.4 2-4.4-0.7-1-3.1-0.6-0.6-1.2 0.9-2.6 3.4-1.9 0.2-2.5 1.8-1.4 0.2-4.4-2-2.3 1.3-1.4 2.1 0.6 0.5 0.5-0.8 1.6 1.7 1.7 5.6 0.1 3.2-6.2 2.4-1.4 2.4-0.1 1.8-1.8 4.3 0.8-0.7-2.1 2.7-2.4 1.7 0.7-1.1 2.4 0.6 0.9 9.7 2 0.8 1.9 1 0.3 2.1-8.8 1.4-1.2 3.1 2.2 2.7-1.4 2.4 0.9 1.4-2.4 3.6 0.4 2 2.8 3.4-1.2 1.6-1.5 1.8 0.4 1.4-1.1 2.2 1.3 2.1-5.5 7.3-6.8 1.8-3.6 2.5-2 0.2-2.2-1.6-1.2-0.1-1.6 2.5-4.6-0.2-2.3 1.5-5-0.8-2.1 0.9-2.3-1.1-1.4 1.8-2.8 2.6-0.7 4.3-3 5.2-0.8 1 0.4 2.7 5.3 1-2.2 3.1 0.2 1.1-3 0.8 0.4 0.5 3 5.7 0.8 5-9.6 0.2-3.9 3.4-1.5-1.3-6.2 2.8-2.6 0.8-1.9 2.6-0.2 1.5-1.7 0.4-1.5-1.2-2.6 1.4-2.6 1.8-0.4z"/>
          <path class="reg" id="uaw-r-kirovohrad" data-r="kirovohrad" data-cx="566.2" data-cy="344.0" d="M653.5 307l-5.2 8.9-0.8-0.2-0.5-2.8-1.5 1.4 0-1.9-1.1-0.5-2.5 2.1-2.1-2.1-2.9 2-1.9-0.9-1.5 1.9 2.3 4.2 4.8 1.7 3.9 0.3 0.7 1.5 2.9 1-13.3 9.1-1-0.3-4.7 1.9-2 1.6 2.4 6.5-0.8 1.7 1 1.9 0.6 7.4 1.4 1.2-0.6 4.9-2.4 0.9-3.8 4.4-1.6 0.2-1.4-1.1-4.4 6.9-0.8-1.5 0-4.1-0.7-0.3-1.1 6.9-4.4 0.8-1.7 1.4-3 3.1-1.2 5-1.1-0.9-0.1-1.8-2.1-3.8-4.9 1-0.1 3-2.3 0.8-0.8 1.6-1.3-0.2-1.3-1.6-4.8 1.5-0.7 2.6 1.7 0.8 0 1.5-2.7 0.7 0.9 4.7-1.6 0.7-0.4 3.1-9.9 1.6-4.4-1.6-2.2 0.4-3.3-2.2-3 0.1-3.9 5.6-1.4 0.4-2.6-1.2-1.3-2.3-2.5-1.6-2.6-0.2-1.1 1.4-5.2 0-1.2-4.2 1.5-2.8-0.3-1.4-2.2-4-3-0.6-3.2-5.3 3.3-2.5-0.6-4-3 0.2-4.9-2.2-1.4 0.8-0.6 2.1-2.5-0.2-0.5 2.3-0.8 0.3-0.6-0.4 0.7-3.6-0.7-1.3-4.7 1-1.7-1.5-1.8 1.1-5.6-0.7-1.1-0.9-0.2-2.3-2.1-1-0.3-3.1-0.9-0.3-7-0.6-2.6 1.1-1 2-3.9 2.1-2.7-2.5-1.9 2.3-1.9-1.6-4.6-0.3-3.8 1.6-0.9 1.5-5.6-1.5-9.5-0.1-1.4 2.4-13.2-0.7-2-1-2.8-5.4-2.4 0.9-1.7-1-2.3 3.5-2.8-2.4-3.1 0.4 0.5-4.2-2.6-1.3 1.7-2.7 0.6-4.2 5.8-6.7 1.8 0.4 1.3 4.4 3.2-3.9 3-0.9 1.4-1.9 2.4-0.1 4.1-3.1 2.9 1.4 7.7-4.5 1.3-3.3 2.9 0.1 1 1.3 4.9-0.7 0.5-3.3-2-1.5 3.2-3.4 0.4-4.6 5.3-4.2 4.9 0.3 1.6 1 6.6-0.6 4.5 1.1 1.9 1.3 3.4 0 4-2.1 2-0.1 4.7 0.9 1.3 1.6 7.2-3.1 1-3.6 2.6-2.6 0.1-5.8 0.8-1.7 6 0.6 1.8-2.2 2.6 0 6.1 2.8 1.5 3.7 1 0.5 2.9-3.1 4.8-2.6 1.4 1 4.3 0.3 1-3-0.5-2 3-2.4 2.7-4.4 2.6 0.2 0.1-1.7 2.3-1.7 2.1 3.7 2.2 0.4 2.4-1.3 0.1 3 3 4.6 0.6 3.2 1.6-0.1 1.1-2.4 3.4 1.2 3.3-3.7 3.1 1.9 2.1 0.2 4-4-0.1-0.9-1.6-0.8-1.4-4-0.5-5.8-2.1-2.9 2-6.9 13.8 6.8 6.6 5.2 2.6 4.2 5.2 0.5 2.4 1.8 0.3 0.9-1.5 0.6 0 1.5-1.1 1.1 4.4 4.7 1.2-1.2 1.4 0.2 6.8 4.2 2.7-1.8 3.2 2.2 0.8 2.3 1.4-3.1 4.6-1.4 1.6 1.6 4.7 1z"/>
          <path class="reg" id="uaw-r-kyiv-oblast" data-r="kyiv-oblast" data-cx="449.0" data-cy="235.2" d="M467.3 101.9l-0.3 1.4-2 0.6 1 3.5-1.2 6.4 0.1 8 0.5 0.8 1.9-0.8 3.3 1.2 1.9 1.6 0.8 2.5-0.5 5.7 6.7 3.9-0.2 3.2-1.7 4.7 2.9-0.2 2.3 2 2-1.6 3.3 0.8 1.8-1.1 4.3 0.2 2.7-1 1.4 2.3-0.1 1.6 2.5 0.7 0 1.2 3 3.7 0.3 3.2-1.8 1.4-0.3 1.6 2.5 2.5 1.8 0.2 0.9 3.2 3 1.1 3.1-0.4 4.3 1.1 2.1-1.6 3.4 0.8 2.9-0.7 4-3.1 3.4 0 2-2.1 0.7-3.3 3.3-0.6 5.9 6.2 3.6 0.5 0.2 3.5-2.2 0.4-1 2.1 1.9 2.1 0.7 2.8 3.7 1-1.1 2.1 0.6 0.9 3.4 2-2.6 5.6 0.5 1.2-1.8 2.9-2.1-1.1-1.8 0.4-1.4 2.6 1.2 2.6-0.4 1.5-1.5 1.7-2.6 0.2-0.8 1.9-2.8 2.6 1.3 6.2-3.4 1.5-0.2 3.9-5 9.6-5.7-0.8-0.5-3-0.8-0.4-1.1 3-3.1-0.2-1 2.2-2.7-5.3-1-0.4-5.2 0.8-7.3 4.2-1.4 2.3 1.1 1.4-0.9 2.3 0.8 2.1-1.5 5 0.2 2.3-2.5 4.6 0.1 1.6 1.6 1.2-0.2 2.2-2.5 2-1.8 3.6-7.3 6.8-2.1 5.5-2.2-1.3-1.4 1.1-1.8-0.4-1.6 1.5-3.4 1.2-2-2.8-3.6-0.4-1.4 2.4-2.4-0.9-2.7 1.4-3.1-2.2-1.4 1.2-2.1 8.8-1-0.3-0.8-1.9-9.7-2-0.6-0.9 1.1-2.4-1.7-0.7-2.7 2.4 0.7 2.1-4.3-0.8-1.8 1.8-2.9 0.3-1.9 1.2-2.7 4.2-0.1 1.8-5.1 0.5-2.4-1.7 0.1-2.5-2.1-0.6-1.1-1.5-2-0.1-2.9-5.2-3.2-0.9-1.7-4.1 0.2-1.8 3.6-3-1.6-5.6 1.4-1.8 0.1-1.6-3.8-3.5 0.7-6.1-3.6-0.9 1.9-2.9 0.1-1.6-3.5-0.4 1.7-4.9-0.7-2.2 10.7-6.3 5.7-6.1-3.4-7 0.7-1.8-0.9-4 0.3-1.2 2.5-0.8 0.8-1.7-0.4-2.6-2-2.5 0.3-7.1-3-4.2-2.1-1-1.4-6-2.3-2.4-5.1 1.1-1-0.9 2.2-1.7-1.2-1.9 2 0 1-2.5-1.4-3.1 1.1-0.4 1.1-3.1-1.8-3 3.1-5.7 2.7-2.1 0.4-1.7-1.4-5.4-4.3-0.7 0.8-7.9-6.2-8.8 0.3-0.8 1.8 0 1.8 0.9 0.1-4.8 1.4-3.5-3.4-2.5-0.9-2.1-2.7-2.3-1.2-0.2-1.6 2.4-2.3-11 4.3-2.2 2-2.8 0.3-5.9-1.4 0.1-0.7-1.2 2.8-1.7 3.5 1 2.2-4.7 3.4-1.1 2.8-3.2 2.4-0.6 2.1 0.8 2.1 3.9 5.1 0.9 3.1-3.1 2.2 0.6 4.6-2.1 9.4 0.2 4.4 4.8 3.5 2.1 0.5 2.8-0.7 2.6 2.1 3.2 4 1.2 2.1 2.6 3.1 0.8 1 1.6zM483.2 159.8l-0.4-4.8-5.4-2.6-1.2 1.4 0.1 2.5-3 1.8-0.9 2.4-5.3-0.5-0.7 0.8 0.5 2-4-4.1-0.8-3-1.3-0.3-0.3-2.5-5.5 0 0 2.2-3.5 0.4 1.2 2.1-0.3 1.7-1-1.6-1 0.6 0.5 3-2.3 2.1-1.8 13.5 0.6 1.1 0.6-0.9 0.9 0.2 0.8-2.8 4.5 0.6 0.7 3.4 4.5 5.6-0.1 3.7 1.9-0.2 1.7 5.5 1-0.4 1.5 1.3-0.6 3.8 1.4 0 0.3 4.2 1.5 0.5 1 6.7 3.4-1.7-1.5-7.7 1.1-0.1 0.8-2.8-2.7-9.6 2-0.7 0.3 1.2 3.9-0.1 0.3-4.1 1.7 1.8 2.1-0.3-0.1-3.5 2.2 0 0.9-1.8-1.6-1.2-0.1-1.5-3.1-4.8 0.5-4.2-1-1.6 1.4-3.3z"/>
          <path class="reg" id="uaw-r-odesa" data-r="odesa" data-cx="449.9" data-cy="444.3" d="M425.9 572.4l-4.3 1.8 4-2.4 0.7-1.5 3.2-1.4 11.2-10.6 2.8-1.5-12 11.5zM452.8 368l1.2 3.6-5.8 2.1 0.9 1.6-0.6 4.1 2.2 1.2 2.2 2.9 2 10.6 3.5 2.4 0.3 1.6-1.2 2.1 2 2.2-0.7 2.7 1 3.2 3.1 2.2 2.8-0.5 1.5 0.8 2.2-1.6 4 1 1.6 3.1 1.6-3.1 3.1-0.7 0.3 3.9 2.6 0.5 2 3 0.2 2.5-2.1 6.9 4.5 12.4 5.5 0.7 1.1 1.4 6.6-1.6 1 2.5-3 2.7 0 2 3.6 2 2.3-0.6 2.5 4.5 1.9 0.7-0.5 4.2-1.8 3.9-2.3 2.2-5.9 0-1.4 1.6-3.1 0.6 1.3 4.1 5.9 5.8 1.4 15.9-10.9 2.2-7.5 3.9-2.9-0.6-0.7 0.6-2 3 2.4 5.6-1.4 4-3.2 3.9-3.5 0.3 2 2-0.3 1.6-6.6 11-2.2 2.3-1.6 4.2-6.8 6.6-6.1 8.2-6.8 6-0.6-5.7-1.8 6.1-1.2-0.5-0.7 0.6-3.9-2.7-1.2 0.7-0.9 5.3-1.1-1.6 0.4-1.5-0.7-0.2-0.5 2.4 1.2 2.5-0.4 2.2-2.5-3.3-0.7 1.1-4 1.1 0.1 2.7 2.2 1 0.9 1.8-2.8 1.6-1.1-0.6 0 1.6-3.1 1.7-0.5-4.2-2.3-2.3-0.2-4.4 0.8-2.4-3.1-3.5-0.4 1 1.2 1.9-1.6 3 0.8 3.3-1.9 1.5-0.8 10.5 3.3 1 3.2-2.2-5.6 7.6 2 2.8 0.8-2.5 0.9-0.3 0.2 2.2 1.5-0.5 0.6 1.6 1-3.1 1.3 2.2-0.4 2.6-1.1-0.1 1.2 2.4 0.3 5.7-1.5 6-1.1 1-2.7 0.6 0.7-4.5-1.2-5.7-4.5-3.9-7.7-2.8-6-1-2.2 1.7-3-0.1-3 2.7-5.8 2.2-3.6 2.8-1.7 0.1-1.1 3.1-1.3 0.5-5.4-3.4-2.4 0 0.1 2.3-1.6 0.8 0 1.4 2.3 1.6-1.4 1-3.8 0.4-7.3-1.7-4.6-2.4-4.9-1.3-4.2-2.2-2.7-6.2 0.3-1.6-2.7-2.4-1.4 0.2-0.6-1.5 0.8-1.9 3-2.3 8.1 1.4 4.7-0.4-0.2-3.9 2.1-1.7-1.4-4.3-2-1.9 0.3-0.9 1.9-2.6 2.6-1.1 0.8-3.6 5.2-1.2 0-2.8 3.8-2 0.4-2.6-1-4.1 0.7-2.5 12-3.9-1-7 4.2-7.4-0.3-1.8-4.2-4.4 0.7-3.6-1.5-8 1.5-4.1 4.1-2.8 9.1-3.9 1.2 2.9 0 7.7-1.3 2.3 1 1.7 3.2-3 1.4-0.3 0.3-4.3 1-1.7 3 4.6 5.3-5.6 1.6 0.7-0.3 4.1 3.4 1 2.3 3.5 1.8 0.6 1.6-1.1 0.5-3.8 2.7-0.4 0.6-3.5 4.8 5.9 0.4 3.5 1.1 1.2 4.1-2.6 9.9-0.2 2.8-3.9-1.6-0.6-1.4 0.6-3.5-3.1 0.4-0.7-1.4-2.3-1.4 0.6-3.8-3.2-0.2-1.8 2.2-0.3 0.7-1.8-1.1-3.2 1.2-8.5-1.3-6.9-2.2 0.2-0.9-2.5-1.6-1.3-5-0.3-3.2-3.8-3.5-0.8-4.1-2.5 0.8-5.4 1.7-2.7-0.1-1.3-1.8-2.5-1 0.1-1.7 2.5-2.4-4.2 3.7-1.9 0-8.1 2-2.1-1.3-5.2-0.9-0.9-3.3-0.3-1.2 3.7-1.9 1.2-1.7-0.5-1.5-1.9-0.4-3.7-3.3-2-1-2.8-2.7-2.8-0.8-0.5-2 1.8-1.5-1.6-2.1-6.9 3.6-6.5 0.8-8.6 2.3-3.2-0.9-1.5-2.5-1.2 0.5-2.4 2.7-4.3-3.5-1.7-1.3-5.3-1.4-1.7-1.7-0.4-4.2 4.1-2 0.4-3.6-2.2-3-4 5.7-2.9 4.5-3.9-0.2-4 2.5-1.2 8.8 5.1 5.1-0.2 5.3-2.2 4.2 1.9 9.2 0 1.2-3.8-1.8-2.7 0.3-0.7 8.1-2.8 3.6 2.6 2.6-3.6 1.4 1.1 2.4-0.9 2.8 5.4 2 1zM443.7 511.8l-1.1 2.9 0.9 2.7 3.7 4.2 6.1 2.3 2.1 1.7 4.6 8.9 1.5 0.6 2.6-3.3 0.2-1.5-4.4-4.1-0.8-5.2-3.8-2.4-1.6-6.8-0.8 5.1-1.1-0.2-1.8-2.3-0.8-4.1-1.2-0.3z"/>
          <path class="reg" id="uaw-r-vinnytsia" data-r="vinnytsia" data-cx="364.2" data-cy="310.1" d="M405.9 240.4l3.6 0.9-0.7 6.1 3.8 3.5-0.1 1.6-1.4 1.8 1.6 5.6-3.9 4 1.3 4.2 3.7 1.6 2.9 5.2 2.6 0.4 0.5 1.2-1.3 2.1 2.1 2-0.3 4-1.8 1.4 0 2.2-3.6 2.2-0.8 1.5 0.5 2.3 3.1 0.6 0.7 1-2 4.4 4.3 2.4 0.5 1.8-1.1 2.5 2.3 1.6 1.5 6.6 4.5 0.6 2 1.9-1.6 1.5-0.1 2 5.4 3.3 0.4 4.1 3.2 6-3.5 6.6 4.7-1.2 1.9 1.5-1.4 1.9-3 0.9-3.2 3.9-1.3-4.4-1.8-0.4-5.3 6-1.1 4.9-1.7 2.7 2.6 1.3 0.2 1.8-0.7 2.4-6 2.5 1.7 3.1-1.2 3.8-9.2 0-4.2-1.9-5.3 2.2-5.1 0.2-8.8-5.1-2.5 1.2 0.2 4-4.5 3.9-5.7 2.9-1.6-2-1.8-7.2-1.6-1-5.8-0.4-6.9-2.2-1.2 0.5-2.2 7-1.8-1.5-1.6-3.2 1-2.3-1.4-1.8-1.3 0.2-2.1 3.2-1.2 0.3-0.6-0.7 0.3-2.3 2.2-2.4-0.3-3.9-3.5 0.2-4.3 2.3-1.5-1.2-0.6-3-2.6 1.6-2.1 0.2-0.8-0.6 1.1-3.3-1.3-2.6-8.3-2-4.2-5.9-3.6-2.6-1.8-0.9-6.9 0.1-1.1-0.6-0.2-2.2-5.5 1-3.7-10.9-3.7-2.3 1.6-6.6-0.2-4.4 1.6-0.7-3-13.9 1.5-1.9-1-2.9 1-2.5 4-4.6 1.7-4.3 4 0.3 2.3-3.1 8.4 3.7 2.4-2.2 4.3-1.4-0.5-4.4-1.3-2.7 1.2-3-1.4-2.3 0.1-2-1.9-1.1-0.9-3.2 2.4-2.1-1.1-2.3-4.6-0.5-0.1-1.6 1.2-1.2-2.1-2.6 0.4-2.3 2 0.2 0.9-1-1-2.6 2.7-5.8-3.6-4.2 0.8-1.7 2.2 0.2 1.4-1.2 0.4-0.9-1.3-1.3 2-0.4 1-1.3 4.9-0.6 3.8 0.6 13.4-2.4 3.7 1.4 2.2-0.1 3.2-3 5.4 0.2 2.3 1.6 3.3-1.2 5 0.6 1.7-3.3 2.9-1.7 1.8-2.5 4.1 0.8 1.6 3.5 0.2 3.7 3.3 4.3-3 5.1 2.6 4.2-0.9 2.2 0.8 0.9 7.7 1 7.3-0.3 1-2.3 4-0.4 3.2-2.7z"/>
          <path class="reg" id="uaw-r-zhytomyr" data-r="zhytomyr" data-cx="345.6" data-cy="144.5" d="M400.7 90l0.7 1.2 1.4-0.1-0.3 5.9-2 2.8-4.3 2.2 1.6 8.8 0.7 2.2 1.6-2.4 1.2 0.2 2.7 2.3 0.9 2.1 3.4 2.5-1.4 3.5-0.1 4.8-1.8-0.9-1.8 0-0.3 0.8 6.2 8.8-0.8 7.9 4.3 0.7 1.4 5.4-0.4 1.7-2.7 2.1-3.1 5.7 1.8 3-1.1 3.1-1.1 0.4 1.4 3.1-1 2.5-2 0 1.2 1.6-0.3 0.9-2 0.7 0.8 1.3 5.4-1.1 2.3 2.4 1.4 6 2.1 1 3 4.2-0.3 7.1 2 2.5 0.4 2.6-0.8 1.7-2.5 0.8-0.3 1.2 0.9 4-0.7 1.8 3.4 7-5.7 6.1-10.5 5.6 0.5 2.9-1.7 4.9 3.3-0.1-0.3 2.9-1.3 0.8-0.2 1.3-1.9 0.2-2.7 2.5-4.5 0.6-1 2.3-7.3 0.3-7.7-1-0.8-0.9 0.9-2.2-2.6-4.2 3-5.1-3.3-4.3-0.2-3.7-1.6-3.5-4.1-0.8-1.8 2.5-2.9 1.7-2.2 3.4-4.5-0.7-3.3 1.2-2.3-1.6-5.4-0.2-3.2 3-2.2 0.1-3.7-1.4-13.4 2.4-3.8-0.6-4.9 0.6-11.5-3.3-3.4-5.8-0.1-2.3-3.1-1.9 0.4-2.4 1.8-0.5-2-5 3.9 0.2 2.7-2.4-0.2-2.2-2.2-1.8 1.5-3.3-1.1-1.8 1.2-2-2.4-3.9 0.1-3.7-1.2-0.7-2 3.3-3.4-0.4-0.4-2.1-3-2.3-1.5-0.2 0.2-1.9-5.3-3.6-1.1-2.4-3.2-1.3 1-5.1 3.1-3.2-2-0.7-4.2-4.8 2.4-3.6-2.4-3.1 4.4-10.4-2.6-5.6 0.9-7.2-1.4-2.9 1.2-1.3-2.2-5.3 1.4-3.2 4-1.4 2.7-4.3 0.9-4.7 2.1-4.1 2.4-2.2 0.7-2.5-2.1-5.1 3.9-1.4 1.3-2.1-1.2-3 0.9-5.9 5.3 4.5-1.4-4.1 0.6-3.1 4.4-1.6 1.9 2.1 1.7 0.2 3.4-4.7 0.4-6 1.8-2.5 2.4 0.4 4.4 4.3 6.4 0.2 2.4-1.6 2.9-5.1 2.4-1.7 2 1 0.7 3.5 2.9 2.4 2 4.4 6.4-4.1 7.9 1.6 2.3 10.2 3.2-0.3 1.4 3.6 1-1.1 0.3-6.2 2.6-4.3 3.5-2.4 6.5-0.9 3.5-5.1 2.2-0.4 2.2 0.5 2.1 2 3.6 7.5-0.3 4.6 2.4 3 1.8 5.3 1.3 0.7z"/>
          <path class="reg" id="uaw-r-sumy" data-r="sumy" data-cx="647.8" data-cy="129.4" d="M751.7 180.6l-0.6 1.8-1.1 0.4-8.9-0.2 0.1 1.8-5.5-2.9-1 3.5-2.7-1-1.6 1-0.2 1.7-2.5-0.1-0.5 3.2-2.4 0.6-4.4-1-1.9 3-2.3-0.1-1.2 3.3-3-1.8-1 2.2-2.7 1.8-5.2-1.2-4.2 1.9-1.9-1.1-1.9 3-7.4-0.7-3.5 1.4-0.8-4.5 2.5-1.3 0.1-2-2.6-2.4-1.8-4-2.2 0.8-1-0.9-0.4-3.2 0.8-3.4-6.5-7.5-0.7-8.6-2.2-0.7-1.1 1.3-3.6 1.2-0.4 1.7-2.4-0.1-0.9 2.1-4.6-1.9-4-3.5-5.1 2.2 1.9 2.2-6.1 1.8-4.8-2-16.8-3.5-3.6-1.9-2.3 0.6-2.2 2-5.3-0.7-2.1-1.2 2.4-7.5-0.2-3.1 1.3-1.3 0.6-3.6 1.8-2.3-2.2-2.6-0.3-3.6 1.4-5.9 2-3.2 0.1-4.4-1.7-2.7 2.9-4.4-1.9-1.1-1.7 3.1-3.2-0.6-2.2-1.5 1.1-1.5-0.3-1.1-2.1 0.2-4.5-1.9 1.7-3.7-0.4-3.4 3.6-1.8 0.1-2.7 2.3-2.1 0.1-3.1-1.3-1.7 0.3-2.6-1.8-0.7-1.2-3.3 1.1-1.4 1.9 2.5 3.3-0.5 0.8-4-1.2-3.2 1.3-2.1-0.5-2.8 2.4 1.1 1.2-1.6-1.9-2.7 0-1.6 1.6-1.3-1.1-1.3-0.3-4-1.2-1.7 1-3.2-3.8-4.3-1.2-4.6 1.5-3.8 1.8-1.4 1.1-2.6 1.4-0.4-0.4-1.8 3.6-0.1 2.6-2.1 5.2-1.6 0.5-2-1.2-1.9 1-1.3 0.4-4.7 1.6 1.1 2-0.1 1.5-0.5 0.7-1.4 0.1-1.6-2.3-0.4-3.6-4.6-2.7-1-0.4-1-0.3-4.3 2.3-3.5 2.3-8.7 2 0.5 2.4-1.7 1.1 1.5-0.4 3.5 1 1.4 1.2-0.1 3.8-3.8 4.8-2.3 6.4 0.1 2 3.7 3.4 2.5 3.2 5.6 3.5 2.4 2.4 3.5-0.1 9.8 2.1 5.2-0.3 3.7 2.8 0 1.1 0.8 3.4 3.9 0.4 1.9 2.3-0.3 6 5.7 1.5 3.6 0.1 3.7-2.1 2.5-4.3 0.2-9.4 2.3-2.2 1.2-0.5 2.1 3.3 2 0.8 3.3 3.9 6.2-0.7 5.3 0.5 2.4-0.6 1.4-1.3 0.3 0 1.3 3.4 2.7 2.9-0.4 0.5 3-1.4 2.9-5.4 4.6 5.3 2 5-2.7 7.8 2.5 5.3-0.4 2.7 5.5 5 0.6 3.9-0.9 7.1-3.5 2.9 1.1 4.4-0.5 3.6 13.2 1.6 1.5 1.9 0.2 5.6-0.8 2.6 2-1.2 2.2-3 0.7 0.2 3.3 0.6 1.5 2.7 1.9 0 3.5 2 3.7 0 3.2 3.3 3.1 0.4 6.5 1.3 1.7-5.1 3 2.7 11.6 1.2 2.2 5.2 2.2 1.6 6.4 1.2 1.4 2.2 1.4z"/>
          <path class="reg" id="uaw-r-dnipro" data-r="dnipro" data-cx="712.2" data-cy="328.7" d="M712.5 281.8l10.3 1.4 10.6 10.6 5.2 3.9 6.8 0 2.2 1.5 3.4 0.9 1.7-0.5 4 1.6 8.2-3.5 1.2 0.6 3.8 5.8-3.3 3.8 2.4 0.1 3.7 2.1 5.4 5.6-2 3.3 8.3 7.2-0.9 3.3 2.2 2.3-1.9 2.7 0.9 0.9 1.7-1.2 1.3 0.9 1.8-0.9-0.6-1.4 1-1.8 5.2-5.6 3.8 1.7 2.1 2 7.9-1.9 0.7 2 2.7-0.2-2.1 3.3 0.3 3 2.2-0.5 1.4-3.7 3.3-0.2 0.6 4-2 1.4 0.2 2-1.2 1.4 0.6 3.5-2 1.4-0.1 1 0.3 7.2 2.7 0.2 2.3 1.6 1 6 0.1 2.4-3 2.9 1.2 5.7-0.3 2.6-3.2 2.4-4.8-2-1-1.6-3.3-1-4.2 0.7-0.7 1.8 0 7.2 2.1 1.1 1.1 3-5.5 1.3-0.1 1.8 1.8 1.1 0.6 2.2-10.2 1.5-1.7-1.2-2.4 2.1-1.7 0.1-4-1.4-0.6-2.7-1.3 0.2-1.6 1.9-2.9 0.2-1.1-0.8-1.1-2.1 2.2-0.2 1-5.5-1.7 0.1-1.5-1.1-0.2-3.2-1.9-1.2 1.3-3.2-3.9 1.2-0.8-5.1-7.9 2-1.7-1.8-3-0.7-3.2-2.5-3.9 0.8-3.2 2.7-1.9 0.4-9.5-2-4.8-2.2-4.9 0.9-3.5-0.8-4.7 1-4.1 3-3.2 0-0.8-3.2-1.1-0.3-0.9 1.6 0.7 2.2-0.4 3-1.5 2.1 1.6 0.7 0.8 2.4 2.9 0.9 0.5 1.3-0.6 1.4-3 0.8-1.8 1.5-0.7 2.4 5.2 3.9-0.7 6 3.1 0.9-2.7 12.3 1.9 2.2-1.3 3.8-9.8-1.2-7.5-2.5-8.2 3.8-16 4-5.5-0.5-8.6-2.8-13.7 2.3-1.7-2.1-2.2-0.2-0.5-1.9 0.7-1.8-1.4-1.3-3.8 0.9-0.5 2.6-6.4 1.4-1.7 1.7-1.8-1.3-0.7-2-1.5-0.7-14.9-4.1-0.2-1.4 1.5-2.6-2.1-5.6 5.8-2.2-1.5-2.6 0-5.1 1.2-5.4-0.7-1.3-2.1-0.7 1.4-8.8 4.7-4.5 4.2-0.5 1.3-7.2 0.7 0.3 0 4.1 0.8 1.5 4.4-6.9 1.4 1.1 1.6-0.2 3.8-4.4 2.4-0.9 0.6-4.9-1.4-1.2-0.6-7.4-1-1.9 0.8-1.7-2.4-6.5 2-1.6 4.7-1.9 1 0.3 13.3-9.1-2.9-1-0.7-1.5-3.9-0.3-4.8-1.7-2.4-3.7 0.9-1.8 1.2-0.6 1.4 0.9 2.9-2 2.1 2.1 2.2-2.1 1 0.1 0.4 2.3 1.5-1.4 0.5 2.8 0.8 0.2 5.2-8.9 6.7 4.9 6.8 2 4.1 3.2 3.2-2.7-1.1-2.4 2.3-2.8-0.4-2.3-2-2.3 0.3-2.4 1.7-4.1 3.3-1.7-1.4-1.2 3.3-3.7 0.3-2.3 1.2 0.2 10-4.4 6.4-1.7 3.2-2.4 2.9-0.5 1.6 0.6-0.5 1.8 1.3 0.7 2.2-3.2z"/>
          <path class="reg" id="uaw-r-donetsk" data-r="donetsk" data-cx="863.9" data-cy="380.6" d="M936.8 391.1l-8.8-0.3-2.6 1-3.3 5.6-2 8.5-4-0.5-5.5 4.7-11.6 1.6-1.9 1.3-3.2 8.1-0.2 8.1-3.8 7.6 1.7 1 4 0.1 0.3 2.5-5.2 5.2-0.4 2.5 1.1 4.8-4.1 5.3-1.9 0.9 1.2-3.9-3.2-2-2.5 1.4-9.1-1.6-6 2.2-9.6-1.3-1.9 0.7-3.5 3.8-8.2 12.4-1.2 0.6 0.3-2.1-1.3-1.6-3.7-1.3-3.6 2.3-6.9 2.6-1.6-4.1 2.9-2.8 1.6 0.5 1.3-0.8-1.1-2.8 1.5-2-2.6-2.6-1.4 0.9-2.1-1.7-2.7-6-4.1-2.1-1.8-2.3 4.6-1.2-1.1-7.6 6.1 1.2 2.4-1.1 0.3-2.4 2-3.4 1.4 0.2 1.3 1.9 0.9-0.4 2.3-8.6-3.8-0.7-1.3 1.1-7.8-8.3-2.4-1.5-2.8 1.6-5.3-4.9-2.5 0.7 0-2.6-1.8-1.3 1.5-2.1-2.5-1.3-2.7-8-3.9-0.3-0.8-6.2-2.1-1.7 0.6-1.9 5.1-0.9-1.1-3-2.1-1.1 0-7.2 0.7-1.8 4.2-0.7 3.3 1 1.5 1.9 4.9 1.5 3-3-1.2-8 3-2.8-1.2-8-2.6-1.7-2.1 0.3-0.4-1-0.2-7.3 2.1-1.7-0.6-3.5 1.2-1.4-0.2-2 1.9-1.1 0-3.4-0.5-0.9-3.3 0.2-1.4 3.7-2.5 0.3 0-2.8 2.3-3.1-3.3-0.6-1.3-4.4-0.6-10.5 6.8 1.2 3.9-2.4 7.4 3.5 0.4-1.3-1.8-1.2 1.1-2.1 2.5 0.2 1.1-2.6 1.2 0.1 1.3 1.5 2.7-0.4 0.2-2.8 2.2-3.1 2.5-1.7 2.5-0.4-1.1-4.8 1.3-2 1.9-1 0.8-2.5 13.6-8.9-1-2.1-4.8-0.8 2-3.5 5.7-0.2 7.1 2 3.4-0.3 1.4-2 2 2 2.2 0.7-0.2 0.7-2 0.3-0.6 2 0.6 0.7 4.5 2.1 2.5-1.8 2.7 0.4-0.5 5.2-1.1 1.4 2 6.3-3.2 1.8-0.5 1.6 2.6 1.5 8.5 1.1 1.1 5.9 2.7 1.2 1 4.8-1.7 4.2 2.2 0.6-3.2 4.9 1.2 7.8-0.6 2.5 3 2-0.2 5.9 3.3 1.5 1.6-0.9 4.7 7.5-0.7 1.4-3.4 1 0.8 3.2 2.1 1.1 5.8-0.5 2.3 5.9-0.2 2.3 11.6 5.7 0.5 1.4-1.3 3.1 2.3 2.4 10.3 1.7 0.2 4.7 1.4 2.7z"/>
          <path class="reg" id="uaw-r-kharkiv" data-r="kharkiv" data-cx="800.6" data-cy="251.3" d="M880.7 218.2l1.2 3.4 2 2.3-4.2 1.4-0.2 1.3 2.4 2.3-2.2 2.9-2.2 0-1.3 1.8 0.3 1.3 2.9-0.1 0.1 5.1-3.1 5.1 1 2.6-0.6 0.9 0.6 3-2.1 2.1-0.8 3.5-2.8 2.7 1.5 3.4-0.1 6 2.4 1.1-1 2.7-3.5 3.1-0.5 1.8-1.2 0.4-2.5 0.1-7.1-2-5.7 0.2-2 3.5 4.8 0.8 1 2.1-13.6 8.9-0.8 2.5-1.9 1-1.3 2 1.3 4.5-5.2 2.4-2.2 3.1-0.2 2.8-2.7 0.4-1.3-1.5-1.2-0.1-1.1 2.6-2.5-0.2-1.1 2.1 1.8 1.2-0.4 1.3-7.4-3.5-3.9 2.4-6.5-1.4-0.7 1.6 2 12.1-7.2 2-5.2-3.5-1.7-0.2-4.9 5.5-1 1.8 0.6 1.4-1.4 0.9-1.7-0.9-1.4 1.2-1.1-0.7 1.8-2.9-2.2-2.3 1.1-2.8-8.5-7.7 2.1-2.9-0.4-0.8-4.7-4-0.4-1.2-3.7-2.1-2.4-0.1 3.3-3.8-2.3-4.4-2.2-1.9-8.7 3.4-4-1.6-1.7 0.5-3.4-0.9-2.2-1.5-6.8 0-5.2-3.9-10.6-10.6-10.3-1.4 0.2-2.1-1.9-4.6 1.1-3.2 3.6-3.4 2.5 1.9 5.8 0.6 5-2.4 4.6-6.5-0.6-2.6-2.1-2.9 0.5-1.9 1.9-0.7 3.8 0.9 2.2-1.2 0-1-4.1-3.8 4.7-0.8-3.5-7.7 0.9-1.1-0.5-2-2.4 0-1.2 1.6-3.8-1.1-0.5-1.3-1.9-0.4-0.5-2.3-2-2.2-0.8-7.5-1.9-1.3-2.5 0.7-5.3-3.5-3-0.1-3.4-2.1-1.6-2.4-1.2-5.2 4-4.6-0.3-7.8 2.7-1.8 0.7-2 3 1.7 1.5-3.4 2.3 0.1 1.9-3 4.4 1 2.4-0.6 0.5-3.2 2.5 0.1 0.2-1.7 1.6-1 2.7 1 1-3.5 5.5 2.9-0.1-1.8 8.9 0.2 1.1-0.4 3.1-5 2-0.5 2.5-2.8 6.2-0.9 9.7 0.8 3.5 3.2 5.5 8.9 2.6 0.5 4.7-2.7 7.5 3.4-0.1 4.1 3.3 1.3 2.3-0.8 2.6-4 9.2-5.5 3.6-1.3 7.6 0.3 8.1-2.3 4.9-4.6 7.2-1.5 1.1 0.6 2.5 7.4 4.8 2.4 1.8 1.9-0.5 7.5 7.6 10.8 10.4 6.5 3.5 5.3 1.2 3.6z"/>
          <path class="reg" id="uaw-r-luhansk" data-r="luhansk" data-cx="929.5" data-cy="275.2" d="M936.8 391.1l1.1-5-1.4-2.7-0.2-4.7-10.3-1.7-2.3-2.4 1.3-3.1-0.5-1.4-11.6-5.7 0.2-2.3-2.3-5.9-5.8 0.5-2.1-1.1-0.8-3.2 3.4-1 0.7-1.4-4.7-7.5-1.6 0.9-3.3-1.5 0.2-5.9-3-2 0.6-2.5-1.2-7.8 3.2-4.9-2.2-0.6 1.7-4.2-1-4.8-2.7-1.2-1.1-5.9-8.5-1.1-2.6-1.5 0.5-1.6 3.2-1.8-2-6.3 1.1-1.4 0.5-5.2-2.7-0.4-2.5 1.8-4.5-2.1-0.6-0.7 0.6-2 2-0.3 0.2-0.7-4.8-2.7 4.4-4.4-0.2-1.8-2.1-0.7 0.1-6-1.5-3.4 2.8-2.7 0.8-3.5 2.1-2.1-0.6-2.6 0.6-1.3-1-2.6 3.1-5.1-0.1-5.1-2.9 0.1-0.4-1 1.4-2.1 2.2 0 2.2-2.9-2.4-2.3 0.2-1.3 4.2-1.4-2-2.3-1.2-3.4 3.1-1.8 2.2 1 2.6-1.9 0.5-10.3 6.9 0 3.2 6.9 7.8 2.8 4-0.8 2.7 0.5 2.5-1 1.3 4.2 3.3 2.5 5.8 1.6 4.7 5.4 6.2-0.6 3.8-4.6 2.1-0.8 1.5 1.3 4.3 9.8 3.7 1.5 6.5-2 3 1.9 3.3 0.3 3.6 9.5 5.9 2.8 4 3.3 4.8-1 6.1-4.7 6.5 1.5 0.8 0.9-0.3 1.8-3.9 3.4-1.1 2.8 1.5 5.2 5.4 7.8-1.4 8.3-10.1 9.5-1.2 2-0.6 4.5-4.9 0.2-8.3 2.1-0.4 4.2 2.9 2.8 1.8 3.5 5.7 1.6 2.6-0.2 2.3 2.2 3.3-2.9 1.4 0.1 1 1.4-0.8 3.3-3.5 3.4-2.2 0.3-6.2-2.5-3.6 1.9-1.2 2.7-1.9 1.2-3.9 13.4 3.2-0.5 8.1 1.6 1.8 5.4-1.5 0.9 0.2 1.3 4.4 8.9-6 5.7 3.8 2.4 4-1.2 2 1.7-0.9 3.1-4.6 4.4-3.5 6.9 0.7 5.3-3.6 0.6-1 1.1 2 4.5-1.2 8.5-2.3 3.5-1.8 0.4-7.2-1.6-9.9 0.6-4-1.9-11.4 1.5z"/>
          <path class="reg" id="uaw-r-poltava" data-r="poltava" data-cx="644.6" data-cy="240.2" d="M708.3 197.8l0.3 7.8-4 4.6 1.2 5.2 1.6 2.4 3.4 2.1 3 0.1 5.3 3.5 3.5-0.3 1.3 1.6 0.4 6.8 2 2.2 0.5 2.3 1.9 0.4 0.5 1.3 3.8 1.1 1.2-1.6 2.4 0 0.5 2-0.9 1.1 3.5 7.7-4.7 0.8 4.2 4.7-2.3 1.3-3.8-0.9-1.9 0.7-0.5 1.9 2.1 2.9 0.6 2.6-5.5 7.2-4.1 1.7-5.4-0.5-2.6-1.9-1.1 0.2-3.9 5.5 1.9 5.4-0.2 2.1-3.6-1.5-2.2 3.2-1.3-0.7 0.5-1.8-1.6-0.6-2.9 0.5-3.2 2.4-6.4 1.7-10 4.4-1.2-0.2-0.3 2.3-3.3 3.7 1.4 1.2-3.3 1.7-1.7 4.1-0.3 2.4 2 2.3 0.4 2.3-2.3 2.8 1.1 2.4-3.2 2.7-4.1-3.2-6.8-2-6.2-4.4-2-2.7-4.7-1-1.6-1.6-4.6 1.4-1.4 3.1-0.8-2.3-3.2-2.2-2.7 1.8-6.8-4.2-1.4-0.2-1.2 1.2-4.4-4.7 1.1-1.1 0-1.5 1.5-0.6-0.3-0.9-2.4-1.8-5.2-0.5-2.6-4.2-6.6-5.2-13.8-6.8 0.1-6.1-2.3-6.1-4-6.1 2.3-4.3 2-1.7-0.1-3.9-2.6-2.9-0.7-3.8-6.7-2.9-0.5-5.2-1.8-1.5-1.5 0.3-1.9-2.3-2.3 0-3-4.9-0.4-1.8 2.3-0.7 0.5-6.4-2.3-2.3-2.5-5-2 0.2-2.3-1.5-1.2-4.4 2.3-1.1-0.1-2.2-0.9-0.5-2.1 1.3-1.3-1.7-2.8-1.3-2.6-4.8-1.4-0.1 1.8-2.9-0.5-1.2 2.6-5.6 4.6 0.6 3.6-4 4.9-1.7 1.7 1.5 2-1.3 1.9 0 1.4 3.2 1.3 0.4 8.3-0.2 2.8 0.8 4.7-2.6 3.7-0.8 1.5-2.8 5.7-4.4 2.9-5.1 2.1 1.2 5.3 0.7 2.2-2 2.3-0.6 3.6 1.9 16.8 3.5 5.2 2 5.7-1.8-1.9-2.2 5.1-2.2 4 3.5 4.6 1.9 0.9-2.1 2.4 0.1 0.4-1.7 5.1-2.5 2.2 1.1 0.3 8.2 6.5 7.5-0.8 3.4 0.4 3.2 1 0.9 2.2-0.8 1.8 4 2.6 2.4-0.1 2-2.5 1.3 0.8 4.5 3.5-1.4 7.4 0.7 1.9-3 1.9 1.1 4.2-1.9z"/>
          <path class="reg" id="uaw-r-zaporizhzhia" data-r="zaporizhzhia" data-cx="754.6" data-cy="439.5" d="M800.6 392.2l0.4 4.3 3.9 0.3 2.7 8 2.6 1.5-1.5 0.9-0.1 1 1.8 1.3 0 2.6 2.5-0.7 5.3 4.9 2.8-1.6 2.4 1.5 7.8 8.3 1.3-1.1 3.8 0.7-2.3 8.6-0.9 0.4-1.3-1.9-1.4-0.2-2 3.4-0.3 2.4-2.4 1.1-6.1-1.2 1.1 7.6-4.6 1.2 1.8 2.3 4.1 2.1 2.7 6 2.1 1.7 1.4-0.9 2.6 2.6-1.5 2 1.1 2.8-1.3 0.8-1.6-0.5-2.9 2.8 1.6 4.1-5.5 3-2.9 2.9-1.8 0.2 0.5 2-3.8 9.9-1.4 1.3-1.4-1 1.5 0.5 1.7-6.5-2.4-2.8-3.4-1.7-1 0.6-2.5-0.6-2.4 1.7-3.7 0-6.8 2.8-5.4 5.3-1.4 4.1-0.6-1.4-1.2 1.2-0.1-2-3-2.7-7-0.1-8.9 1.4-7.3 4.1-7.8 8.3-7.6 4.1-6.2 6.4-5.6 9.1-0.8-0.5 4.3-6 0.2-2-1.9 1.8-2.4-1-0.5-1.8 1.4-5.2-3.9-2-1.4-4-1.2 1.5 2.4 5.9 0 1.9-5.8 8.2-2-0.4-0.9-3.9 0.4-2.9-1.7-6.5-3.8-1.2-2-1.6-3.9 0 0.7-2.5-0.5-0.9-5.3-0.4-2.2-3.9 1.2-3.1-0.6-2.3-5.7-2.1 0.2-2.2 2.7-0.5 1.9-1.8 1.7-5.5 2.4-1 0.3-1.2-0.7-2.3-2.4-1.4-1-3.4-6.3-2.6-0.9-3.2-1.7-0.8-1.2-7.4-1.7-1.1-0.6-2.3-0.4-6.6 0.7-2-1.6-2.5 1.6-3.2-4.7 0.5-1.9 3.1-1.7-0.7-3.1 0.7-5.2-16.9 13.4-3.6 8.2-3.8 13.2 3.6 3.6 0.2 1-0.7 0.8-3.2-1.9-2.2 2.7-12.3-3.1-0.9 0.7-6-5.2-3.9 0.7-2.4 1.8-1.5 3-0.8 0.6-1.4-0.5-1.3-2.9-0.9-0.8-2.4-1.6-0.7 1.5-2.1 0.4-3-0.7-2.2 0.9-1.6 1.1 0.3 0.8 3.2 3.2 0 4.1-3 4.7-1 3.5 0.8 4.9-0.9 4.8 2.2 9.5 2 1.9-0.4 3.2-2.7 3.9-0.8 3.2 2.5 3 0.7 1.7 1.8 7.5-2.1 1 0.6 0.2 4.6 3.9-1.2-1.3 3.2 1.9 1.2 0.2 3.2 1.5 1.1 1.7-0.1-1 5.5-2.2 0.2 2.2 2.9 3.4-0.4 1.8-1.9 0.8 0.2 0.4 2.5 4 1.4 1.7-0.1 2.4-2.1 1.7 1.2z"/>
          <path class="reg" id="uaw-r-kyiv-city" data-r="kyiv-city" data-cx="467.3" data-cy="174.7" d="M483.2 159.8l-3.7 3.4-1.4 3.3 1 1.6-0.5 4.2 3.1 4.8 0.1 1.5 1.6 1.2-0.9 1.8-2.2 0 0.1 3.5-2.1 0.3-1.7-1.8-0.3 4.1-3.9 0.1-0.3-1.2-2 0.7 2.7 9.6-0.8 2.8-1.1 0.1 1.5 7.7-3.4 1.7-1-6.7-1.5-0.5-0.3-4.2-1.4 0 0.6-3.8-1.5-1.3-1 0.4-1.7-5.5-1.9 0.2 0.1-3.7-4.5-5.6-0.7-3.4-4.5-0.6-0.8 2.8-0.9-0.2-0.6 0.9-0.6-1.1 1.8-13.5 2.3-2.1-0.5-3 1-0.6 1 1.6 0.3-1.7-1.2-2.1 3.5-0.4 0-2.2 5.5 0 0.3 2.5 1.3 0.3 0.8 3 4 4.1-0.5-2 0.7-0.8 5.3 0.5 0.9-2.4 3-1.8-0.1-2.5 1.2-1.4 5.4 2.6z"/>
          <path class="reg" id="uaw-r-kherson" data-r="kherson" data-cx="647.5" data-cy="477.2" d="M582.7 537l7.9 1 5.5-0.7 1.7 1.4 3.7-1.2 1.1 1.4 2.5-0.2 0.7 1-1 1.1zM728 520.9l0.8 0.5-6.5 10.1-8.9 4.4-1-0.4 1.9-2.8 1.9-1.2-0.4-1.1 8.7-3.3zM555.7 529.3l-23-5.2-8.7-3.4-3.2-4-1-4.8 1 0.4 1.8 5.8 3.5 2.9 25.1 6.2zM669.3 422.2l5.2 16.9 3.1-0.7 1.7 0.7 1.9-3.1 4.7-0.5-1.6 3.2 1.6 2.5-0.7 2 0.4 6.6 0.6 2.3 1.7 1.1 1.2 7.4 1.7 0.8 0.9 3.2 6.3 2.6 1.3 3.9 2.1 0.9 0.4 1 0.2 2.3-2.6 1.2-1.3 5-2.3 2.3-2.5 0.3-0.4 2.4 5.7 2.1 0.6 2.3-1.2 3.1 2.2 3.9 5.3 0.4 0.5 0.9-0.7 2.5 3.9 0 6.1 3.5 1.4 5.8 0 6.3 2.5 0.9-4.1 3.4-5.8 1.4-1.2-1.7-0.6 0.3-0.7 2.4-2.4 1.2-1.5 3.3 0.7 7 2.8 12.1 7.1 15.7-1.4 0.9-5.2-10.8-1 0.3-1.1 2.3-1.9 0.2 0.8-6.1 1.2-1.4-1.8-1.8-1.1-7.5-1.3-0.5-1 1.9-5.1-6 3.4-1.8 1.3 0.1 1.6 1.7 0.7-0.6-0.9-3.8-1.6-1.6-2.5-1.5-2.5-0.3-1.8 1.8 0.8 6.2-3.2 7-1.2 1.1-2.2-0.9-1.8 2.2-1.1-0.3 0.6-1.8-0.6-0.8-3.4-0.7 1.5-2.7 1.8 0.9 0.5-0.9-1.7-2.2 0.5-2.8 2.6-1.5-0.1 2.6 1.7-2.7 1.6 3.4 1-2.8-0.1-3.9-2-1.7-0.9 2.3-1.8 1.3-2-0.5-7.6-5-1.1 1.9 2.2 1.1 0 1.1-1.3 4.9-0.8-4.2-3.1-6.4-1.3-2.1-2.8-1.8-0.8 1.9 0.3 3.2 2.7 2.9-2.4 2.9-0.3-3.5-1-1.4-1.7 1.8-1.5-0.4 2.5 2.1 0.8 3.2-2.9-0.3-1-1.8-1.8 1.2-3.4-6-4.4-1.6-3.9 0.5-1.7-1.6-2-0.1-2.3 2.1-2.6-0.3 0.2 4-2.4 3.9-1.7-2.5-3.6 2.7-0.1 1.2 1.5 1.6-2.9 0.5 0.1 2.7-4.6-0.5-3.7-4-1.4-0.3-1.2 1.6-1.1-0.6 1.4-2.9-5.6 0.2 1.1-7.6-3.3 5.6-2.9 1.4-5.5-2.7 0.5 2.3-0.8 1.1-5.8 1-8.1-1.7-2.9 1.3-7 1.2-2.4 1.9-2.3 0.4-13.3-4.2-1.1-3.9 1.5-2.2-3.1 0.9-4.7-1.3-4.4-4.5-1.7 0.7-7.4-5-0.1 3.2-4.5-0.4-1.6-1.5 0.4-2.3 2-1.3 4.2 0.6 4.2-0.8 3.4-3.1 1.8-0.4-3-4.4-5.4-0.6-5.2-2.1 2-3.2 10 1.3 4.4-0.5 6 1.4 5.3 2.5 2.5-0.2 3.6-2.6-1-1.5 1.5-2.1 4.9-4 3.5-0.9 3.2-3.7-13.1 6.5-4 0.6-3.7-2.1-1.2-1.6-1.5 1.4-2.8 0.8-1.3 1.6-1.6-3.7-6-2.7-2.4-7 2.8 0.1 3.1-1.7 2.2 0.9 2.3-0.5 1.4-0.7 2.7-4.6 6.8 0.9 2.1-3.5 3.4-0.6 1.1 1.3 2.9-0.2 1.1-3.3 5.4 1.2 3.8 2.9 6.3-0.3 6.6-2.8-6.4-0.5-1.1-1.2 6-1.4 1.7-1.6 3.6-1.3-0.1-1-3-0.7-0.2-2.4 1.3-1.1 2.8 2.4 2-3.7-2.6-2.9-3.2-1.9-1.7 0-0.6-2.3 3.4-6.8 3.3 0.7 2.7-2.5 2.3 0.3 0.6-1.6-1.8-3.9 0.9-6.3-1.3-2.9-3-0.4-0.9-1.3 1.8-3.8 1.4 3 2.5-0.6-0.6-8.3-1.6-2 0-2.8 11.3 3.9 0.7 2 1.8 1.3 1.7-1.7 6.4-1.4 0.5-2.6 3.8-0.9 1.4 1.3-0.7 1.8 0.5 1.9 2.2 0.2 1.7 2.1 13.7-2.3 8.6 2.8z"/>
          <path class="reg" id="uaw-r-sevastopol" data-r="sevastopol" data-cx="642.2" data-cy="661.3" d="M643 667.7l-5.4-2.8-0.6-2.2-2.3-2.7-3.4 0.5-8.1-6.7 0-0.9 1.9-0.1 1.7-1.2 7.5-1.2-2.6-0.6-0.6-1.6 1.9-3.9-1.8-6.7 3-5.3 0.6 2.6 2 0.2 3.2 2 0.8 2.9-4.3 2.6 0.7 4.6 4.7-0.4 2.3 3.3-2.1 3.3 0.9 2.2 2.2-0.2 0.5 1.9 1.5 0.4 2.6 7.4-3.7 0.5-1.1 1.5z"/>
        </g>
          <g class="rgs"></g>
          <g class="layer homes"></g>
          <g class="layer place"></g>
          <g class="layer trails"></g>
          <g class="layer ricons"></g>
          <g class="layer tracks"></g>
        </svg>
        <div class="msg"><b class="m1">Loading…</b><span class="m2"></span></div>
      </div>
      <div class="side">
        <div class="grid">
          <div class="cell c-drone z" data-c="drone"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-drone"/></svg><span class="n">0</span></div>
          <div class="cell c-missile z" data-c="missile"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-cruise"/></svg><span class="n">0</span></div>
          <div class="cell c-tact z" data-c="tact"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-fighter"/></svg><span class="n">0</span></div>
          <div class="cell c-strat z" data-c="strat"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-bomber"/></svg><span class="n">0</span></div>
          <div class="cell c-ad z" data-c="ad"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-shield"/></svg><span class="n">0</span></div>
          <div class="cell c-other z" data-c="other"><svg class="ic" viewBox="-13 -13 26 26"><use href="#uaw-i-diamond"/></svg><span class="n">0</span></div>
        </div>
        <div class="pcard"></div>
      </div>
    </div>
    <div class="ticker" data-act="panel" data-val="history"><span class="tk-src"><i></i><span class="tk-name">NEPTUN</span></span><div class="tk-view"><div class="tk-track"></div></div></div>
    <div class="panel"></div>
    <div class="legal"></div>
  </div>
</div>
`;
},

update: function (output, domEl) {
  var app = domEl.__uaw;
  // render() міг перемалювати DOM (гаряче перезавантаження) — тоді старий екземпляр тримає відʼєднані вузли
  if (app && !domEl.contains(app.root)) { app = domEl.__uaw = null; }
  if (!domEl.__run && typeof this.run === 'function') { domEl.__run = this.run.bind(this); }
  if (!app) { app = domEl.__uaw = this.createApp(domEl); }
  app.onOutput(String(output == null ? '' : output));
},

// =============================================================================
// Уся логіка — у замиканні. У глобальній області лишається лише один таймер
// (window.__uawTimer), який очищується при перезавантаженні віджета.
// =============================================================================
createApp: function (domEl) {
  'use strict';
  var DEFAULTS = this.config;
  var NS = 'http://www.w3.org/2000/svg';
  var SKEY = 'uaw.settings.v3', HKEY = 'uaw.history.v1', RKEY = 'uaw.raions.v1';
  var NOT_UI = { extrapolateMaxSec: 1, staleAfterSec: 1, offlineAfterSec: 1 };
  var UI_KEYS = Object.keys(DEFAULTS).filter(function (k) { return !NOT_UI[k]; });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function now_() { return Date.now(); }

  // --------------------------------------------------------------------- налаштування
  var S = clone(DEFAULTS);
  (function loadSaved() {
    try {
      var saved = JSON.parse(localStorage.getItem(SKEY) || 'null');
      if (!saved) return;
      UI_KEYS.forEach(function (k) {
        if (!(k in saved)) return;
        if (k === 'cats') S.cats = Object.assign({}, S.cats, saved.cats); else S[k] = saved[k];
      });
    } catch (e) { /* localStorage недоступний — працюємо зі стартовими значеннями */ }
  })();
  function persist() {
    try { var o = {}; UI_KEYS.forEach(function (k) { o[k] = S[k]; }); localStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) { }
  }

  // --------------------------------------------------------------------- довідники
  // [uk, en, кількість районів — щоб відрізнити «повну» тривогу від часткової за даними NEPTUN]
  var REG = {
    'crimea': ['АР Крим', 'Crimea', 0], 'vinnytsia': ['Вінницька обл.', 'Vinnytsia', 6], 'volyn': ['Волинська обл.', 'Volyn', 4],
    'dnipro': ['Дніпропетровська обл.', 'Dnipropetrovsk', 7], 'donetsk': ['Донецька обл.', 'Donetsk', 8],
    'zhytomyr': ['Житомирська обл.', 'Zhytomyr', 4], 'zakarpattia': ['Закарпатська обл.', 'Zakarpattia', 6],
    'zaporizhzhia': ['Запорізька обл.', 'Zaporizhzhia', 5], 'ivano-frankivsk': ['Івано-Франківська обл.', 'Ivano-Frankivsk', 6],
    'kyiv-oblast': ['Київська обл.', 'Kyiv Oblast', 7], 'kyiv-city': ['м. Київ', 'Kyiv city', 0],
    'kirovohrad': ['Кіровоградська обл.', 'Kirovohrad', 4], 'luhansk': ['Луганська обл.', 'Luhansk', 8],
    'lviv': ['Львівська обл.', 'Lviv', 7], 'mykolaiv': ['Миколаївська обл.', 'Mykolaiv', 4], 'odesa': ['Одеська обл.', 'Odesa', 7],
    'poltava': ['Полтавська обл.', 'Poltava', 4], 'rivne': ['Рівненська обл.', 'Rivne', 4], 'sevastopol': ['м. Севастополь', 'Sevastopol', 0],
    'sumy': ['Сумська обл.', 'Sumy', 5], 'ternopil': ['Тернопільська обл.', 'Ternopil', 3], 'kharkiv': ['Харківська обл.', 'Kharkiv', 7],
    'kherson': ['Херсонська обл.', 'Kherson', 5], 'khmelnytskyi': ['Хмельницька обл.', 'Khmelnytskyi', 3],
    'cherkasy': ['Черкаська обл.', 'Cherkasy', 4], 'chernivtsi': ['Чернівецька обл.', 'Chernivtsi', 3], 'chernihiv': ['Чернігівська обл.', 'Chernihiv', 5]
  };
  var REG_ORDER = Object.keys(REG).sort(function (a, b) { return REG[a][1].localeCompare(REG[b][1]); });
  var AIU_UID = { 3: 'khmelnytskyi', 4: 'vinnytsia', 5: 'rivne', 8: 'volyn', 9: 'dnipro', 10: 'zhytomyr', 11: 'zakarpattia', 12: 'zaporizhzhia',
    13: 'ivano-frankivsk', 14: 'kyiv-oblast', 15: 'kirovohrad', 16: 'luhansk', 17: 'mykolaiv', 18: 'odesa', 19: 'poltava', 20: 'sumy',
    21: 'ternopil', 22: 'kharkiv', 23: 'kherson', 24: 'cherkasy', 25: 'chernihiv', 26: 'chernivtsi', 27: 'lviv', 28: 'donetsk',
    29: 'crimea', 30: 'sevastopol', 31: 'kyiv-city' };
  var NAME_RULES = [
    [/севастопол|sevastopol/, 'sevastopol'], [/крим|krym|crimea/, 'crimea'],
    [/^(м\.?|місто)?\s*київ$|^kyiv(\s+city)?$|^kiev$|m-kiyiv/, 'kyiv-city'],
    [/київськ|київщин|kyiv\s*obl|kyivska|kiyivska|kiivska/, 'kyiv-oblast'],
    [/вінниц|vinnyts|vinnits/, 'vinnytsia'], [/волин|volyn|volin/, 'volyn'], [/дніпропетр|дніпро|dnipro|dnepr/, 'dnipro'],
    [/донецьк|donet|donec/, 'donetsk'], [/житомир|zhytomyr|zitomir/, 'zhytomyr'], [/закарпат|zakarpat/, 'zakarpattia'],
    [/запоріз|zaporiz|zaporizh/, 'zaporizhzhia'], [/івано|ivano/, 'ivano-frankivsk'],
    [/кіровоград|кропивниц|kirovohrad|kropyvnyts|kirovograd/, 'kirovohrad'], [/луганськ|luhan|lugan/, 'luhansk'],
    [/львів|lviv|lvov/, 'lviv'], [/миколаїв|mykolai|mikolay|nikolaev/, 'mykolaiv'], [/одес|odes/, 'odesa'],
    [/полтав|poltav/, 'poltava'], [/рівн|rivne|rivnen/, 'rivne'], [/сумськ|sumy|sumska/, 'sumy'],
    [/тернопіл|ternopil|ternopol/, 'ternopil'], [/харків|kharkiv|xarkiv|harkiv/, 'kharkiv'], [/херсон|kherson|xerson/, 'kherson'],
    [/хмельниц|khmelnyts|xmelnic|khmel/, 'khmelnytskyi'], [/черкас|cherkas|cerkas/, 'cherkasy'],
    [/чернівц|чернівец|chernivts|cernivec|chernivec/, 'chernivtsi'], [/чернігів|chernihiv|cernigiv/, 'chernihiv']
  ];
  function regionId(name, uid) {
    if (uid != null && AIU_UID[uid]) return AIU_UID[uid];
    var s = String(name == null ? '' : name).toLowerCase().replace(/[’ʼ`]/g, "'").trim();
    if (!s) return null;
    for (var i = 0; i < NAME_RULES.length; i++) if (NAME_RULES[i][0].test(s)) return NAME_RULES[i][1];
    return null;
  }
  // Райони: «Одеський район» ≈ «одеський» (ключі в geojson і в /alerts у NEPTUN не збігаються — зіставляємо за назвою)
  function normRaion(n) {
    return String(n == null ? '' : n).toLowerCase().replace(/[’ʼ`]/g, "'").replace(/район|р-н|р\.|raion|rayon/g, '').replace(/[«»"'.]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Міста для «Моє місто» (центр міста; точність ~1–2 км достатня для радіусів 25–150 км)
  var CITIES = [
    ['Сімферополь', 'Simferopol', 44.95, 34.10, 'crimea'], ['Ялта', 'Yalta', 44.50, 34.17, 'crimea'], ['Керч', 'Kerch', 45.36, 36.47, 'crimea'],
    ['Вінниця', 'Vinnytsia', 49.23, 28.47, 'vinnytsia'], ['Жмеринка', 'Zhmerynka', 49.04, 28.11, 'vinnytsia'], ['Могилів-Подільський', 'Mohyliv-Podilskyi', 48.45, 27.80, 'vinnytsia'],
    ['Луцьк', 'Lutsk', 50.75, 25.33, 'volyn'], ['Ковель', 'Kovel', 51.22, 24.71, 'volyn'], ['Володимир', 'Volodymyr', 50.85, 24.32, 'volyn'],
    ['Дніпро', 'Dnipro', 48.46, 35.05, 'dnipro'], ['Кривий Ріг', 'Kryvyi Rih', 47.91, 33.39, 'dnipro'], ['Кам’янське', 'Kamianske', 48.51, 34.60, 'dnipro'],
    ['Нікополь', 'Nikopol', 47.57, 34.40, 'dnipro'], ['Павлоград', 'Pavlohrad', 48.52, 35.87, 'dnipro'],
    ['Краматорськ', 'Kramatorsk', 48.74, 37.58, 'donetsk'], ['Слов’янськ', 'Sloviansk', 48.87, 37.62, 'donetsk'], ['Покровськ', 'Pokrovsk', 48.28, 37.18, 'donetsk'], ['Маріуполь', 'Mariupol', 47.10, 37.54, 'donetsk'],
    ['Житомир', 'Zhytomyr', 50.25, 28.66, 'zhytomyr'], ['Бердичів', 'Berdychiv', 49.90, 28.60, 'zhytomyr'], ['Коростень', 'Korosten', 50.95, 28.64, 'zhytomyr'],
    ['Ужгород', 'Uzhhorod', 48.62, 22.29, 'zakarpattia'], ['Мукачево', 'Mukachevo', 48.44, 22.72, 'zakarpattia'],
    ['Запоріжжя', 'Zaporizhzhia', 47.84, 35.14, 'zaporizhzhia'], ['Мелітополь', 'Melitopol', 46.85, 35.37, 'zaporizhzhia'], ['Енергодар', 'Enerhodar', 47.50, 34.66, 'zaporizhzhia'],
    ['Івано-Франківськ', 'Ivano-Frankivsk', 48.92, 24.71, 'ivano-frankivsk'], ['Коломия', 'Kolomyia', 48.53, 25.04, 'ivano-frankivsk'], ['Калуш', 'Kalush', 49.05, 24.37, 'ivano-frankivsk'],
    ['Біла Церква', 'Bila Tserkva', 49.81, 30.11, 'kyiv-oblast'], ['Бровари', 'Brovary', 50.51, 30.79, 'kyiv-oblast'], ['Бориспіль', 'Boryspil', 50.35, 30.95, 'kyiv-oblast'],
    ['Буча', 'Bucha', 50.55, 30.22, 'kyiv-oblast'], ['Ірпінь', 'Irpin', 50.52, 30.25, 'kyiv-oblast'], ['Вишгород', 'Vyshhorod', 50.58, 30.49, 'kyiv-oblast'], ['Фастів', 'Fastiv', 50.08, 29.92, 'kyiv-oblast'],
    ['Київ', 'Kyiv', 50.45, 30.52, 'kyiv-city'],
    ['Кропивницький', 'Kropyvnytskyi', 48.51, 32.26, 'kirovohrad'], ['Олександрія', 'Oleksandriia', 48.67, 33.12, 'kirovohrad'],
    ['Луганськ', 'Luhansk', 48.57, 39.31, 'luhansk'], ['Сєвєродонецьк', 'Sievierodonetsk', 48.95, 38.49, 'luhansk'],
    ['Львів', 'Lviv', 49.84, 24.03, 'lviv'], ['Дрогобич', 'Drohobych', 49.35, 23.51, 'lviv'], ['Стрий', 'Stryi', 49.26, 23.86, 'lviv'], ['Червоноград', 'Chervonohrad', 50.38, 24.23, 'lviv'],
    ['Миколаїв', 'Mykolaiv', 46.98, 31.99, 'mykolaiv'], ['Первомайськ', 'Pervomaisk', 48.04, 30.85, 'mykolaiv'], ['Вознесенськ', 'Voznesensk', 47.57, 31.33, 'mykolaiv'], ['Очаків', 'Ochakiv', 46.61, 31.54, 'mykolaiv'],
    ['Одеса', 'Odesa', 46.48, 30.72, 'odesa'], ['Чорноморськ', 'Chornomorsk', 46.30, 30.65, 'odesa'], ['Ізмаїл', 'Izmail', 45.35, 28.84, 'odesa'], ['Білгород-Дністровський', 'Bilhorod-Dnistrovskyi', 46.19, 30.34, 'odesa'], ['Подільськ', 'Podilsk', 47.75, 29.53, 'odesa'],
    ['Полтава', 'Poltava', 49.59, 34.55, 'poltava'], ['Кременчук', 'Kremenchuk', 49.07, 33.42, 'poltava'], ['Миргород', 'Myrhorod', 49.97, 33.61, 'poltava'],
    ['Рівне', 'Rivne', 50.62, 26.25, 'rivne'], ['Дубно', 'Dubno', 50.40, 25.74, 'rivne'], ['Вараш', 'Varash', 51.35, 25.85, 'rivne'],
    ['Севастополь', 'Sevastopol', 44.62, 33.53, 'sevastopol'],
    ['Суми', 'Sumy', 50.91, 34.80, 'sumy'], ['Конотоп', 'Konotop', 51.24, 33.20, 'sumy'], ['Шостка', 'Shostka', 51.87, 33.48, 'sumy'], ['Охтирка', 'Okhtyrka', 50.31, 34.90, 'sumy'],
    ['Тернопіль', 'Ternopil', 49.55, 25.59, 'ternopil'], ['Чортків', 'Chortkiv', 49.02, 25.80, 'ternopil'], ['Кременець', 'Kremenets', 50.11, 25.73, 'ternopil'],
    ['Харків', 'Kharkiv', 49.99, 36.23, 'kharkiv'], ['Ізюм', 'Izium', 49.21, 37.27, 'kharkiv'], ['Куп’янськ', 'Kupiansk', 49.71, 37.62, 'kharkiv'], ['Лозова', 'Lozova', 48.89, 36.32, 'kharkiv'],
    ['Херсон', 'Kherson', 46.64, 32.62, 'kherson'],
    ['Хмельницький', 'Khmelnytskyi', 49.42, 26.99, 'khmelnytskyi'], ['Кам’янець-Подільський', 'Kamianets-Podilskyi', 48.68, 26.59, 'khmelnytskyi'], ['Шепетівка', 'Shepetivka', 50.18, 27.06, 'khmelnytskyi'],
    ['Черкаси', 'Cherkasy', 49.44, 32.06, 'cherkasy'], ['Умань', 'Uman', 48.75, 30.22, 'cherkasy'], ['Сміла', 'Smila', 49.22, 31.89, 'cherkasy'],
    ['Чернівці', 'Chernivtsi', 48.29, 25.94, 'chernivtsi'], ['Хотин', 'Khotyn', 48.51, 26.50, 'chernivtsi'],
    ['Чернігів', 'Chernihiv', 51.50, 31.29, 'chernihiv'], ['Ніжин', 'Nizhyn', 51.05, 31.89, 'chernihiv'], ['Прилуки', 'Pryluky', 50.59, 32.39, 'chernihiv'], ['Новгород-Сіверський', 'Novhorod-Siverskyi', 51.99, 33.26, 'chernihiv']
  ].map(function (c) { return { id: c[1].toLowerCase().replace(/[^a-z]+/g, '-'), uk: c[0], en: c[1], lat: c[2], lon: c[3], region: c[4] }; });
  function cityById(id) { for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i]; return null; }

  // Категорії: порядок = порядок у сітці лічильників
  var CATS = ['drone', 'missile', 'tact', 'strat', 'ad', 'other'];
  var CAT_NAME = {
    drone: ['БпЛА', 'Drones'], missile: ['Ракети', 'Missiles'], tact: ['Тактична авіація і КАБ', 'Tactical aviation and glide bombs'],
    strat: ['Стратегічна авіація', 'Strategic aviation'], ad: ['Робота ППО', 'Air defence active'], other: ['Інше / невідомо', 'Other / unknown']
  };
  var CAT_ICON = { drone: 'drone', missile: 'cruise', tact: 'fighter', strat: 'bomber', ad: 'shield', other: 'diamond' };
  var ROTATES = { drone: 1, recon: 1, cruise: 1, ballistic: 1, kab: 1, fighter: 1, bomber: 1 };
  var ICON_NAME = {
    drone: ['Шахед/БпЛА', 'Shahed / drone'], recon: ['Розвідувальний БпЛА', 'Recon drone'], cruise: ['Крилата ракета', 'Cruise missile'],
    ballistic: ['Балістична ракета', 'Ballistic missile'], kab: ['КАБ', 'Guided bomb'], fighter: ['Авіація', 'Aircraft'],
    bomber: ['Стратегічна авіація', 'Strategic bomber'], shield: ['ППО', 'Air defence'], diamond: ['Невідома ціль', 'Unknown target']
  };
  function mapType(t) {                        // тип NEPTUN → [категорія, силует]
    var s = String(t || '').toLowerCase();
    if (/ballist|kinzhal|iskander|zircon|tsirkon/.test(s)) return ['missile', 'ballistic'];
    if (/missile|cruise|kalibr|kh-?\d/.test(s)) return ['missile', 'cruise'];
    if (/kab|bomb/.test(s)) return ['tact', 'kab'];
    if (/mig|su-?\d|fighter|jet|tact/.test(s)) return ['tact', 'fighter'];
    if (/tu-?\d|bomber|strat/.test(s)) return ['strat', 'bomber'];
    if (/recon|orlan|zala|supercam/.test(s)) return ['drone', 'recon'];
    if (/uav|drone|shahed|geran|fpv|bpla/.test(s)) return ['drone', 'drone'];
    if (/air.?def|ppo/.test(s)) return ['ad', 'shield'];
    return ['other', 'diamond'];
  }
  var AIU_THREAT = {
    drones: ['drone', 'drone'], ballistic_missiles: ['missile', 'ballistic'], cruise_missiles: ['missile', 'cruise'],
    unspecified_missiles: ['missile', 'cruise'], guided_aerial_bombs: ['tact', 'kab'], tactic_aircraft_activity: ['tact', 'fighter'],
    mig31k_departure: ['tact', 'fighter'], strategic_aircraft_activity: ['strat', 'bomber'], air_defense: ['ad', 'shield'], unknown: ['other', 'diamond']
  };
  var PAL = {
    ember: { red: ['#FF5A4D', '#C4223A', '#580E24'], yellow: ['#EDC13A', '#A98717', '#5C4A12'] },
    classic: { red: ['#FF3B30', '#B3261E', '#5C1512'], yellow: ['#F5CD0A', '#A88A0A', '#574A08'] }
  };

  // --------------------------------------------------------------------- переклад
  var T = {
    en: {
      title: 'Ukraine Alert Map', asOf: 'as of', loading: 'Loading…', off: 'Data unavailable', offSub: 'Last update at {t}. Follow official alerts.',
      offNever: 'No response yet. Follow official alerts.',
      legal: 'Data: <a data-url="https://neptun.in.ua/" href="https://neptun.in.ua/">NEPTUN</a>, alerts.in.ua. Unofficial: follow sirens and official alerts.',
      history: 'History', settings: 'Settings', tDisplay: 'Display', tData: 'Data', tAlerts: 'Notify',
      lang: 'Language', appearance: 'Appearance', palette: 'Colors', darkest: 'Darkest after', targets: 'Targets', conf: 'Min. confidence',
      src: 'Alerts from', feed: 'Feed from', size: 'Size', home: 'My region', place: 'My place', regionOnly: 'Whole region', none: 'None',
      auto: 'Auto', dark: 'Dark', light: 'Light', ember: 'Ember', classic: 'Classic', any: 'Any', medium: 'Medium', high: 'High',
      tRegionThreats: 'Region-level threats', tDistricts: 'Districts', tPartial: 'Hatch partial alerts', tCourse: 'Course and trails',
      tAdvisory: 'Observations', tStale: 'Stale tracks', tCompact: 'Counters only', tTicker: 'Ticker', speed: 'Ticker speed',
      slow: 'Slow', normal: 'Normal', fast: 'Fast', keep: 'Keep history',
      fAll: 'All', fTargets: 'Targets', fAlerts: 'Alerts', fMsgs: 'Messages', clear: 'Clear', hEmpty: 'Nothing here yet.',
      hFoot: 'Stored on this Mac only.',
      nOn: 'Notifications', nAlert: 'Alert starts', nEnd: 'All clear', nNear: 'Targets near me', radius: 'Radius', nSound: 'Sound', nTest: 'Send test',
      nHint: 'If no banner appears: System Settings → Notifications → Script Editor → Allow.',
      reset: 'Reset', noToken: 'no token (optional)', ok: 'ok', error: 'error',
      calm: 'Calm', red: 'Air raid', yellow: 'Threat', regionsAlert: 'regions under alert', nRed: 'air raid', nYellow: 'threat',
      nearest: 'Nearest', nothingNear: 'No targets nearby', noData: 'No data', toYou: 'toward you', h: 'h', m: 'min', d: 'd', km: 'km',
      nStartRed: 'Air raid alert', nStartYellow: 'Threat reported', nStartRaion: 'Air raid in your district', nEndT: 'All clear',
      nNearT: 'Target near {p}', nRegT: 'Reported in {r}', nRaionT: 'Target in your district', testT: 'Test notification',
      testB: 'Notifications work.', eta: 'ETA ~{n} min', heading: 'heading {x}', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      alertStart: '{r}: air raid', alertThreat: '{r}: threat', alertEnd: '{r}: alert ended', tgtNew: '{t} — {l}', tickerEmpty: 'No recent messages'
    },
    uk: {
      title: 'Мапа тривог', asOf: 'станом на', loading: 'Завантаження…', off: 'Немає даних', offSub: 'Останнє оновлення о {t}. Орієнтуйтесь на офіційні оповіщення.',
      offNever: 'Відповіді ще немає. Орієнтуйтесь на офіційні оповіщення.',
      legal: 'Дані: <a data-url="https://neptun.in.ua/" href="https://neptun.in.ua/">NEPTUN</a>, alerts.in.ua. Неофіційно: слухайте сирени й офіційні оповіщення.',
      history: 'Історія', settings: 'Налаштування', tDisplay: 'Вигляд', tData: 'Дані', tAlerts: 'Сповіщення',
      lang: 'Мова', appearance: 'Тема', palette: 'Кольори', darkest: 'Найтемніший через', targets: 'Цілі', conf: 'Мін. достовірність',
      src: 'Тривоги з', feed: 'Стрічка з', size: 'Розмір', home: 'Моя область', place: 'Моє місто', regionOnly: 'Уся область', none: 'Немає',
      auto: 'Авто', dark: 'Темна', light: 'Світла', ember: 'Жар', classic: 'Класична', any: 'Будь-яка', medium: 'Середня', high: 'Висока',
      tRegionThreats: 'Загрози по областях', tDistricts: 'Райони', tPartial: 'Штрихувати часткові', tCourse: 'Курс і сліди',
      tAdvisory: 'Спостереження', tStale: 'Застарілі треки', tCompact: 'Лише лічильники', tTicker: 'Стрічка', speed: 'Швидкість стрічки',
      slow: 'Повільно', normal: 'Звичайно', fast: 'Швидко', keep: 'Зберігати історію',
      fAll: 'Усе', fTargets: 'Цілі', fAlerts: 'Тривоги', fMsgs: 'Повідомлення', clear: 'Очистити', hEmpty: 'Поки порожньо.',
      hFoot: 'Зберігається лише на цьому Mac.',
      nOn: 'Сповіщення', nAlert: 'Початок тривоги', nEnd: 'Відбій', nNear: 'Цілі поблизу', radius: 'Радіус', nSound: 'Звук', nTest: 'Надіслати тест',
      nHint: 'Немає банера: Системні налаштування → Сповіщення → Script Editor → Дозволити.',
      reset: 'Скинути', noToken: 'немає токена (необов’язково)', ok: 'ок', error: 'помилка',
      calm: 'Спокійно', red: 'Тривога', yellow: 'Загроза', regionsAlert: 'областей під тривогою', nRed: 'тривога', nYellow: 'загроза',
      nearest: 'Найближча', nothingNear: 'Поблизу цілей немає', noData: 'Немає даних', toYou: 'у ваш бік', h: 'год', m: 'хв', d: 'д', km: 'км',
      nStartRed: 'Повітряна тривога', nStartYellow: 'Загроза', nStartRaion: 'Тривога у вашому районі', nEndT: 'Відбій',
      nNearT: 'Ціль поблизу: {p}', nRegT: 'Повідомлення: {r}', nRaionT: 'Ціль у вашому районі', testT: 'Тестове сповіщення',
      testB: 'Сповіщення працюють.', eta: 'за ~{n} хв', heading: 'курс {x}', dirs: ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'],
      alertStart: '{r}: тривога', alertThreat: '{r}: загроза', alertEnd: '{r}: відбій', tgtNew: '{t} — {l}', tickerEmpty: 'Свіжих повідомлень немає'
    }
  };
  function tr(k, v) {
    var s = (T[S.lang] || T.en)[k]; if (s == null) s = T.en[k]; if (s == null) return k;
    if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  }
  function L2(pair) { return pair[S.lang === 'uk' ? 0 : 1]; }
  function catName(c) { return L2(CAT_NAME[c]); }
  function iconName(i) { return L2(ICON_NAME[i] || ICON_NAME.diamond); }
  function regName(id) { return REG[id] ? L2(REG[id]) : String(id); }
  function cityName(c) { return S.lang === 'uk' ? c.uk : c.en; }
  function dirName(deg) { return tr('dirs')[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // --------------------------------------------------------------------- геометрія
  // Калібровка lat/lon → SVG: проєкція Меркатора, підібрана за 45 містами та межами країни
  var PJ = { ax: 55.214, bx: -1224.667, ay: -3171.461, by: 3416.082 };
  var VB = { x: -8, y: -8, w: 1016, h: 686 };
  function project(lat, lon) {
    var m = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    return [PJ.bx + PJ.ax * lon, PJ.by + PJ.ay * m];
  }
  function rad(x) { return x * Math.PI / 180; }
  function destPoint(lat, lon, brg, km) {
    var R = 6371, d = km / R, b = rad(brg), p1 = rad(lat), l1 = rad(lon);
    var p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    var l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180];
  }
  function distKm(a, b, c, d) {
    var dl = rad(c - a), dn = rad(d - b), x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function bearing(a, b, c, d) {
    var y = Math.sin(rad(d - b)) * Math.cos(rad(c)), x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function predict(t, now) {                    // екстраполяція за курсом/швидкістю від останнього підтвердження
    var lat = t.lat, lon = t.lon, hdg = t.heading;
    if (t.speed > 0 && t.bearing != null && t.anchor) {
      var dt = Math.max(0, Math.min(now - t.anchor, S.extrapolateMaxSec * 1000));
      if (dt > 0) { var p = destPoint(lat, lon, t.bearing, t.speed * dt / 3.6e6); lat = p[0]; lon = p[1]; }
      if (hdg == null) hdg = t.bearing;
    }
    return { lat: lat, lon: lon, hdg: hdg };
  }
  function rdp(pts, eps) {                      // спрощення ламаної (Рамер–Дуглас–Пейкер)
    var n = pts.length; if (n < 3) return pts;
    var keep = new Uint8Array(n), stack = [[0, n - 1]]; keep[0] = keep[n - 1] = 1;
    while (stack.length) {
      var s = stack.pop(), a = pts[s[0]], b = pts[s[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), md = 0, mi = -1;
      for (var i = s[0] + 1; i < s[1]; i++) {
        var d = L ? Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / L : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; stack.push([s[0], mi], [mi, s[1]]); }
    }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  function pipRing(x, y, r) {                   // r — плоский масив [x0,y0,x1,y1,…]
    var inside = false;
    for (var i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      if ((r[i + 1] > y) !== (r[j + 1] > y) && x < (r[j] - r[i]) * (y - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) inside = !inside;
    }
    return inside;
  }
  function pipRings(x, y, rings) { var c = 0; rings.forEach(function (r) { if (pipRing(x, y, r)) c++; }); return c % 2 === 1; }

  // --------------------------------------------------------------------- колір за тривалістю
  function hex2rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mixStops(stops, t) {
    var x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i, a = hex2rgb(stops[i]), b = hex2rgb(stops[i + 1]);
    return 'rgba(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(',') + ',.93)';
  }
  // t = (хв / горизонт)^0.6: помітна різниця і за 10 хв, і за 3 години
  function alertColor(level, minutes) {
    var t = Math.max(0, Math.min(1, Math.pow(Math.max(0, minutes) / Math.max(1, S.darkestAfterMin), 0.6)));
    return mixStops((PAL[S.palette] || PAL.ember)[level], t);
  }

  // --------------------------------------------------------------------- розбір відповідей
  var D = { nt: null, na: null, nm: null, au: null, ok: { nt: 0, na: 0, nm: 0, au: 0 }, err: { nt: '', na: '', nm: '', au: '' }, hasToken: null, tried: 0 };
  function parseOutput(out) {
    var res = {}, re = /@@(\w+) (\w+)@@\r?\n/g, m, marks = [];
    while ((m = re.exec(out))) marks.push({ n: m[1], code: m[2], from: re.lastIndex, at: m.index });
    marks.forEach(function (k, i) { res[k.n] = { code: k.code, body: out.slice(k.from, i + 1 < marks.length ? marks[i + 1].at : out.length).trim() }; });
    return res;
  }
  function num(v) { v = typeof v === 'string' ? parseFloat(v) : v; return typeof v === 'number' && isFinite(v) ? v : null; }
  var CONF = { low: 0, medium: 1, high: 2 };

  function normTrail(t) {   // формат «trail» у документації не описано → приймаємо кілька варіантів, відкидаємо сміття
    if (!Array.isArray(t) || t.length < 2) return null;
    var pts = [];
    t.forEach(function (p) {
      var a, b;
      if (Array.isArray(p)) { a = num(p[0]); b = num(p[1]); }
      else if (p && typeof p === 'object') { a = num(p.lat != null ? p.lat : p.latitude); b = num(p.lon != null ? p.lon : (p.lng != null ? p.lng : p.longitude)); }
      if (a == null || b == null) return;
      if (a >= 22 && a <= 41 && b >= 44 && b <= 53) { var s = a; a = b; b = s; }   // [lon,lat] → [lat,lon]
      if (a >= 43 && a <= 54 && b >= 21 && b <= 42) pts.push([a, b]);
    });
    return pts.length > 1 ? pts : null;
  }
  function normThreat(t) {
    if (!t || t.status === 'resolved') return null;
    var mt = mapType(t.type), area = !!t.areaOnly, lat = num(t.lat), lon = num(t.lon), vel = t.velocity || {};
    return {
      id: String(t.id || (t.type + ':' + t.lat + ':' + t.lon)), cat: mt[0], icon: mt[1], region: regionId(t.region),
      lat: lat, lon: lon, hasPos: !area && lat != null && lon != null,
      heading: num(t.heading), bearing: num(vel.bearingDeg != null ? vel.bearingDeg : t.heading), speed: num(vel.speedKmh) || 0,
      anchor: Date.parse(t.confirmedAt || t.updatedAt) || 0,
      count: Math.max(1, num(t.count) || 1), status: t.status || 'active', advisory: !!t.advisory,
      conf: t.confidenceLevel in CONF ? CONF[t.confidenceLevel] : null, trail: normTrail(t.trail),
      exp: String(t.explanationShort || t.title || ''), loc: String(t.locality || t.district || '')
    };
  }
  function normThreats(j) {
    if (!j || !Array.isArray(j.threats)) return null;
    var list = []; j.threats.forEach(function (t) { var n = normThreat(t); if (n) list.push(n); });
    return { list: list, server: Date.parse(j.serverTime) || 0 };
  }
  function normMessages(j) {
    if (!j || !Array.isArray(j.messages)) return null;
    var list = [];
    j.messages.forEach(function (m) {
      if (!m || !m.text) return;
      var t = Date.parse(m.date); if (!t) return;
      list.push({ t: t, ch: String(m.channel || 'Telegram'), text: String(m.text) });
    });
    list.sort(function (a, b) { return b.t - a.t; });
    return { list: list };
  }
  function normNeptunAlerts(j) {
    if (!j || (!Array.isArray(j.raions) && !Array.isArray(j.oblasts))) return null;
    var by = {}, rl = [];
    function add(id, since, whole, key) {
      if (!id) return;
      var r = by[id] || (by[id] = { since: Infinity, whole: false, keys: {} }), ms = Date.parse(since);
      if (ms) r.since = Math.min(r.since, ms);
      if (whole) r.whole = true;
      r.keys[key || Math.random()] = 1;
    }
    (j.oblasts || []).forEach(function (o) { add(regionId(o.oblast || o.name) || regionId(o.key), o.since, true, o.key); });
    (j.raions || []).forEach(function (r) {
      var id = regionId(r.oblast) || regionId(String(r.key || '').split(':')[0]);
      add(id, r.since, false, r.key);
      rl.push({ norm: normRaion(r.name), name: String(r.name || ''), region: id, level: 'red', since: Date.parse(r.since) || 0 });
    });
    var out = {};
    Object.keys(by).forEach(function (id) {
      var r = by[id], total = REG[id] ? REG[id][2] : 0;
      out[id] = { level: 'red', since: isFinite(r.since) ? r.since : 0, full: r.whole || !total || Object.keys(r.keys).length >= total };
    });
    return { regions: out, rl: rl };
  }
  function normAiu(j) {
    if (!j || !Array.isArray(j.alerts)) return null;
    var acc = {}, threats = [], seen = {}, rl = [], feed = [];
    j.alerts.forEach(function (a) {
      if (a.finished_at || (a.alert_type && a.alert_type !== 'air_raid')) return;
      var id = regionId(a.location_oblast || a.location_title, a.location_oblast_uid != null ? a.location_oblast_uid : (a.location_type === 'oblast' ? a.location_uid : null));
      if (!id) return;
      var lvl = a.alert_level === 'yellow' ? 'yellow' : 'red', since = Date.parse(a.started_at) || 0;
      var whole = a.location_type === 'oblast' || id === 'kyiv-city' || id === 'sevastopol';
      var r = acc[id] || (acc[id] = {}), l = r[lvl] || (r[lvl] = { since: Infinity, full: false });
      if (since) l.since = Math.min(l.since, since);
      if (whole) l.full = true;
      var rn = a.location_type === 'raion' ? a.location_title : (a.location_raion || '');
      if (rn) rl.push({ norm: normRaion(rn), name: String(rn), region: id, level: lvl, since: since });
      feed.push({ t: since, region: id, level: lvl, kind: 'alert', notes: a.notes ? String(a.notes) : '' });
      (a.threats || []).forEach(function (th) {
        var m = AIU_THREAT[th.threat_type] || AIU_THREAT.unknown, key = id + '|' + m[0], tl = th.level === 'yellow' ? 'yellow' : 'red', ts = Date.parse(th.started_at) || since;
        feed.push({ t: ts, region: id, level: tl, kind: 'threat', icon: m[1], cat: m[0] });
        if (seen[key]) return; seen[key] = 1;
        threats.push({ region: id, cat: m[0], icon: m[1], level: tl, since: ts });
      });
    });
    var regions = {};
    Object.keys(acc).forEach(function (id) {
      var l = acc[id].red ? 'red' : 'yellow', x = acc[id][l];
      regions[id] = { level: l, since: isFinite(x.since) ? x.since : 0, full: x.full };
    });
    feed.sort(function (a, b) { return b.t - a.t; });
    return { regions: regions, threats: threats, rl: rl, feed: feed };
  }
  var NORM = { nt: normThreats, na: normNeptunAlerts, nm: normMessages, au: normAiu };

  var pendingRG = null;
  function ingest(out, now) {
    var sec = parseOutput(out); D.tried = now;
    ['nt', 'na', 'nm', 'au'].forEach(function (k) {
      var s = sec[k];
      if (!s) { D.err[k] = 'no output'; return; }
      if (k === 'au') { D.hasToken = s.code !== 'nokey'; if (!D.hasToken) { D.err.au = ''; D.au = null; D.ok.au = 0; return; } }   // токен прибрали — старі дані не тримаємо
      if (s.code !== '200') { D.err[k] = s.code === '000' ? 'offline' : s.code; return; }
      var j; try { j = JSON.parse(s.body); } catch (e) { D.err[k] = 'bad JSON'; return; }
      var n = NORM[k](j);
      if (!n) { D.err[k] = 'bad format'; return; }
      D[k] = n; D.ok[k] = now; D.err[k] = '';
    });
    if (sec.rg && sec.rg.code === '200' && sec.rg.body) pendingRG = sec.rg.body;
  }

  // --------------------------------------------------------------------- райони (межі з NEPTUN, кеш у localStorage)
  var RG = null, RGt = 0, rgDirty = true;
  function reindexRG(list) { var by = {}; list.forEach(function (g, i) { g.norm = normRaion(g.n); (by[g.norm] = by[g.norm] || []).push(i); }); return { list: list, by: by }; }
  (function loadRGCache() {
    try {
      var c = JSON.parse(localStorage.getItem(RKEY) || 'null');
      if (c && c.v === 1 && Array.isArray(c.list) && c.list.length > 2 && c.t > Date.now() - 14 * 864e5) { RG = reindexRG(c.list); RGt = c.t; }
    } catch (e) { }
  })();
  function buildRaions(geo) {
    var list = [];
    (geo.features || []).forEach(function (f) {
      if (!f || !f.geometry || !f.properties) return;
      var g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
      var rings = [], bb = [1e9, 1e9, -1e9, -1e9];
      polys.forEach(function (poly) {
        poly.forEach(function (ring) {
          var pts = rdp(ring.map(function (c) { return project(c[1], c[0]); }), 0.45);   // [lon,lat] → SVG
          if (pts.length < 3) return;
          var flat = [];
          pts.forEach(function (p) {
            var x = Math.round(p[0] * 10) / 10, y = Math.round(p[1] * 10) / 10; flat.push(x, y);
            if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
          });
          rings.push(flat);
        });
      });
      if (rings.length) list.push({ n: String(f.properties.rayon || f.properties.name || ''), k: String(f.properties.key || ''), r: rings, bb: bb });
    });
    return list;
  }
  function gunzipB64(b64) {
    var bin = atob(b64.replace(/\s+/g, '')), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function loadRaions(b64) {
    var job; try { job = gunzipB64(b64); } catch (e) { console.log('[uaw] raions (no DecompressionStream?)', e && e.message ? e.message : e); return; }   // не зривати оновлення
    job.then(function (txt) {
      var list = buildRaions(JSON.parse(txt));
      if (list.length < 3) throw new Error('raions: too few features');
      RG = reindexRG(list); RGt = Date.now(); rgDirty = true; myR.key = '';
      try { localStorage.setItem(RKEY, JSON.stringify({ v: 1, t: RGt, list: list.map(function (g) { return { n: g.n, k: g.k, r: g.r, bb: g.bb }; }) })); } catch (e) { }
      if (api.fullRedraw) api.fullRedraw();
    }).catch(function (e) { console.log('[uaw] raions', e && e.message ? e.message : e); });
  }
  var myR = { key: '', idx: -1 };
  function placeObj() { var c = S.place && cityById(S.place); return c ? { id: c.id, name: cityName(c), lat: c.lat, lon: c.lon, region: c.region } : null; }
  function homeId() { var c = S.place && cityById(S.place); return c ? c.region : S.home; }
  function myRaion() {            // індекс району, у якому лежить «моє місто» (або -1)
    var P = placeObj(); if (!P || !RG) return -1;
    var key = P.id + ':' + RG.list.length; if (myR.key === key) return myR.idx;
    var xy = project(P.lat, P.lon), idx = -1;
    for (var i = 0; i < RG.list.length && idx < 0; i++) {
      var b = RG.list[i].bb;
      if (xy[0] >= b[0] && xy[0] <= b[2] && xy[1] >= b[1] && xy[1] <= b[3] && pipRings(xy[0], xy[1], RG.list[i].r)) idx = i;
    }
    myR = { key: key, idx: idx }; return idx;
  }

  // --------------------------------------------------------------------- модель вигляду
  function fresh(k, now) { return D[k] && (now - D.ok[k]) < S.offlineAfterSec * 1000; }
  function dataState(now) {
    var last = Math.max(D.ok.nt, D.ok.na, D.ok.au);
    if (!last) return D.tried ? 'off' : 'loading';
    var age = now - last;
    if (age > S.offlineAfterSec * 1000) return 'off';
    if (age > S.staleAfterSec * 1000) return 'stale';
    return ['nt', 'na'].concat(D.hasToken ? ['au'] : []).some(function (k) { return D.err[k]; }) ? 'warn' : 'live';
  }
  var MARGIN = { x0: -70, x1: 1080, y0: -50, y1: 720 };
  function buildModel(now) {
    var M = { state: dataState(now), counts: {}, tracks: [], approx: [], regions: {}, rl: {}, asOf: 0, nearest: null, alertsFrom: null };
    CATS.forEach(function (c) { M.counts[c] = 0; });
    M.asOf = Math.max(D.nt ? (D.nt.server || D.ok.nt) : 0, D.na ? D.ok.na : 0, D.au ? D.ok.au : 0);
    if (M.state === 'off' || M.state === 'loading') return M;
    var pick = null;
    if (S.alertsSource === 'aiu') pick = fresh('au', now) ? 'au' : null;
    else if (S.alertsSource === 'neptun') pick = fresh('na', now) ? 'na' : null;
    else pick = fresh('au', now) ? 'au' : (fresh('na', now) ? 'na' : null);
    if (pick) {
      M.regions = D[pick].regions; M.alertsFrom = pick;
      D[pick].rl.forEach(function (r) {
        var o = M.rl[r.norm];
        if (!o || (r.level === 'red' && o.level !== 'red') || (r.level === o.level && r.since < o.since)) M.rl[r.norm] = { level: r.level, since: r.since, region: r.region, name: r.name };
      });
    }
    var have = {};
    if (fresh('nt', now)) {
      D.nt.list.forEach(function (t) {
        if (!S.cats[t.cat]) return;
        if (t.status === 'stale' && !S.stale) return;
        if (t.advisory && !S.advisory) return;
        if (t.conf != null && t.conf < S.minConfidence) return;
        M.counts[t.cat] += t.count;
        if (t.region) have[t.region + '|' + t.cat] = 1;
        if (t.hasPos) M.tracks.push(t);
        else if (t.region) M.approx.push({ region: t.region, cat: t.cat, icon: t.icon, n: t.count, advisory: t.advisory, key: 'nt:' + t.id });
      });
    }
    if (S.regionThreats && fresh('au', now)) {      // загрози «по області» — лише там, де NEPTUN нічого не показав
      D.au.threats.forEach(function (th) {
        if (!S.cats[th.cat] || have[th.region + '|' + th.cat]) return;
        M.counts[th.cat] += 1;
        M.approx.push({ region: th.region, cat: th.cat, icon: th.icon, n: 1, key: 'au:' + th.region + th.cat });
      });
    }
    var P = placeObj();
    if (P) {
      M.tracks.forEach(function (t) {
        if (t.advisory || t.status === 'stale') return;
        var p = predict(t, now), d = distKm(P.lat, P.lon, p.lat, p.lon);
        if (!M.nearest || d < M.nearest.d) M.nearest = { t: t, d: d, brg: bearing(P.lat, P.lon, p.lat, p.lon), hdg: p.hdg };
      });
    }
    return M;
  }

  // --------------------------------------------------------------------- стрічка
  function cleanText(s, n) { s = String(s).replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function feedSource(now) {
    var nm = fresh('nm', now) && D.nm.list.length, au = fresh('au', now) && D.au.feed.length;
    if (S.feedSource === 'neptun') return nm ? 'nm' : null;
    if (S.feedSource === 'aiu') return au ? 'au' : null;
    return nm ? 'nm' : (au ? 'au' : null);
  }
  function aiuLine(f) {
    var r = regName(f.region);
    if (f.kind === 'threat') return r + ': ' + iconName(f.icon) + ' (' + tr(f.level === 'yellow' ? 'yellow' : 'red').toLowerCase() + ')';
    return tr(f.level === 'yellow' ? 'alertThreat' : 'alertStart', { r: r }) + (f.notes ? ' — ' + cleanText(f.notes, 80) : '');
  }
  function feedItems(now) {
    var src = feedSource(now), items = [];
    if (src === 'nm') D.nm.list.forEach(function (m) { items.push({ t: m.t, ch: m.ch, text: cleanText(m.text, 150) }); });
    else if (src === 'au') D.au.feed.forEach(function (f) { items.push({ t: f.t, ch: 'alerts.in.ua', text: aiuLine(f) }); });
    return { src: src, items: items };
  }

  // --------------------------------------------------------------------- історія (зберігається в localStorage)
  var HIST = [], hIds = {}, hDirty = false;
  try { HIST = JSON.parse(localStorage.getItem(HKEY) || '[]'); if (!Array.isArray(HIST)) HIST = []; } catch (e) { HIST = []; }
  HIST.forEach(function (e) { hIds[e.id] = 1; });
  function hAdd(e) { if (hIds[e.id]) return false; hIds[e.id] = 1; HIST.push(e); hDirty = true; return true; }
  function hhash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function hFlush(now) {
    var cut = now - S.historyHours * 3600e3, n = HIST.length;
    HIST = HIST.filter(function (e) { return e.t >= cut; });
    HIST.sort(function (a, b) { return b.t - a.t; });
    if (HIST.length > 500) HIST.length = 500;
    if (HIST.length !== n) { hDirty = true; hIds = {}; HIST.forEach(function (e) { hIds[e.id] = 1; }); }
    if (hDirty) { try { localStorage.setItem(HKEY, JSON.stringify(HIST)); hDirty = false; } catch (e) { } }
  }
  var RS = { prev: null, miss: {} };      // стан областей між оновленнями (для подій «початок/відбій»)
  function diffRegions(M) {
    var ev = [];
    if (!M.alertsFrom) return ev;
    if (!RS.prev) { RS.prev = {}; Object.keys(M.regions).forEach(function (id) { RS.prev[id] = M.regions[id].level; }); return ev; }
    Object.keys(M.regions).forEach(function (id) {
      var n = M.regions[id], o = RS.prev[id]; RS.miss[id] = 0;
      if (!o) ev.push({ id: id, kind: 'start', level: n.level, since: n.since });
      else if (o === 'yellow' && n.level === 'red') ev.push({ id: id, kind: 'start', level: 'red', since: n.since });
      RS.prev[id] = n.level;
    });
    Object.keys(RS.prev).forEach(function (id) {
      if (M.regions[id]) return;
      RS.miss[id] = (RS.miss[id] || 0) + 1;
      if (RS.miss[id] >= 2) { ev.push({ id: id, kind: 'end' }); delete RS.prev[id]; delete RS.miss[id]; }   // відбій — лише після двох опитувань
    });
    return ev;
  }
  function logEvents(M, now, ev) {
    if (M.state === 'off' || M.state === 'loading') return;
    if (fresh('nt', now)) D.nt.list.forEach(function (t) {
      hAdd({ id: 't:' + t.id, t: now, k: 'tgt', cat: t.cat, icon: t.icon, n: t.count, region: t.region || '', adv: t.advisory ? 1 : 0,
             text: t.exp || tr('tgtNew', { t: iconName(t.icon), l: t.loc || regName(t.region) }) });
    });
    var f = feedItems(now);
    if (f.src === 'nm') D.nm.list.forEach(function (m) { hAdd({ id: 'm:' + hhash(m.ch + m.t + m.text.slice(0, 80)), t: m.t, k: 'msg', ch: m.ch, text: cleanText(m.text, 300) }); });
    if (f.src === 'au' && D.au) D.au.feed.forEach(function (x) { if (x.kind === 'threat') hAdd({ id: 'u:' + x.region + ':' + x.icon + ':' + x.t, t: x.t || now, k: 'tgt', cat: x.cat, icon: x.icon, n: 1, region: x.region, text: aiuLine(x) }); });
    ev.forEach(function (e) {
      hAdd({ id: 'a:' + e.id + ':' + e.kind + ':' + e.level + ':' + Math.floor((e.since || now) / 60000), t: e.kind === 'end' ? now : (e.since || now), k: 'alert', lv: e.kind === 'end' ? 'end' : e.level, region: e.id });
    });
    hFlush(now);
  }

  // --------------------------------------------------------------------- сповіщення
  var N = { primed: false, tr: {}, raion: undefined };
  function run(cmd) { try { if (typeof domEl.__run === 'function') domEl.__run(cmd, function () { }); } catch (e) { } }
  function asq(s) { return String(s).replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
  function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  var ui = { panel: '', tab: 'display', hf: 'all', banner: null };
  var bannerTimer = 0;
  function deliver(title, body, sound) {
    ui.banner = { title: title, body: body };
    clearTimeout(bannerTimer); bannerTimer = setTimeout(function () { ui.banner = null; if (api.drawBanner) api.drawBanner(); }, 25000);
    if (api.drawBanner) api.drawBanner();
    if (typeof domEl.__run === 'function') run('/usr/bin/osascript -e ' + shq('display notification "' + asq(body) + '" with title "' + asq(title) + '"' + (sound && S.nSound ? ' sound name "Sosumi"' : '')));
    else try { if (window.Notification && Notification.permission === 'granted') new Notification(title, { body: body }); else if (window.Notification) Notification.requestPermission(); } catch (e) { }   // запасний шлях; банер у віджеті є завжди
  }
  function evaluateNotify(M, now, ev) {
    if (M.state === 'off' || M.state === 'loading') return;
    var P = placeObj(), home = homeId(), msgs = [], rIdx = myRaion(), rLv = 'none', rName = '';
    if (P && RG && rIdx >= 0) {
      var rg = RG.list[rIdx], ra = M.rl[rg.norm], st = M.regions[home]; rName = rg.n;
      rLv = ra ? ra.level : (st && st.full ? st.level : 'none');
    }
    var regRed = false;
    ev.forEach(function (e) {
      if (!home || e.id !== home) return;
      if (e.kind === 'end') { if (S.nEnd) msgs.push({ title: tr('nEndT'), body: regName(home) + (P ? ' — ' + P.name : '') }); }
      else if (S.nAlert) {
        if (e.level === 'red') regRed = true;
        msgs.push({ title: tr(e.level === 'red' ? 'nStartRed' : 'nStartYellow'), body: regName(home) + (P ? ' — ' + P.name : ''), sound: e.level === 'red' });
      }
    });
    if (rIdx >= 0) {
      if (N.raion !== undefined && N.raion === 'none' && rLv === 'red' && S.nAlert && !regRed) msgs.push({ title: tr('nStartRaion'), body: rName, sound: true });
      N.raion = rLv;
    } else N.raion = undefined;
    var seen = {};
    if (S.nNear && P) {
      M.tracks.forEach(function (t) {
        if (t.advisory || t.status === 'stale') return;
        seen[t.id] = 1;
        var p = predict(t, now), d = distKm(P.lat, P.lon, p.lat, p.lon), rec = N.tr[t.id] || (N.tr[t.id] = { tier: 0, d: null, inR: false, miss: 0 });
        var mult = t.icon === 'ballistic' ? 3 : (t.icon === 'cruise' ? 2 : 1), R = S.nRadius * mult;
        var brg = bearing(p.lat, p.lon, P.lat, P.lon), closing = p.hdg != null ? angDiff(brg, p.hdg) <= 70 : (rec.d != null && d < rec.d - 0.5);
        var tier = d <= R / 3 ? 2 : (d <= R ? 1 : 0), pushed = false;
        if (tier > rec.tier && (closing || tier === 2)) {
          rec.tier = tier; pushed = true;
          var eta = t.speed > 0 ? Math.max(1, Math.round(d / t.speed * 60)) : 0;
          msgs.push({ title: tr('nNearT', { p: P.name }), sound: tier === 2 || mult > 1,
            body: iconName(t.icon) + (t.count > 1 ? ' ×' + t.count : '') + ', ' + Math.round(d) + ' ' + tr('km') + ' ' + dirName(bearing(P.lat, P.lon, p.lat, p.lon)) +
                  (closing ? ', ' + tr('toYou') : '') + (eta ? ', ' + tr('eta', { n: eta }) : '') });
        } else if (d > R * 1.3) rec.tier = 0;
        rec.d = d; rec.miss = 0;
        if (RG && rIdx >= 0 && !rec.inR) {
          var xy = project(p.lat, p.lon);
          if (pipRings(xy[0], xy[1], RG.list[rIdx].r)) { rec.inR = true; if (!pushed) msgs.push({ title: tr('nRaionT'), body: iconName(t.icon) + (t.count > 1 ? ' ×' + t.count : '') + ' — ' + rName, sound: true }); }
        }
      });
    }
    if (S.nNear && home) M.approx.forEach(function (a) {   // «ракета на область» без точки: лише факт, без відстані
      if (a.region !== home || a.advisory || a.key.indexOf('nt:') !== 0 || a.cat === 'ad' || a.cat === 'other') return;
      seen[a.key] = 1;
      var rec = N.tr[a.key] || (N.tr[a.key] = { miss: 0, fresh: true });
      if (rec.fresh) { rec.fresh = false; msgs.push({ title: tr('nRegT', { r: regName(home) }), body: iconName(a.icon) + (a.n > 1 ? ' ×' + a.n : ''), sound: a.cat === 'missile' }); }
    });
    Object.keys(N.tr).forEach(function (k) { if (!seen[k] && ++N.tr[k].miss > 6) delete N.tr[k]; });
    if (!N.primed) { N.primed = true; return; }                 // перше опитування лише запам'ятовує стан — без лавини сповіщень
    if (!S.notify || !msgs.length) return;
    deliver(msgs[0].title, msgs[0].body + (msgs.length > 1 ? '  (+' + (msgs.length - 1) + ')' : ''), msgs.some(function (m) { return m.sound; }));
  }

  // --------------------------------------------------------------------- DOM
  var api = {};
  var root = domEl.querySelector('.uaw');
  function $(s) { return root.querySelector(s); }
  var svg = $('.mapsvg'), gRg = $('.rgs'), gHomes = $('.homes'), gPlace = $('.place'), gTrails = $('.trails'), gRicons = $('.ricons'), gTracks = $('.tracks'), defsPats = $('.pats');
  var regionEls = {}, regionBB = {}, cells = {}, fillCache = {}, rgEls = [], rgFill = [];
  [].forEach.call(root.querySelectorAll('.reg'), function (el) { regionEls[el.getAttribute('data-r')] = el; });
  [].forEach.call(root.querySelectorAll('.cell'), function (el) { cells[el.getAttribute('data-c')] = { el: el, n: el.querySelector('.n') }; });
  (function normalizeSettings() { var c = S.place && cityById(S.place); if (c) S.home = c.region; else if (S.place) S.place = ''; })();

  function sync(parent, items) {                   // оновлення «по ключу»: анімації не скидаються щосекунди
    var map = parent.__map || (parent.__map = {}), seen = {};
    items.forEach(function (it) {
      seen[it.key] = 1;
      var g = map[it.key];
      if (!g) { g = map[it.key] = document.createElementNS(NS, 'g'); parent.appendChild(g); }
      if (g.__sig !== it.sig) { g.innerHTML = it.html; g.__sig = it.sig; }
      g.setAttribute('transform', 'translate(' + it.x.toFixed(1) + ' ' + it.y.toFixed(1) + ')');
    });
    Object.keys(map).forEach(function (k) { if (!seen[k]) { parent.removeChild(map[k]); delete map[k]; } });
  }
  function px() { return VB.w / Math.max(80, svg.clientWidth || 240); }   // одиниць SVG в одному CSS-пікселі
  function setHTML(el, html) { if (el.__h !== html) { el.innerHTML = html; el.__h = html; return true; } return false; }
  function pad2(n) { return ('0' + n).slice(-2); }
  function fmtClock(ms) {
    try { return new Date(ms).toLocaleTimeString(S.lang === 'uk' ? 'uk-UA' : 'en-GB', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { var d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  }
  function fmtWhen(ms) {
    var d = new Date(ms), n = new Date();
    return d.toDateString() === n.toDateString() ? fmtClock(ms) : pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + ' ' + fmtClock(ms);
  }
  function fmtDur(ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    if (m >= 1440) return Math.floor(m / 1440) + ' ' + tr('d') + ' ' + Math.floor((m % 1440) / 60) + ' ' + tr('h');
    return m >= 60 ? Math.floor(m / 60) + ' ' + tr('h') + ' ' + (m % 60) + ' ' + tr('m') : m + ' ' + tr('m');
  }
  function pattern(id, col) {
    var pid = 'uaw-h-' + id, p = defsPats.querySelector('#' + pid), n = 22;
    if (!p) {
      p = document.createElementNS(NS, 'pattern');
      p.setAttribute('id', pid); p.setAttribute('patternUnits', 'userSpaceOnUse'); p.setAttribute('width', n); p.setAttribute('height', n); p.setAttribute('patternTransform', 'rotate(45)');
      p.innerHTML = '<rect width="' + n + '" height="' + n + '" fill-opacity=".24"/><rect width="9" height="' + n + '"/>';
      defsPats.appendChild(p);
    }
    if (p.__c !== col) { [].forEach.call(p.children, function (r) { r.setAttribute('fill', col); }); p.__c = col; }
    return 'url(#' + pid + ')';
  }

  // --- райони: шар меж + визначення області для кожного району
  function ringsD(rings) {
    return rings.map(function (r) { var d = 'M' + r[0] + ' ' + r[1]; for (var i = 2; i < r.length; i += 2) d += 'L' + r[i] + ' ' + r[i + 1]; return d + 'Z'; }).join('');
  }
  function regionAt(x, y) {
    var ids = Object.keys(regionEls);
    for (var i = 0; i < ids.length; i++) {
      var b = regionBB[ids[i]] || (regionBB[ids[i]] = regionEls[ids[i]].getBBox());
      if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) continue;
      if (regionEls[ids[i]].isPointInFill(new DOMPoint(x, y))) return ids[i];
    }
    return '';
  }
  function regionOfRaion(g) {
    var r = g.r[0], n = r.length / 2, cx = 0, cy = 0, i, reg;
    for (i = 0; i < r.length; i += 2) { cx += r[i]; cy += r[i + 1]; }
    reg = regionAt(cx / n, cy / n); if (reg) return reg;
    for (i = 0; i < n; i += Math.max(1, Math.floor(n / 8))) {      // центроїд міг потрапити у «діру» — пробуємо вершини
      var px_ = r[i * 2] + (cx / n - r[i * 2]) * 0.15, py_ = r[i * 2 + 1] + (cy / n - r[i * 2 + 1]) * 0.15;
      reg = regionAt(px_, py_); if (reg) return reg;
    }
    return '';
  }
  function buildRaionLayer() {
    rgDirty = false; rgFill = [];
    if (!RG) { gRg.innerHTML = ''; rgEls = []; return; }
    var h = '';
    RG.list.forEach(function (g, i) { h += '<path class="rg" fill-rule="evenodd" d="' + ringsD(g.r) + '"/>'; });
    gRg.innerHTML = h; rgEls = [].slice.call(gRg.querySelectorAll('.rg'));
    RG.list.forEach(function (g) { g.region = regionOfRaion(g); });
  }

  // --- малювання
  function drawRegions(M, now) {
    var useR = !!(RG && S.districts), matched = {};
    if (useR) {
      if (rgDirty) buildRaionLayer();
      RG.list.forEach(function (g, i) {
        var a = M.rl[g.norm], f = '';
        if (a && !(a.region && g.region && a.region !== g.region)) {
          var rs = M.regions[g.region];
          if (!(rs && rs.full)) { f = alertColor(a.level, (now - a.since) / 60000); matched[g.region] = 1; }
        }
        if (rgFill[i] !== f) { rgEls[i].style.fill = f; rgFill[i] = f; }
      });
    }
    Object.keys(regionEls).forEach(function (id) {
      var st = M.regions[id], fill = '';
      if (st) {
        var col = alertColor(st.level, (now - st.since) / 60000);
        if (st.full) fill = col;
        else if (useR && matched[id]) fill = '';                 // підсвітимо лише райони
        else fill = S.partial ? pattern(id, col) : col;          // запобіжник: райони не збіглися → штриховка, а не «тиша»
      }
      if (fillCache[id] !== fill) { regionEls[id].style.fill = fill; fillCache[id] = fill; }
    });
    var home = homeId();
    sync(gHomes, home && regionEls[home] ? [{ key: 'h', x: 0, y: 0, sig: home, html: '<path class="homeline" d="' + regionEls[home].getAttribute('d') + '"/>' }] : []);
  }
  function markerHTML(m, u) {
    var h = '', sz = 11.5 * u / 24, cc = m.icon === 'recon' ? 'recon' : m.cat;
    if (m.pulse) h += '<circle class="pulse c-' + cc + '" r="' + (6.5 * u).toFixed(1) + '"/>';
    if (m.course && m.hdg != null) h += '<line class="course c-' + cc + '" x1="0" y1="' + (-7 * u).toFixed(1) + '" x2="0" y2="' + (-16 * u).toFixed(1) + '" transform="rotate(' + m.hdg + ')"/>';
    h += '<use href="#uaw-i-' + m.icon + '" class="mk c-' + cc + (m.adv ? ' adv' : '') + (m.old ? ' old' : '') + '" transform="' +
         (ROTATES[m.icon] && m.hdg != null ? 'rotate(' + m.hdg + ') ' : '') + 'scale(' + sz.toFixed(3) + ')"/>';
    if (m.n > 1) h += '<text class="bd" x="' + (6 * u).toFixed(1) + '" y="' + (-3.5 * u).toFixed(1) + '" style="font-size:' + (8.5 * u).toFixed(1) + 'px">×' + m.n + '</text>';
    return h;
  }
  function drawMarkers(M, now) {
    var u = px(), tracks = [], trails = [], ric = [];
    M.tracks.forEach(function (t) {
      var p = predict(t, now), xy = project(p.lat, p.lon);
      if (xy[0] < MARGIN.x0 || xy[0] > MARGIN.x1 || xy[1] < MARGIN.y0 || xy[1] > MARGIN.y1) return;
      var hdg = p.hdg == null ? null : Math.round(p.hdg / 3) * 3;
      var m = { cat: t.cat, icon: t.icon, n: t.count, hdg: hdg, adv: t.advisory, old: t.status === 'stale',
                course: S.course && hdg != null && ROTATES[t.icon], pulse: t.cat === 'missile' && !t.advisory && t.status !== 'stale' };
      tracks.push({ key: t.id, x: xy[0], y: xy[1], sig: [m.cat, m.icon, m.n, m.hdg, m.adv, m.old, m.course, m.pulse, u.toFixed(2)].join('|'), html: markerHTML(m, u) });
      if (S.course && t.trail) {
        var pts = t.trail.map(function (q) { var z = project(q[0], q[1]); return z[0].toFixed(1) + ',' + z[1].toFixed(1); });
        pts.push(xy[0].toFixed(1) + ',' + xy[1].toFixed(1));
        trails.push({ key: 'tr:' + t.id, x: 0, y: 0, sig: pts.join(' ') + t.cat, html: '<polyline class="trail c-' + t.cat + '" points="' + pts.join(' ') + '"/>' });
      }
    });
    var by = {};
    M.approx.forEach(function (a) { (by[a.region] = by[a.region] || []).push(a); });
    Object.keys(by).forEach(function (id) {          // іконки «по області» — рядком навколо опорної точки області
      var el = regionEls[id]; if (!el) return;
      var list = by[id].sort(function (a, b) { return CATS.indexOf(a.cat) - CATS.indexOf(b.cat); }), gap = 12.5 * u, w = (list.length - 1) * gap, h = '';
      h += '<rect class="ring" x="' + (-w / 2 - 7.5 * u).toFixed(1) + '" y="' + (-7.5 * u).toFixed(1) + '" width="' + (w + 15 * u).toFixed(1) + '" height="' + (15 * u).toFixed(1) + '" rx="' + (7.5 * u).toFixed(1) + '"/>';
      list.forEach(function (a, i) {
        h += '<g transform="translate(' + (-w / 2 + i * gap).toFixed(1) + ' 0)"><use href="#uaw-i-' + a.icon + '" class="mk c-' + a.cat + (a.advisory ? ' adv' : '') + '" transform="scale(' + (10 * u / 24).toFixed(3) + ')"/></g>';
      });
      ric.push({ key: id, x: +el.getAttribute('data-cx'), y: +el.getAttribute('data-cy'), sig: list.map(function (a) { return a.cat + a.icon + a.n + (a.advisory ? 'a' : ''); }).join() + u.toFixed(2), html: h });
    });
    var P = placeObj(), pl = [];
    if (P) { var pxy = project(P.lat, P.lon); pl.push({ key: 'p', x: pxy[0], y: pxy[1], sig: P.id + u.toFixed(2), html: '<circle class="plr" r="' + (6 * u).toFixed(1) + '"/><circle class="pl" r="' + (2.6 * u).toFixed(1) + '"/>' }); }
    sync(gPlace, pl); sync(gTrails, trails); sync(gRicons, ric); sync(gTracks, tracks);
  }
  function drawCounters(M) {
    var off = M.state === 'off' || M.state === 'loading';
    CATS.forEach(function (c) {
      var cell = cells[c], hidden = !S.cats[c], n = M.counts[c];
      cell.n.textContent = (off || hidden) ? '–' : n;
      cell.el.className = 'cell c-' + c + (hidden ? ' x' : (off || n === 0 ? ' z' : ''));
      cell.el.title = catName(c);
    });
  }
  function drawPcard(M, now) {
    var el = $('.pcard'), P = placeObj(), home = homeId(), off = M.state === 'off' || M.state === 'loading', h = '';
    if (P || home) {
      var st = M.regions[home], lv = st ? st.level : 'none', since = st ? st.since : 0;
      if (P && RG) {
        var ri = myRaion();
        if (ri >= 0) { var ra = M.rl[RG.list[ri].norm]; if (ra) { lv = ra.level; since = ra.since; } else if (!(st && st.full)) lv = 'none'; }
      }
      var col = off ? '#8E8E93' : (lv === 'red' ? '#FF453A' : (lv === 'yellow' ? '#FFD60A' : '#32D74B'));
      var txt = off ? tr('noData') : (lv === 'none' ? tr('calm') : tr(lv === 'red' ? 'red' : 'yellow') + (since ? ' · ' + fmtDur(now - since) : ''));
      h = '<b>' + esc(P ? P.name : regName(home)) + '</b><div class="st"><i class="sd" style="--hc:' + col + '"></i><span>' + esc(txt) + '</span></div>';
      if (P && !off) {
        var n = M.nearest;
        if (n && n.d <= 400) {
          var closing = n.hdg != null && angDiff((n.brg + 180) % 360, n.hdg) <= 70;
          h += '<div class="nr">' + esc(iconName(n.t.icon)) + ' <i>' + Math.round(n.d) + ' ' + tr('km') + ' ' + dirName(n.brg) + '</i>' + (closing ? ', ' + tr('toYou') : '') + '</div>';
        } else h += '<div class="nr">' + tr('nothingNear') + '</div>';
      }
    } else {
      var nr = 0, ny = 0; Object.keys(M.regions).forEach(function (id) { if (M.regions[id].level === 'red') nr++; else ny++; });
      h = off ? '<b>' + tr('noData') + '</b>' : '<b>' + (nr + ny) + ' ' + tr('regionsAlert') + '</b><div class="nr">' + nr + ' ' + tr('nRed') + ', ' + ny + ' ' + tr('nYellow') + '</div>';
    }
    setHTML(el, h);
  }
  function drawTicker(now) {
    var el = $('.ticker'), on = S.ticker && !S.compact; el.classList.toggle('on', !!on);
    if (!on) return;
    var f = feedItems(now), cut = now - 3 * 3600e3, items = f.items.filter(function (i) { return i.t >= cut; }).slice(0, 8);
    setHTML($('.tk-name'), f.src === 'au' || (!f.src && S.feedSource === 'aiu') ? 'alerts.in.ua' : 'NEPTUN');
    var track = $('.tk-track'), html, chars = 0;
    if (!items.length) html = '<span class="tk-empty">' + esc(tr('tickerEmpty')) + '</span>';
    else {
      var one = items.map(function (it) { chars += it.text.length + it.ch.length + 8; return '<span class="tk-item"><time>' + fmtClock(it.t) + '</time><b>' + esc(it.ch) + '</b>' + esc(it.text) + '</span>'; }).join('');
      html = one + one;
    }
    if (track.__h !== html) {
      track.innerHTML = html; track.__h = html;
      track.classList.toggle('st', !items.length);
      track.style.setProperty('--dur', Math.max(24, Math.round(chars * 6.4 / (55 * S.tickerSpeed))) + 's');
    }
  }
  function drawBanner() {
    var el = $('.banner');
    if (ui.banner) { setHTML(el, '<b>' + esc(ui.banner.title) + '</b>' + esc(ui.banner.body)); el.classList.add('on'); }
    else { el.classList.remove('on'); el.__h = ''; }
  }
  function drawChrome(M) {
    root.setAttribute('data-state', M.state);
    $('.ttl').textContent = tr('title');
    setHTML($('.asof'), tr('asOf') + ' <b>' + (M.asOf ? fmtClock(M.asOf) : '—') + '</b>');
    setHTML($('.legal'), tr('legal'));
    var bs = root.querySelectorAll('.ibtn'); bs[0].title = tr('history'); bs[1].title = tr('settings');
    var m1 = $('.m1'), m2 = $('.m2');
    if (M.state === 'loading') { m1.textContent = tr('loading'); m2.textContent = ''; }
    else if (M.state === 'off') { m1.textContent = tr('off'); m2.textContent = M.asOf ? tr('offSub', { t: fmtClock(M.asOf) }) : tr('offNever'); }
  }
  function applyLook() {
    root.setAttribute('data-theme', S.appearance);
    root.setAttribute('data-layout', S.compact ? 'compact' : 'full');
    root.setAttribute('data-districts', S.districts && RG ? '1' : '0');
    root.style.setProperty('--s', S.size);
  }

  // --------------------------------------------------------------------- панелі
  function segH(sc, key, opts, cur) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button data-sc="' + sc + '" data-set="' + key + '" data-val="' + esc(JSON.stringify(o[0])) + '" class="' + (cur === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function togH(key, label) { return '<button class="tog' + (S[key] ? ' on' : '') + '" data-tog="' + key + '"><i></i>' + label + '</button>'; }
  function cycH(kind, label) { return '<div class="seg"><button data-cyc="' + kind + '" data-dir="-1">‹</button><span class="lbl">' + esc(label) + '</span><button data-cyc="' + kind + '" data-dir="1">›</button></div>'; }
  function row(label, ctl) { return '<div class="row"><span>' + label + '</span>' + ctl + '</div>'; }
  function srcStatus() {
    function one(name, k, skip) {
      if (skip) return '<b>' + name + '</b>: ' + skip;
      return '<b>' + name + '</b>: ' + (D.err[k] ? tr('error') + ' (' + esc(D.err[k]) + ')' : (D.ok[k] ? tr('ok') : '…'));
    }
    return one('NEPTUN', 'nt') + ' &nbsp; ' + one('alerts', 'na') + ' &nbsp; ' + one('messages', 'nm') + '<br>' + one('alerts.in.ua', 'au', D.hasToken === false ? tr('noToken') : '') +
           ' &nbsp; <b>districts</b>: ' + (RG ? RG.list.length : '…');
  }
  function settingsHTML() {
    var tabs = '<div class="tabs">' + segH('U', 'tab', [['display', tr('tDisplay')], ['data', tr('tData')], ['notify', tr('tAlerts')]], ui.tab) + '</div>', h = tabs;
    if (ui.tab === 'display') {
      var chips = CATS.map(function (c) {
        return '<button class="chip c-' + c + (S.cats[c] ? ' on' : '') + '" data-cat="' + c + '" title="' + esc(catName(c)) + '"><svg viewBox="-13 -13 26 26"><use href="#uaw-i-' + CAT_ICON[c] + '"/></svg></button>';
      }).join('');
      h += row(tr('lang'), segH('S', 'lang', [['en', 'English'], ['uk', 'Українська']], S.lang)) +
           row(tr('appearance'), segH('S', 'appearance', [['dark', tr('dark')], ['light', tr('light')], ['auto', tr('auto')]], S.appearance)) +
           row(tr('palette'), segH('S', 'palette', [['ember', tr('ember')], ['classic', tr('classic')]], S.palette)) +
           row(tr('darkest'), segH('S', 'darkestAfterMin', [[60, '1 ' + tr('h')], [180, '3 ' + tr('h')], [360, '6 ' + tr('h')], [720, '12 ' + tr('h')]], S.darkestAfterMin)) +
           row(tr('targets'), '<div class="chips">' + chips + '</div>') +
           row(tr('size'), segH('S', 'size', [[0.8, '80%'], [1, '100%'], [1.2, '120%'], [1.4, '140%']], S.size)) +
           '<div class="togs">' + togH('districts', tr('tDistricts')) + togH('partial', tr('tPartial')) + togH('course', tr('tCourse')) + togH('ticker', tr('tTicker')) + togH('compact', tr('tCompact')) + '</div>' +
           row(tr('speed'), segH('S', 'tickerSpeed', [[0.7, tr('slow')], [1, tr('normal')], [1.4, tr('fast')]], S.tickerSpeed));
    } else if (ui.tab === 'data') {
      h += row(tr('src'), segH('S', 'alertsSource', [['auto', tr('auto')], ['neptun', 'NEPTUN'], ['aiu', 'alerts.in.ua']], S.alertsSource)) +
           row(tr('feed'), segH('S', 'feedSource', [['auto', tr('auto')], ['neptun', 'NEPTUN'], ['aiu', 'alerts.in.ua']], S.feedSource)) +
           row(tr('conf'), segH('S', 'minConfidence', [[0, tr('any')], [1, tr('medium')], [2, tr('high')]], S.minConfidence)) +
           row(tr('keep'), segH('S', 'historyHours', [[6, '6 ' + tr('h')], [24, '24 ' + tr('h')], [72, '72 ' + tr('h')]], S.historyHours)) +
           '<div class="togs">' + togH('regionThreats', tr('tRegionThreats')) + togH('advisory', tr('tAdvisory')) + togH('stale', tr('tStale')) + '</div>' +
           '<div class="hint">' + srcStatus() + '</div><button class="btn" data-act="reset">' + tr('reset') + '</button>';
    } else {
      var home = homeId(), opts = CITIES.filter(function (c) { return c.region === home; }), cur = S.place && cityById(S.place);
      h += '<div class="togs">' + togH('notify', tr('nOn')) + togH('nSound', tr('nSound')) + '</div>' +
           row(tr('home'), cycH('home', home ? regName(home) : tr('none'))) +
           row(tr('place'), home && opts.length ? cycH('place', cur ? cityName(cur) : tr('regionOnly')) : '<span class="hint">—</span>') +
           '<div class="togs">' + togH('nAlert', tr('nAlert')) + togH('nEnd', tr('nEnd')) + togH('nNear', tr('nNear')) + '</div>' +
           row(tr('radius'), segH('S', 'nRadius', [[25, '25 ' + tr('km')], [50, '50 ' + tr('km')], [100, '100 ' + tr('km')], [150, '150 ' + tr('km')]], S.nRadius)) +
           '<button class="btn" data-act="test">' + tr('nTest') + '</button><div class="hint">' + tr('nHint') + '</div>';
    }
    return h;
  }
  function rowH(e) {
    var ic, cls, tx, sub = '';
    if (e.k === 'tgt') { ic = e.icon; cls = e.icon === 'recon' ? 'recon' : e.cat; tx = esc(e.text) + (e.n > 1 ? ' ×' + e.n : ''); sub = e.region ? esc(regName(e.region)) : ''; }
    else if (e.k === 'alert') {
      ic = 'alert'; cls = e.lv === 'end' ? 'ad' : (e.lv === 'yellow' ? 'recon' : 'missile');
      tx = esc(tr(e.lv === 'end' ? 'alertEnd' : (e.lv === 'yellow' ? 'alertThreat' : 'alertStart'), { r: regName(e.region) }));
    } else { ic = 'msg'; cls = 'other'; tx = esc(e.text); sub = esc(e.ch); }
    return '<div class="hrow"><svg class="hi c-' + cls + '" viewBox="-13 -13 26 26"><use href="#uaw-i-' + ic + '"/></svg><div><div class="tx">' + tx + '</div>' +
           (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><span class="tm">' + fmtWhen(e.t) + '</span></div>';
  }
  function histRows() {
    return HIST.filter(function (e) {
      if (ui.hf !== 'all' && e.k !== ui.hf) return false;
      if (e.k === 'tgt' && (!S.cats[e.cat] || (e.adv && !S.advisory))) return false;
      return true;
    }).slice(0, 150);
  }
  function historyHTML() {
    var rows = histRows();
    return '<div class="tabs">' + segH('U', 'hf', [['all', tr('fAll')], ['tgt', tr('fTargets')], ['alert', tr('fAlerts')], ['msg', tr('fMsgs')]], ui.hf) +
           '<button class="btn" style="margin:0" data-act="hclear">' + tr('clear') + '</button></div>' +
           '<div class="hlist">' + (rows.length ? rows.map(rowH).join('') : '<div class="hempty">' + tr('hEmpty') + '</div>') + '</div><div class="hint">' + tr('hFoot') + '</div>';
  }
  var hSig = '';
  function drawPanel(keepScroll) {
    var el = $('.panel'), btns = root.querySelectorAll('.ibtn');
    el.classList.toggle('on', !!ui.panel);
    [].forEach.call(btns, function (b) { b.classList.toggle('on', b.getAttribute('data-val') === ui.panel); });
    if (!ui.panel) { el.innerHTML = ''; return; }
    var list = el.querySelector('.hlist'), top = list ? list.scrollTop : 0;
    el.innerHTML = ui.panel === 'history' ? historyHTML() : settingsHTML();
    hSig = HIST.length + ':' + (HIST[0] ? HIST[0].id : '');
    if (keepScroll) { var l2 = el.querySelector('.hlist'); if (l2) l2.scrollTop = top; }
  }

  root.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act],[data-set],[data-tog],[data-cat],[data-cyc],[data-url]') : null;
    if (!el) return;
    ev.preventDefault();
    if (el.hasAttribute('data-url')) { run('/usr/bin/open ' + shq(el.getAttribute('data-url'))); return; }
    var act = el.getAttribute('data-act'), save = true;
    if (act === 'panel') { var v = el.getAttribute('data-val'); ui.panel = ui.panel === v ? '' : v; if (ui.panel === 'settings' && ui.tab !== 'display' && ui.tab !== 'data' && ui.tab !== 'notify') ui.tab = 'display'; save = false; }
    else if (act === 'banner') { ui.banner = null; drawBanner(); return; }
    else if (act === 'hclear') { HIST = []; hIds = {}; hDirty = true; hFlush(now_()); save = false; }
    else if (act === 'test') { deliver(tr('testT'), tr('testB'), true); return; }
    else if (act === 'reset') { S = clone(DEFAULTS); (function () { var c = S.place && cityById(S.place); if (c) S.home = c.region; })(); try { localStorage.removeItem(SKEY); } catch (e) { } save = false; myR.key = ''; }
    else if (el.hasAttribute('data-set')) {
      var key = el.getAttribute('data-set'), val = JSON.parse(el.getAttribute('data-val'));
      if (el.getAttribute('data-sc') === 'U') { ui[key] = val; save = false; } else S[key] = val;
    }
    else if (el.hasAttribute('data-tog')) { var k = el.getAttribute('data-tog'); S[k] = !S[k]; }
    else if (el.hasAttribute('data-cat')) { var c = el.getAttribute('data-cat'); S.cats[c] = !S.cats[c]; }
    else if (el.hasAttribute('data-cyc')) {
      var dir = +el.getAttribute('data-dir');
      if (el.getAttribute('data-cyc') === 'home') { var ids = [''].concat(REG_ORDER); S.home = ids[(ids.indexOf(S.home) + dir + ids.length) % ids.length]; S.place = ''; }
      else {
        var list = [''].concat(CITIES.filter(function (x) { return x.region === homeId(); }).sort(function (a, b) { return cityName(a).localeCompare(cityName(b)); }).map(function (x) { return x.id; }));
        S.place = list[(list.indexOf(S.place) + dir + list.length) % list.length];
      }
      myR.key = '';
    }
    if (save) persist();
    fullRedraw();
  });

  // --------------------------------------------------------------------- цикл малювання
  function redraw(now) {
    var M = buildModel(now);
    drawChrome(M); drawCounters(M); drawPcard(M, now); drawTicker(now);
    if (!S.compact) { drawRegions(M, now); drawMarkers(M, now); }
  }
  function fullRedraw() {
    applyLook(); drawPanel(); drawBanner();
    fillCache = {}; rgFill = [];
    redraw(now_());
  }
  api.fullRedraw = fullRedraw; api.drawBanner = drawBanner;

  fullRedraw();
  if (window.__uawTimer) clearInterval(window.__uawTimer);
  window.__uawTimer = setInterval(function () {
    try {
      redraw(now_());
      if (ui.panel === 'settings' && ui.tab === 'data') { var h = $('.panel .hint'); if (h) setHTML(h, srcStatus()); }
      if (ui.panel === 'history' && hSig !== HIST.length + ':' + (HIST[0] ? HIST[0].id : '')) drawPanel(true);
    } catch (e) { console.log('[uaw] tick', e); }
  }, 1000);

  return {
    root: root,
    onOutput: function (out) {
      try {
        var now = now_(); ingest(out, now);
        var M = buildModel(now), ev = diffRegions(M);
        logEvents(M, now, ev); evaluateNotify(M, now, ev);
        if (pendingRG) { var b = pendingRG; pendingRG = null; if (!RG || now - RGt > 6 * 864e5) loadRaions(b); }
        redraw(now);
      } catch (e) { console.log('[uaw] update', e); }
    },
    _debug: { D: D, S: function () { return S; }, ui: ui, buildModel: buildModel, parseOutput: parseOutput, project: project, regionId: regionId, predict: predict,
              alertColor: alertColor, HIST: function () { return HIST; }, RG: function () { return RG; }, normRaion: normRaion, evaluateNotify: evaluateNotify, N: N, feedItems: feedItems, deliver: deliver }
  };
}
