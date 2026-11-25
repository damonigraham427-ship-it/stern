// Stern Topics page — per-exam circle: one slice per topic in ONE exam,
// slice size ∝ that topic's question count in the exam file.
// Colors follow the site circle rule: the exam's base color at full strength
// = Mastered, 0.45 tint = Learning, 0.82 tint = Ready to Learn.
// Interaction clones topics.js: moving around the circle lights the slice
// under the pointer and the center shows that slice's % in its color; only
// the active slice's row shows in the panel. Tap/click locks a slice open;
// tapping the center releases it (and cycles the idle readout).
// Topic status comes from examHistory, newest evidence wins, from two
// sources: the latest full-exam attempt (key: file) and the latest topic
// run (key: file + '#topic:' + name). Mastered = 80%+ correct on the
// deciding attempt. The circle's overall % is the mastered share of topics.
(function () {
  var PALETTE = ['#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#475569', '#9333ea'];
  var STATUS = {
    'Mastered': '#15803d',
    'Learning': '#f59e0b',
    'Ready to Learn': '#2563eb'
  };
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tint(hex, f) { // mix hex color with white; f = fraction of white
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function shortTitle(e) {
    var t = e.title || e.file;
    var pre = (e.category || '') + ' \u2014 ';
    if (t.indexOf(pre) === 0) t = t.slice(pre.length);
    return t;
  }
  function wedge(cx, cy, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return 'M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z';
  }
  function sliceFill(color, status) {
    if (status === 'Mastered') return color;
    if (status === 'Learning') return tint(color, 0.45);
    return tint(color, 0.82);
  }

  var params = new URLSearchParams(location.search);
  var examParam = params.get('exam');

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var entries = (idx.exams || []).filter(function (e) { return (e.category || 'General') === 'Stern'; });
    var entry = null;
    entries.forEach(function (e) { if (e.file === examParam) entry = e; });
    if (!entry) return renderPicker(entries);
    renderExam(entry, entries.indexOf(entry));
  }).catch(function () {
    document.getElementById('tp-note').textContent = 'Could not load the exam list.';
  });

  function renderPicker(entries) {
    document.getElementById('tp-title').textContent = 'Stern \u2014 Topics';
    var box = document.getElementById('tp-picker');
    if (!entries.length) {
      document.getElementById('tp-note').textContent = 'No Stern exams yet.';
      return;
    }
    document.getElementById('tp-note').textContent = 'Pick an exam. Each exam gets its own circle: one slice per topic, dark = mastered, light = learning, pale = ready.';
    entries.forEach(function (e) {
      var a = document.createElement('a');
      a.className = 'nav-card tp-card';
      a.href = 'stern-topics.html?exam=' + encodeURIComponent(e.file);
      a.innerHTML = esc(shortTitle(e)) + '<small>' + esc(e.note || 'topic circle') + '</small>';
      box.appendChild(a);
    });
  }

  // Evidence per topic, newest wins — same rule as topics.js statusFor,
  // scoped to this one exam file.
  function statusFor(file, questions) {
    var byTopicQ = {};
    questions.forEach(function (q) {
      if (!q.topic) return;
      (byTopicQ[q.topic] || (byTopicQ[q.topic] = [])).push(q);
    });
    var out = {};
    function consider(topic, attempt, runQuestions) {
      if (!attempt) return;
      var missed = {};
      (attempt.missed || []).forEach(function (m) { missed[m.question] = true; });
      var flagged = {};
      (attempt.flagged || []).forEach(function (m) { flagged[m.question] = true; });
      var n = 0, correct = 0, fl = 0;
      runQuestions.forEach(function (q) {
        n++;
        if (!missed[q.question]) correct++;
        if (flagged[q.question]) fl++;
      });
      if (!n) return;
      var ts = Date.parse(attempt.ts || '') || 0;
      if (!out[topic] || ts >= out[topic].ts) {
        out[topic] = { n: n, correct: correct, flagged: fl, ts: ts };
      }
    }
    var setAttempts = hist[file] || [];
    var latestSet = setAttempts.length ? setAttempts[0] : null;
    Object.keys(byTopicQ).forEach(function (topic) {
      consider(topic, latestSet, byTopicQ[topic]);
      var key = file + '#topic:' + topic;
      var tAttempts = hist[key] || [];
      var latestTopic = tAttempts.length ? tAttempts[0] : null;
      consider(topic, latestTopic, byTopicQ[topic]);
    });
    return out;
  }

  function renderExam(entry, entryIdx) {
    var name = shortTitle(entry);
    document.getElementById('tp-title').textContent = name + ' \u2014 Topics';
    document.getElementById('tp-note').textContent = 'Status from your latest attempt on each topic \u2014 a topic run or a full exam run, whichever is newer. Mastered = 80%+ correct. The % is your mastered share of topics.';
    fetch(entry.file, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      buildCircle(entry, name, d.questions || [], PALETTE[entryIdx % PALETTE.length]);
    }).catch(function () {
      document.getElementById('tp-note').textContent = 'Could not load this exam.';
    });
  }

  function buildCircle(entry, name, questions, color) {
    document.getElementById('tp-main').hidden = false;
    var per = statusFor(entry.file, questions);
    var byTopic = {};
    questions.forEach(function (q) {
      if (!q.topic) return;
      var t = byTopic[q.topic] || (byTopic[q.topic] = { name: q.topic, n: 0, topic_n: q.topic_n || 0 });
      t.n++;
    });
    var topics = Object.keys(byTopic).map(function (k) { return byTopic[k]; }).sort(function (a, b) { return a.topic_n - b.topic_n; });
    topics.forEach(function (t) {
      var s = per && per[t.name];
      if (!s) { t.status = 'Ready to Learn'; t.flagged = 0; t.pct = null; }
      else {
        t.flagged = s.flagged;
        t.pct = Math.round(100 * s.correct / s.n);
        t.status = (s.correct / s.n) >= 0.8 ? 'Mastered' : 'Learning';
      }
    });
    var counts = { 'Mastered': 0, 'Learning': 0, 'Ready to Learn': 0 };
    topics.forEach(function (t) { counts[t.status]++; });
    var totalQ = topics.reduce(function (s, t) { return s + t.n; }, 0);
    var masteredShare = topics.length ? Math.round(100 * counts['Mastered'] / topics.length) : 0;

    // Up next: first Learning topic, else first Ready topic
    var up = null;
    ['Learning', 'Ready to Learn'].forEach(function (want) {
      if (up) return;
      topics.forEach(function (t) { if (!up && t.status === want) up = t; });
    });
    var upEl = document.getElementById('tp-upnext');
    if (up) {
      upEl.hidden = false;
      upEl.innerHTML = 'UP NEXT: <strong>' + esc(up.name) + '</strong> \u00B7 ' + esc(name) +
        ' <a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(entry.file) + '&topic=' + encodeURIComponent(up.name) + '">Practice</a>';
    }

    // Pie: one slice per topic, span ∝ question count
    var svg = document.getElementById('tp-pie');
    var CX = 210, CY = 210, R = 198;
    var a = -Math.PI / 2;
    var parts = [];
    topics.forEach(function (t, ti) {
      var span = totalQ ? (Math.PI * 2) * (t.n / totalQ) : 0;
      parts.push('<path d="' + wedge(CX, CY, R, a, a + span) + '" fill="' + sliceFill(color, t.status) + '" stroke="#fff" stroke-width="2" data-group="' + ti + '"><title>' + esc(t.name) + '</title></path>');
      a += span;
    });
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="80" fill="#fff" stroke="#cbd5e1" stroke-width="2" id="tp-center-bg"></circle>');
    parts.push('<text id="tp-center-num" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle" font-size="40" font-weight="700" fill="#0f172a"></text>');
    parts.push('<text id="tp-center-lab" x="' + CX + '" y="' + (CY + 24) + '" text-anchor="middle" font-size="14" fill="#475569"></text>');
    svg.innerHTML = parts.join('');

    // Interaction state: preview = slice under the pointer; locked = tapped slice.
    var preview = -1, locked = -1, mi = 0;
    function active() { return preview >= 0 ? preview : locked; }

    function drawCenter() {
      var num = document.getElementById('tp-center-num');
      var lab = document.getElementById('tp-center-lab');
      var ti = active();
      if (ti >= 0) {
        var t = topics[ti];
        num.textContent = t.pct === null ? '\u2014' : t.pct + '%';
        num.setAttribute('fill', color);
        lab.textContent = t.name;
        return;
      }
      num.setAttribute('fill', '#0f172a');
      var modes = [
        [counts['Mastered'], 'topics mastered'],
        [masteredShare + '%', 'mastered']
      ];
      num.textContent = modes[mi][0];
      lab.textContent = modes[mi][1] + ' of ' + topics.length + ' topics';
    }

    function renderDetail() {
      var box = document.getElementById('tp-detail');
      var ti = active();
      if (ti < 0) {
        box.innerHTML = '<p class="tp-detail-head">Whole exam</p>' +
          '<p class="tp-detail-counts"><span style="color:' + color + ';font-weight:700">' + masteredShare + '% mastered</span> \u00B7 <span style="color:#15803d">Mastered ' + counts['Mastered'] + '</span> \u00B7 <span style="color:#f59e0b">Learning ' + counts['Learning'] + '</span> \u00B7 <span style="color:#2563eb">Ready ' + counts['Ready to Learn'] + '</span></p>' +
          '<p class="tp-detail-counts"><a class="tp-practice" href="notepad.html?exam=' + encodeURIComponent(entry.file) + '">This exam\'s Notepad</a> \u00B7 <a class="tp-practice" href="quality.html?exam=' + encodeURIComponent(entry.file) + '">This exam\'s Quality review</a></p>' +
          '<div class="tp-topic-row"><span class="tp-topic-name">Full exam</span><span class="tp-topic-meta">every topic in this exam</span><a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(entry.file) + '">Start</a></div>' +
          '<p class="tp-detail-hint">Move around the circle \u2014 only the section you touch shows its topic.</p>';
        return;
      }
      var t = topics[ti];
      var html = '<p class="tp-detail-head"><span class="tp-chip-color" style="background:' + sliceFill(color, t.status) + '"></span> ' + esc(t.name) +
        (locked >= 0 ? ' <button type="button" class="tp-reset" id="tp-reset">Whole exam</button>' : '') + '</p>' +
        '<p class="tp-detail-counts"><span style="color:' + STATUS[t.status] + ';font-weight:700">' + t.status + '</span>' +
        (t.pct === null ? '' : ' \u00B7 ' + t.pct + '% on the latest attempt') +
        ' \u00B7 ' + t.n + ' questions' + (t.flagged ? ' \u00B7 <span class="tp-flag">\u2605 ' + t.flagged + ' flagged</span>' : '') + '</p>' +
        '<div class="tp-topic-row"><span class="tp-topic-name">' + esc(t.name) + '</span><span class="tp-topic-meta">' + t.n + ' questions</span><a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(entry.file) + '&topic=' + encodeURIComponent(t.name) + '">Practice</a></div>';
      box.innerHTML = html;
      var rb = document.getElementById('tp-reset');
      if (rb) rb.addEventListener('click', function () { locked = -1; preview = -1; draw(); });
    }

    function draw() {
      var ti = active();
      svg.querySelectorAll('path[data-group]').forEach(function (p) {
        p.style.opacity = (ti < 0 || +p.getAttribute('data-group') === ti) ? '1' : '0.3';
      });
      drawCenter();
      renderDetail();
    }

    function sliceFromEvent(ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-group') !== null) return +t.getAttribute('data-group');
      return -2; // center or background
    }
    svg.addEventListener('pointermove', function (ev) {
      var gi = sliceFromEvent(ev);
      if (gi >= 0 && gi !== preview) { preview = gi; draw(); }
    });
    svg.addEventListener('pointerleave', function () {
      if (preview >= 0) { preview = -1; draw(); }
    });
    svg.addEventListener('click', function (ev) {
      if (ev.target.id === 'tp-center-bg' || ev.target.id === 'tp-center-num' || ev.target.id === 'tp-center-lab') {
        if (active() >= 0) { locked = -1; preview = -1; draw(); }
        else { mi = (mi + 1) % 2; drawCenter(); }
        return;
      }
      var gi = sliceFromEvent(ev);
      if (gi >= 0) { locked = (locked === gi) ? -1 : gi; preview = -1; draw(); }
    });

    draw();
  }
})();
