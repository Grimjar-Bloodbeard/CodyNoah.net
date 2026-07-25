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
      '<g class="k-eye"><ellipse cx="29" cy="31" rx="5.4" ry="6.4" fill="#fff"/><ellipse class="k-pupil" cx="30" cy="32" rx="2.5" ry="3.3" fill="#141b28"/><circle cx="28.6" cy="29.6" r=".9" fill="#fff"/></g>' +
      '<g class="k-eye"><ellipse cx="43" cy="31" rx="5.4" ry="6.4" fill="#fff"/><ellipse class="k-pupil" cx="44" cy="32" rx="2.5" ry="3.3" fill="#141b28"/><circle cx="42.6" cy="29.6" r=".9" fill="#fff"/></g>' +
      '<g class="k-spark s1"><path d="M62 16 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 z" fill="#f6d785"/></g>' +
      '<g class="k-spark s2"><path d="M9 22 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 z" fill="#5fe0d6"/></g>' +
    '</svg>';

  var meepo = document.getElementById('meepo'), bub = document.getElementById('bubble');
  if (meepo) {
    if (!meepo.querySelector('svg')) meepo.insertAdjacentHTML('afterbegin', KOBOLD_SVG);
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

      var ti = 0, hideT, retreatT;
      var emerge = function () { clearTimeout(retreatT); meepo.classList.add('up'); };
      var retreat = function () { meepo.classList.remove('up'); };
      var say = function (t) {
        emerge();
        bub.innerHTML = t; bub.classList.add('show');
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
      '<span>Share</span><span class="toast">Copied - go brag.</span>';
    document.body.appendChild(sbtn);

    var SHARE_LINES = [
      "One guy built this whole thing - AI as the power tool, stubbornness as the fuel. See for yourself:",
      "Real e-commerce, a real client site, a whole pixel world - one person, no team, no funding. Come argue with the results:",
      "Bet your guy's website doesn't run like this. Solo-built, AI-driven, actually live:"
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
