// Accuracy, mean, sd, iivCV (coefficient of variation).
// Pure functies, geen DOM. Getest in scoring.test.js.
//
// RT-IIV = sd(correct-only RTs) / mean(correct-only RTs).
// Bron: Kofler e.a. 2013 (ADHD-meta, Clinical Psychology Review 33:1237).

export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

export function sd(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  let ss = 0;
  for (const v of arr) {
    const d = v - m;
    ss += d * d;
  }
  return Math.sqrt(ss / (arr.length - 1));
}

export function iivCV(arr) {
  const m = mean(arr);
  if (m === 0) return 0;
  return sd(arr) / m;
}

// summarize(trials): algemene laag per sessie. Aanvullende velden
// (bv. maxSpan, meanFalseAlarms) voegt elk spel zelf toe.
export function summarize(trials) {
  const n = trials ? trials.length : 0;
  if (n === 0) {
    return { accuracy: 0, meanRT: 0, sdRT: 0, iivCV: 0, trialsN: 0 };
  }
  let correctN = 0;
  const correctRTs = [];
  for (const t of trials) {
    if (t.correct) {
      correctN += 1;
      if (typeof t.rt === 'number' && t.rt > 0) correctRTs.push(t.rt);
    }
  }
  const accuracy = correctN / n;
  const mRT = mean(correctRTs);
  const sRT = sd(correctRTs);
  const cv = mRT === 0 ? 0 : sRT / mRT;
  return {
    accuracy: round3(accuracy),
    meanRT: Math.round(mRT),
    sdRT: Math.round(sRT),
    iivCV: round3(cv),
    trialsN: n,
  };
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}
