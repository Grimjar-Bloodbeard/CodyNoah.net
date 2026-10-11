/* ============================================================
   GrimForge Creations - shared behaviors  (forge.js)
   Floating runes, scroll-reveal, cursor-lit aurora, Meepo.
   Drop <div id="runes"></div> inside .bg for runes.
   Give #meepo a data-tips='["...","..."]' attribute for lines.
   ============================================================ */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* floating runes */
  var rc = document.getElementById('runes');
  if (rc && !reduce) {
    var RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✦✧⟡◈❋⌬';
    var cols = ['#5fe0d6', '#b06bff', '#e8b24c'];
    for (var i = 0; i < 16; i++) {
      var s = document.createElement('span');
      s.className = 'rune';
      s.textContent = RUNES[Math.floor(Math.random() * RUNES.length)];
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      s.style.fontSize = (14 + Math.random() * 30) + 'px';
      var d = 8 + Math.random() * 10;
      s.style.animationDuration = d + 's';
      s.style.animationDelay = (-Math.random() * d) + 's';
      s.style.color = cols[i % 3];
      rc.appendChild(s);
    }
  }

  /* scroll reveal */
  var rev = document.querySelectorAll('.reveal');
  if (rev.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: .12 });
    rev.forEach(function (el) { io.observe(el); });
  }

  /* cursor-lit aurora - the teal light follows the pointer */
  var aur = document.querySelector('.bg .aurora');
  if (aur && !reduce) {
    addEventListener('pointermove', function (e) {
      aur.style.setProperty('--mx', (e.clientX / innerWidth * 100).toFixed(1) + '%');
      aur.style.setProperty('--my', (e.clientY / innerHeight * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* Meepo the kobold guide - a hand-built SVG sprite that floats, flaps + blinks */
  var KOBOLD_SVG =
    '<svg class="kobold" viewBox="0 0 72 84" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Meepo the kobold guide">' +
      '<defs><radialGradient id="kglow" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#7ff0e4" stop-opacity=".6"/>' +
        '<stop offset="55%" stop-color="#4ff0e0" stop-opacity=".14"/>' +
        '<stop offset="100%" stop-color="#4ff0e0" stop-opacity="0"/>' +
      '</radialGradient></defs>' +
      '<circle class="k-glow" cx="36" cy="44" r="33" fill="url(#kglow)"/>' +
      '<g class="k-body">' +
      '<g class="k-wing kl"><path d="M27 38 Q7 27 8 50 Q18 47 27 52 Z" fill="#8a63ff" stroke="#4a2f9e" stroke-width="1.6"/></g>' +
      '<g class="k-wing kr"><path d="M45 38 Q65 27 64 50 Q54 47 45 52 Z" fill="#8a63ff" stroke="#4a2f9e" stroke-width="1.6"/></g>' +
      '<path d="M40 68 Q52 74 48 61" fill="none" stroke="#2c7d69" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="36" cy="57" rx="16" ry="17" fill="#48c6ac" stroke="#2c7d69" stroke-width="2"/>' +
      '<ellipse cx="36" cy="61" rx="9" ry="10" fill="#cbf1e7"/>' +
      '<circle cx="21" cy="55" r="4.5" fill="#48c6ac" stroke="#2c7d69" stroke-width="2"/>' +
      '<circle cx="51" cy="55" r="4.5" fill="#48c6ac" stroke="#2c7d69" stroke-width="2"/>' +
      '<path d="M25 19 L21 7 L30 16 Z" fill="#f6d785" stroke="#c9982f" stroke-width="1.4"/>' +
      '<path d="M47 19 L51 7 L42 16 Z" fill="#f6d785" stroke="#c9982f" stroke-width="1.4"/>' +
      '<ellipse cx="36" cy="33" rx="18.5" ry="16.5" fill="#52d2b6" stroke="#2c7d69" stroke-width="2"/>' +
      '<path d="M17 33 L11 30 L17 27 Z" fill="#3aa88f"/><path d="M55 33 L61 30 L55 27 Z" fill="#3aa88f"/>' +
      '<ellipse cx="36" cy="40" rx="10.5" ry="6.5" fill="#cbf1e7"/>' +
      '<circle cx="32.5" cy="40" r="1" fill="#2c7d69"/><circle cx="39.5" cy="40" r="1" fill="#2c7d69"/>' +
      // pupil + highlight are wrapped in .k-look so they move together when he looks around
      '<g class="k-eye"><ellipse cx="29" cy="31" rx="5.4" ry="6.4" fill="#fff"/><g class="k-look"><ellipse class="k-pupil" cx="30" cy="32" rx="2.5" ry="3.3" fill="#141b28"/><circle cx="28.6" cy="29.6" r=".9" fill="#fff"/></g></g>' +
      '<g class="k-eye"><ellipse cx="43" cy="31" rx="5.4" ry="6.4" fill="#fff"/><g class="k-look"><ellipse class="k-pupil" cx="44" cy="32" rx="2.5" ry="3.3" fill="#141b28"/><circle cx="42.6" cy="29.6" r=".9" fill="#fff"/></g></g>' +
      '</g>' +
      '<g class="k-spark s1"><path d="M62 16 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 z" fill="#f6d785"/></g>' +
      '<g class="k-spark s2"><path d="M9 22 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 z" fill="#5fe0d6"/></g>' +
    '</svg>';

  /* Meepo's moods - one small state machine (idle / curious / happy / working).
     setState() just records the state + a timestamp; a single rAF loop reads it
     and eases every value toward that state's target, so nothing ever snaps.
     Everything is written as SVG transform attributes (no layout, no repaint
     of the page around him). Try it from devtools: Meepo.setState('happy') */
  function makeKobold(svg) {
    var body = svg.querySelector('.k-body');
    var eyes = svg.querySelectorAll('.k-eye');
    var looks = svg.querySelectorAll('.k-look');
    var EYE_C = [[29, 31], [43, 31]];   // eye centers, in SVG units
    var PUPIL_X = 2.4, PUPIL_Y = 2.6;   // how far a pupil may travel from the eye center (keeps it inside the white)
    var REST = [1, 1];                  // the pupils' drawn resting offset - with nothing to look at he matches the original art
    var RANGE = 300;                    // px - cursor closer than this makes him curious
    var TARGETS = {                     // per-state targets the loop eases toward
      idle:    { eyeX: 1,    eyeY: 1,    tilt: 0 },
      curious: { eyeX: 1,    eyeY: 1,    tilt: 0 },
      happy:   { eyeX: 1.15, eyeY: 1.15, tilt: 0 },
      working: { eyeX: 1.04, eyeY: .72,  tilt: 7 }   // squint + head tilt while he "thinks"
    };
    var HAPPY_MS = 1000, BOUNCE_MS = 650;

    var k = { state: 'idle', since: 0 };
    var RX = REST[0] / PUPIL_X, RY = REST[1] / PUPIL_Y;   // that resting gaze, in the same -1..1 units as cursor looks
    var cur = { eyeX: 1, eyeY: 1, tilt: 0, lx: RX, ly: RY };
    var ptr = null, lastT = 0, nextBlink = 0, blinkAt = -1;

    k.setState = function (s) {
      if (!TARGETS[s] || s === k.state) return;
      k.state = s; k.since = performance.now();
    };

    addEventListener('pointermove', function (e) { ptr = [e.clientX, e.clientY]; }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { ptr = null; });

    function ease(from, to, rate, dt) { return from + (to - from) * (1 - Math.exp(-rate * dt)); }

    function frame(t) {
      var dt = Math.min((t - (lastT || t)) / 1000, .05); lastT = t;
      var age = t - k.since;

      // where is the cursor relative to his eyes? (one rect read per frame, only when there is a pointer)
      var lx = RX, ly = RY, near = false;
      if (ptr) {
        var r = svg.getBoundingClientRect();
        var ex = r.left + r.width * .5, ey = r.top + r.height * (31 / 84);
        var dx = ptr[0] - ex, dy = ptr[1] - ey, d = Math.sqrt(dx * dx + dy * dy);
        if (d < RANGE && d > 0) {
          near = true;
          var reach = Math.min(1, d / 120);          // look harder the further away (within range)
          lx = dx / d * reach; ly = dy / d * reach;   // unit-circle direction, scaled
        }
      }

      // idle <-> curious is decided by distance; happy + working expire on their own
      if (k.state === 'happy' && age > HAPPY_MS) k.setState(near ? 'curious' : 'idle');
      if (k.state === 'idle' && near) k.setState('curious');
      if (k.state === 'curious' && !near) k.setState('idle');
      if (k.state === 'working') { lx = 0; ly = .5; }   // eyes down to "read" the next fact

      var tg = TARGETS[k.state];
      cur.eyeX = ease(cur.eyeX, tg.eyeX, 12, dt);
      cur.eyeY = ease(cur.eyeY, tg.eyeY, 12, dt);
      cur.tilt = ease(cur.tilt, tg.tilt, 10, dt);
      cur.lx = ease(cur.lx, lx, 14, dt);
      cur.ly = ease(cur.ly, ly, 14, dt);

      // blink every 3-5s (never mid-squint or mid-grin): a 160ms dip to 10% height
      if (!nextBlink) nextBlink = t + 3000 + Math.random() * 2000;
      if (blinkAt < 0 && t >= nextBlink && (k.state === 'idle' || k.state === 'curious')) blinkAt = t;
      var blink = 1;
      if (blinkAt >= 0) {
        var bp = (t - blinkAt) / 160;
        if (bp >= 1) { blinkAt = -1; nextBlink = t + 3000 + Math.random() * 2000; }
        else blink = 1 - .9 * Math.sin(Math.PI * bp);
      }

      // body: gentle bob always; two decaying hops right after a happy poke
      var y = Math.sin(t / 2600 * Math.PI * 2) * 1.4;
      if (k.state === 'happy' && age < BOUNCE_MS) {
        var p = age / BOUNCE_MS;
        y -= 7 * Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p);
      }
      body.setAttribute('transform', 'translate(0 ' + y.toFixed(2) + ') rotate(' + cur.tilt.toFixed(2) + ' 36 50)');

      // pupils: clamp the offset to an ellipse so they can never leave the eye whites
      var px = cur.lx * PUPIL_X, py = cur.ly * PUPIL_Y;
      var m = (px * px) / (PUPIL_X * PUPIL_X) + (py * py) / (PUPIL_Y * PUPIL_Y);
      if (m > 1) { m = Math.sqrt(m); px /= m; py /= m; }
      for (var i = 0; i < 2; i++) {
        var c = EYE_C[i];
        eyes[i].setAttribute('transform', 'translate(' + c[0] + ' ' + c[1] + ') scale(' + cur.eyeX.toFixed(3) + ' ' + (cur.eyeY * blink).toFixed(3) + ') translate(' + -c[0] + ' ' + -c[1] + ')');
        looks[i].setAttribute('transform', 'translate(' + (px - REST[0]).toFixed(2) + ' ' + (py - REST[1]).toFixed(2) + ')');
      }
      requestAnimationFrame(frame);
    }
    if (!reduce) requestAnimationFrame(frame);
    return k;
  }

  var meepo = document.getElementById('meepo'), bub = document.getElementById('bubble');
  if (meepo) {
    if (!meepo.querySelector('svg')) meepo.insertAdjacentHTML('afterbegin', KOBOLD_SVG);
    var kobold = window.Meepo = makeKobold(meepo.querySelector('svg.kobold'));
    if (bub) {
      meepo.appendChild(bub); // the speech bubble now travels with Meepo

      // Meepo's lines: honest, upbeat AI-and-jobs facts + a little site tour
      var SHARED_TIPS = [
        "Oi! I'm <b>Meepo</b>, your guide. I'll show you the cool bits - and the honest truth about <b>AI and jobs</b>. 🐲",
        "Fun fact: every big leap - electricity, the computer, the internet - ended up making <b>more</b> jobs than it erased. AI's next in line. 🔨",
        "When ATMs showed up, everyone swore bank tellers were finished. Teller jobs actually <b>grew</b> for years. New tools make new work.",
        "AI's already coined jobs that didn't exist a few years back - <b>AI trainers, prompt engineers, model wranglers</b>. And it's just warming up.",
        "The internet didn't kill work - it invented <b>millions</b> of jobs nobody could've named before. AI's running the same play, bigger.",
        "Cody's whole bet: AI is a <b>power tool</b>. One stubborn smith can do the work of a whole shop now - a business that couldn't exist before.",
        "AI doesn't replace the person who knows <b>what</b> to build. It just hands 'em a bigger hammer. ⚒",
        "A tractor didn't fire the farmer - it let one farmer feed a whole town. Same story, new century.",
        "Every tool folks feared ended up needing <b>more</b> people to build it, run it, and fix it. Bet on the builders. 💪"
      ];
      var pageTips = [];
      try { pageTips = JSON.parse(meepo.getAttribute('data-tips')) || []; } catch (e) { pageTips = []; }
      var tips = SHARED_TIPS.concat(pageTips);

      var ti = 0, hideT, retreatT, swapT;
      var emerge = function () { clearTimeout(retreatT); meepo.classList.add('up'); };
      var retreat = function () { meepo.classList.remove('up'); };
      var say = function (t) {
        emerge();
        // working: he squints and tilts while the old line fades out, then the
        // new line lands with a happy hop. 280ms = the bubble's .2s fade + a beat.
        kobold.setState('working');
        bub.classList.remove('show');
        clearTimeout(swapT);
        swapT = setTimeout(function () {
          bub.innerHTML = t; bub.classList.add('show');
          kobold.setState('happy');
        }, reduce ? 0 : 280);
        clearTimeout(hideT);
        hideT = setTimeout(function () {
          bub.classList.remove('show');
          retreatT = setTimeout(retreat, 500); // slip back to peeking once he's done talking
        }, 6500);
      };
      var sayNext = function () { say(tips[ti % tips.length]); ti++; };

      meepo.addEventListener('click', sayNext);   // tap / click = give me a hint
      // hover just pops him out of hiding (pure CSS :hover) so you know he's there

      if (!reduce) {
        setTimeout(sayNext, 4000);              // one friendly hello so folks know he's a guide
        setInterval(sayNext, 8 * 60 * 1000);    // then a hint once every ~8 minutes; otherwise he hides
      }
    }
  }

  /* Share button - native OS share sheet on mobile (Web Share API), clipboard
     copy + toast fallback on desktop. Pre-filled text is written to be shared
     as a flex, not just a neutral link. */
  if (!document.querySelector('.sharebtn')) {
    var sbtn = document.createElement('button');
    sbtn.className = 'sharebtn';
    sbtn.type = 'button';
    sbtn.setAttribute('aria-label', 'Share this page');
    sbtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
      '<line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>' +
      '<span>Share</span><span class="toast">Link copied.</span>';
    document.body.appendChild(sbtn);

    var SHARE_LINES = [
      "One guy built this whole thing - AI as the power tool, stubbornness as the fuel. Take a look:",
      "Real e-commerce, a real client site, a whole pixel world - one person, no team. Here's what that looks like:",
      "A mountain workshop in Wilkes County, NC - real software, live and running. Worth a look:"
    ];

    sbtn.addEventListener('click', function () {
      var text = SHARE_LINES[Math.floor(Math.random() * SHARE_LINES.length)];
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: 'GrimForge Creations', text: text, url: url }).catch(function () {});
        return;
      }
      var toast = sbtn.querySelector('.toast');
      var flash = function () { toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + ' ' + url).then(flash).catch(function () { prompt('Copy this link:', url); });
      } else {
        prompt('Copy this link:', url);
      }
    });
  }
})();
