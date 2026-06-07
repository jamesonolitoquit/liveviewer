(function () {
  var timing = [];
  var lastTime = performance.now();
  var running = true;

  function tick(now) {
    if (!running) return;
    var delta = now - lastTime;
    timing.push({ t: Math.round(now * 100) / 100, delta: Math.round(delta * 100) / 100 });
    lastTime = now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.__liveviewer = {
    getTiming: function () { return timing.slice(); },
    stop: function () { running = false; },
    getMetrics: function () {
      var copy = timing.slice();
      if (copy.length < 2) return { frames: 0, meanDelta: 0, jankFrames: 0, smoothness: 0 };
      var total = 0, jank = 0, maxD = 0;
      for (var i = 1; i < copy.length; i++) {
        var d = copy[i].delta;
        total += d;
        if (d > 50) jank++;
        if (d > maxD) maxD = d;
      }
      var mean = total / (copy.length - 1);
      var variance = 0;
      for (var i = 1; i < copy.length; i++) {
        var diff = copy[i].delta - mean;
        variance += diff * diff;
      }
      variance /= (copy.length - 1);
      var stdDev = Math.sqrt(variance);
      var smoothness = Math.max(0, Math.min(100, 100 - stdDev * 2));
      return {
        totalFrames: copy.length,
        duration: copy[copy.length - 1].t - copy[0].t,
        meanDelta: Math.round(mean * 100) / 100,
        maxDelta: maxD,
        jankFrames: jank,
        jankRate: Math.round((jank / (copy.length - 1)) * 10000) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        smoothnessScore: Math.round(smoothness * 100) / 100
      };
    }
  };
})();
