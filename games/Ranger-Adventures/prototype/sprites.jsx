/* ============================================================
   sprites.jsx — charming overworld creatures from simple shapes
   (Pokémon-style 3/4 view; CSS shapes only, no illustration)
   ============================================================ */

// soft contact shadow under a creature
function Shadow({ w = 44, blur = 6, op = 0.22, y = 0 }) {
  return <div style={{
    position: 'absolute', left: '50%', bottom: y, transform: 'translateX(-50%)',
    width: w, height: w * 0.34, borderRadius: '50%',
    background: `rgba(20,30,15,${op})`, filter: `blur(${blur}px)`, zIndex: 0,
  }} />;
}

/* ---- Frisling: juvenile wild boar, striped, small + cute ---- */
function Frisling({ size = 64, mood = 'calm', look = 'down' }) {
  const s = size / 64;
  const px = (n) => n * s + 'px';
  const earR = mood === 'scared' ? -22 : -8;
  return (
    <div className="sprite frisling" style={{ position: 'relative', width: px(64), height: px(58) }} aria-hidden="true">
      <Shadow w={size * 0.78} y={px(2)} />
      <div className="sprite-bob" style={{ position: 'absolute', inset: 0 }}>
        {/* ears */}
        <div style={earStyle(px, -1, earR)} />
        <div style={earStyle(px, 1, -earR)} />
        {/* body */}
        <div style={{
          position: 'absolute', left: px(8), top: px(14), width: px(48), height: px(40),
          borderRadius: '52% 52% 48% 48% / 60% 60% 40% 40%',
          background: 'linear-gradient(160deg,#8a6a45 0%,#6f5236 70%,#5c4329 100%)',
          boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.18), inset 0 3px 5px rgba(255,255,255,.18)',
        }} />
        {/* stripes (frisling hallmark) */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            position: 'absolute', left: px(16 + i * 9), top: px(18), width: px(4), height: px(26),
            borderRadius: px(3), background: 'rgba(247,235,210,.62)', transform: 'rotate(6deg)',
          }} />
        ))}
        {/* snout */}
        <div style={{
          position: 'absolute', left: '50%', top: px(40), transform: 'translateX(-50%)',
          width: px(20), height: px(15), borderRadius: '50%',
          background: 'linear-gradient(#caa37e,#a9805b)',
        }}>
          <div style={{ position:'absolute', left: px(5), top: px(5), width: px(3.5), height: px(5), borderRadius:'50%', background:'#5b4128' }} />
          <div style={{ position:'absolute', right: px(5), top: px(5), width: px(3.5), height: px(5), borderRadius:'50%', background:'#5b4128' }} />
        </div>
        {/* eyes */}
        <div style={eyeStyle(px, -1, mood)} />
        <div style={eyeStyle(px, 1, mood)} />
      </div>
    </div>
  );
}
function earStyle(px, dir, rot) {
  return {
    position: 'absolute', top: px(8), left: dir < 0 ? px(13) : 'auto', right: dir > 0 ? px(13) : 'auto',
    width: px(15), height: px(17), borderRadius: '50% 50% 40% 40%',
    background: 'linear-gradient(#6f5236,#523c25)', transform: `rotate(${rot}deg)`,
    transformOrigin: 'bottom center', transition: 'transform var(--dur-base) var(--ease-soft)',
  };
}
function eyeStyle(px, dir, mood) {
  const big = mood === 'scared';
  return {
    position: 'absolute', top: px(26), left: dir < 0 ? px(24) : 'auto', right: dir > 0 ? px(24) : 'auto',
    width: px(big ? 9 : 8), height: px(big ? 11 : 9), borderRadius: '50%',
    background: '#26190f',
    boxShadow: `inset ${px(1.4)} ${px(-1.4)} 0 rgba(255,255,255,.85)`,
  };
}

/* ---- Adult boar (rotte member) ---- */
function Boar({ size = 110 }) {
  const s = size / 110; const px = (n) => n * s + 'px';
  return (
    <div className="sprite boar" style={{ position: 'relative', width: px(110), height: px(86) }} aria-hidden="true">
      <Shadow w={size * 0.82} op={0.26} />
      <div className="sprite-bob" style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position:'absolute', top: px(10), left: px(26), width: px(20), height: px(22), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#4a3722,#33260f)', transform:'rotate(-12deg)' }} />
        <div style={{ position:'absolute', top: px(10), right: px(26), width: px(20), height: px(22), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#4a3722,#33260f)', transform:'rotate(12deg)' }} />
        <div style={{ position:'absolute', left: px(10), top: px(20), width: px(90), height: px(60),
          borderRadius:'50% 50% 46% 46% / 58% 58% 42% 42%',
          background:'linear-gradient(160deg,#5a4126 0%,#3e2d18 75%,#2c200f 100%)',
          boxShadow:'inset 0 -6px 12px rgba(0,0,0,.28), inset 0 4px 7px rgba(255,255,255,.12)' }} />
        <div style={{ position:'absolute', left:'50%', top: px(56), transform:'translateX(-50%)', width: px(30), height: px(22), borderRadius:'50%', background:'linear-gradient(#7a5b3c,#5a4026)' }}>
          <div style={{ position:'absolute', left: px(8), top: px(8), width: px(5), height: px(7), borderRadius:'50%', background:'#241809' }} />
          <div style={{ position:'absolute', right: px(8), top: px(8), width: px(5), height: px(7), borderRadius:'50%', background:'#241809' }} />
        </div>
        <div style={{ position:'absolute', top: px(36), left: px(30), width: px(9), height: px(11), borderRadius:'50%', background:'#1c1206' }} />
        <div style={{ position:'absolute', top: px(36), right: px(30), width: px(9), height: px(11), borderRadius:'50%', background:'#1c1206' }} />
      </div>
    </div>
  );
}

/* ---- Ranger (the player) ---- */
function Ranger({ size = 78 }) {
  const s = size / 78; const px = (n) => n * s + 'px';
  return (
    <div className="sprite ranger" style={{ position:'relative', width: px(60), height: px(78) }} aria-hidden="true">
      <Shadow w={size * 0.6} op={0.24} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* body / jacket */}
        <div style={{ position:'absolute', left: px(12), top: px(36), width: px(36), height: px(38),
          borderRadius:'40% 40% 30% 30%', background:'linear-gradient(160deg,#2f6b46,#1e4d32)',
          boxShadow:'inset 0 -3px 6px rgba(0,0,0,.25)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(16), top: px(16), width: px(28), height: px(28), borderRadius:'50%',
          background:'linear-gradient(#e8c39c,#d6a878)' }}>
          <div style={{ position:'absolute', left: px(7), top: px(13), width: px(4), height: px(5), borderRadius:'50%', background:'#3a2a1a' }} />
          <div style={{ position:'absolute', right: px(7), top: px(13), width: px(4), height: px(5), borderRadius:'50%', background:'#3a2a1a' }} />
        </div>
        {/* hat brim + dome */}
        <div style={{ position:'absolute', left: px(8), top: px(12), width: px(44), height: px(12), borderRadius: px(8), background:'linear-gradient(#7a5a2f,#5e441f)' }} />
        <div style={{ position:'absolute', left: px(18), top: px(2), width: px(24), height: px(16), borderRadius:'50% 50% 30% 30%', background:'linear-gradient(#8a6736,#6a4d24)' }} />
        <div style={{ position:'absolute', left: px(20), top: px(8), width: px(20), height: px(4), borderRadius: px(2), background:'#f5c23b' }} />
      </div>
    </div>
  );
}

/* ---- Reekalf: roe-deer fawn, spotted, lies still ('drukt zich') ---- */
function Reekalf({ size = 80 }) {
  const s = size / 80; const px = (n) => n * s + 'px';
  return (
    <div className="sprite reekalf" style={{ position: 'relative', width: px(72), height: px(66) }} aria-hidden="true">
      <Shadow w={size * 0.74} y={px(2)} />
      <div className="sprite-bob" style={{ position: 'absolute', inset: 0 }}>
        {/* ears */}
        <div style={{ position:'absolute', top: px(4), left: px(16), width: px(13), height: px(20), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#b78a5a,#946a3e)', transform:'rotate(-18deg)' }} />
        <div style={{ position:'absolute', top: px(4), right: px(16), width: px(13), height: px(20), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#b78a5a,#946a3e)', transform:'rotate(18deg)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(10), top: px(16), width: px(52), height: px(42),
          borderRadius:'52% 52% 46% 46% / 60% 60% 40% 40%',
          background:'linear-gradient(160deg,#c79a64 0%,#a8794a 70%,#946a3e 100%)',
          boxShadow:'inset 0 -4px 8px rgba(0,0,0,.16), inset 0 3px 5px rgba(255,255,255,.22)' }} />
        {/* white camouflage spots */}
        {[[20,24],[33,32],[46,26],[27,40],[42,42]].map((p,i) => (
          <div key={i} style={{ position:'absolute', left: px(p[0]), top: px(p[1]), width: px(5), height: px(5), borderRadius:'50%', background:'rgba(255,250,238,.78)' }} />
        ))}
        {/* snout */}
        <div style={{ position:'absolute', left:'50%', top: px(42), transform:'translateX(-50%)', width: px(18), height: px(14), borderRadius:'50%', background:'linear-gradient(#caa37e,#a9805b)' }}>
          <div style={{ position:'absolute', left: px(4), top: px(5), width: px(3), height: px(4), borderRadius:'50%', background:'#5b4128' }} />
          <div style={{ position:'absolute', right: px(4), top: px(5), width: px(3), height: px(4), borderRadius:'50%', background:'#5b4128' }} />
        </div>
        {/* eyes (soft, gentle) */}
        <div style={{ position:'absolute', top: px(28), left: px(25), width: px(8), height: px(10), borderRadius:'50%', background:'#26190f', boxShadow:`inset ${px(1.4)} ${px(-1.4)} 0 rgba(255,255,255,.85)` }} />
        <div style={{ position:'absolute', top: px(28), right: px(25), width: px(8), height: px(10), borderRadius:'50%', background:'#26190f', boxShadow:`inset ${px(-1.4)} ${px(-1.4)} 0 rgba(255,255,255,.85)` }} />
      </div>
    </div>
  );
}

/* ---- Ree: adult roe deer (mother / 'geit'), slender, upright, no antlers ---- */
function Ree({ size = 130 }) {
  const s = size / 130; const px = (n) => n * s + 'px';
  return (
    <div className="sprite ree" style={{ position:'relative', width: px(96), height: px(118) }} aria-hidden="true">
      <Shadow w={size * 0.6} op={0.24} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* legs (slender) */}
        <div style={{ position:'absolute', left: px(24), top: px(94), width: px(7), height: px(22), borderRadius: px(4), background:'linear-gradient(#946a3e,#6f4f2c)' }} />
        <div style={{ position:'absolute', left: px(40), top: px(96), width: px(7), height: px(20), borderRadius: px(4), background:'linear-gradient(#8a6238,#6f4f2c)' }} />
        <div style={{ position:'absolute', left: px(58), top: px(94), width: px(7), height: px(22), borderRadius: px(4), background:'linear-gradient(#946a3e,#6f4f2c)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(14), top: px(52), width: px(64), height: px(50),
          borderRadius:'50% 50% 44% 44% / 60% 60% 40% 40%',
          background:'linear-gradient(160deg,#b58a57 0%,#9a7142 72%,#855f35 100%)',
          boxShadow:'inset 0 -5px 10px rgba(0,0,0,.22), inset 0 3px 6px rgba(255,255,255,.16)' }} />
        {/* neck */}
        <div style={{ position:'absolute', left: px(50), top: px(24), width: px(20), height: px(44),
          borderRadius: px(12), background:'linear-gradient(160deg,#b58a57,#946a3e)', transform:'rotate(8deg)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(54), top: px(8), width: px(30), height: px(28),
          borderRadius:'52% 52% 46% 60%', background:'linear-gradient(#bd9261,#9a7142)' }}>
          {/* muzzle */}
          <div style={{ position:'absolute', right: px(-6), top: px(12), width: px(14), height: px(11), borderRadius:'50%', background:'linear-gradient(#caa37e,#7d5a38)' }}>
            <div style={{ position:'absolute', right: px(3), top: px(4), width: px(3), height: px(4), borderRadius:'50%', background:'#2a1c0e' }} />
          </div>
          {/* eye */}
          <div style={{ position:'absolute', left: px(9), top: px(10), width: px(6), height: px(8), borderRadius:'50%', background:'#26190f', boxShadow:`inset ${px(1.2)} ${px(-1.2)} 0 rgba(255,255,255,.8)` }} />
        </div>
        {/* ears (tall, roe-deer) */}
        <div style={{ position:'absolute', left: px(50), top: px(-2), width: px(12), height: px(22), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#a87c4c,#855f35)', transform:'rotate(-26deg)', transformOrigin:'bottom center' }} />
        <div style={{ position:'absolute', left: px(66), top: px(-4), width: px(12), height: px(22), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#a87c4c,#855f35)', transform:'rotate(16deg)', transformOrigin:'bottom center' }} />
      </div>
    </div>
  );
}

/* ---- Edelhert: red deer stag, antlers (the 'burl' caller) ---- */
function Hert({ size = 130 }) {
  const s = size / 130; const px = (n) => n * s + 'px';
  return (
    <div className="sprite hert" style={{ position:'relative', width: px(104), height: px(122) }} aria-hidden="true">
      <Shadow w={size * 0.62} op={0.24} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* legs */}
        <div style={{ position:'absolute', left: px(26), top: px(96), width: px(8), height: px(24), borderRadius: px(4), background:'linear-gradient(#7a5631,#5a3f22)' }} />
        <div style={{ position:'absolute', left: px(60), top: px(96), width: px(8), height: px(24), borderRadius: px(4), background:'linear-gradient(#6f4f2c,#5a3f22)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(16), top: px(54), width: px(70), height: px(50),
          borderRadius:'50% 50% 44% 44% / 60% 60% 40% 40%',
          background:'linear-gradient(160deg,#a9763f 0%,#8a5e30 72%,#734d27 100%)',
          boxShadow:'inset 0 -5px 10px rgba(0,0,0,.24), inset 0 3px 6px rgba(255,255,255,.16)' }} />
        {/* neck */}
        <div style={{ position:'absolute', left: px(54), top: px(24), width: px(22), height: px(46),
          borderRadius: px(12), background:'linear-gradient(160deg,#a9763f,#8a5e30)', transform:'rotate(10deg)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(58), top: px(12), width: px(30), height: px(26),
          borderRadius:'52% 52% 46% 62%', background:'linear-gradient(#b3814b,#8a5e30)' }}>
          <div style={{ position:'absolute', right: px(-5), top: px(11), width: px(13), height: px(10), borderRadius:'50%', background:'linear-gradient(#c39a66,#74522f)' }}>
            <div style={{ position:'absolute', right: px(3), top: px(3), width: px(3), height: px(4), borderRadius:'50%', background:'#241809' }} />
          </div>
          <div style={{ position:'absolute', left: px(8), top: px(9), width: px(6), height: px(8), borderRadius:'50%', background:'#26190f', boxShadow:`inset ${px(1.2)} ${px(-1.2)} 0 rgba(255,255,255,.8)` }} />
        </div>
        {/* antlers (simple branched bars) */}
        <div style={{ position:'absolute', left: px(58), top: px(-12), width: px(5), height: px(26), borderRadius: px(3), background:'#d8c39a', transform:'rotate(-16deg)', transformOrigin:'bottom' }} />
        <div style={{ position:'absolute', left: px(54), top: px(-6), width: px(4), height: px(14), borderRadius: px(2), background:'#d8c39a', transform:'rotate(-44deg)', transformOrigin:'bottom' }} />
        <div style={{ position:'absolute', left: px(78), top: px(-14), width: px(5), height: px(28), borderRadius: px(3), background:'#d8c39a', transform:'rotate(18deg)', transformOrigin:'bottom' }} />
        <div style={{ position:'absolute', left: px(86), top: px(-6), width: px(4), height: px(14), borderRadius: px(2), background:'#d8c39a', transform:'rotate(46deg)', transformOrigin:'bottom' }} />
        {/* ears */}
        <div style={{ position:'absolute', left: px(52), top: px(6), width: px(11), height: px(16), borderRadius:'50% 50% 40% 40%', background:'linear-gradient(#9c6e3e,#73502c)', transform:'rotate(-30deg)', transformOrigin:'bottom center' }} />
      </div>
    </div>
  );
}

/* ---- Raaf: raven, glossy black, smart (the 'kroa' caller) ---- */
function Raaf({ size = 80 }) {
  const s = size / 80; const px = (n) => n * s + 'px';
  return (
    <div className="sprite raaf" style={{ position:'relative', width: px(72), height: px(64) }} aria-hidden="true">
      <Shadow w={size * 0.62} op={0.22} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* tail */}
        <div style={{ position:'absolute', left: px(4), top: px(34), width: px(28), height: px(14), borderRadius:'50% 0 0 50%', background:'linear-gradient(#1a1c22,#0c0d11)', transform:'rotate(-8deg)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(18), top: px(20), width: px(44), height: px(36),
          borderRadius:'52% 52% 48% 48% / 58% 58% 42% 42%',
          background:'radial-gradient(120% 90% at 35% 25%, #3a3d49 0%, #1c1e26 45%, #0b0c10 100%)',
          boxShadow:'inset 0 -3px 7px rgba(0,0,0,.4)' }} />
        {/* wing sheen */}
        <div style={{ position:'absolute', left: px(24), top: px(26), width: px(30), height: px(22), borderRadius:'50%', background:'linear-gradient(120deg, rgba(90,110,150,.5), transparent 60%)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(40), top: px(8), width: px(24), height: px(22), borderRadius:'50%', background:'radial-gradient(circle at 40% 35%, #34373f, #0c0d11)' }}>
          <div style={{ position:'absolute', left: px(6), top: px(8), width: px(5), height: px(5), borderRadius:'50%', background:'#cfd6e6', boxShadow:'inset 0 0 0 1px #0c0d11' }} />
        </div>
        {/* beak */}
        <div style={{ position:'absolute', left: px(60), top: px(15), width: px(16), height: px(8), background:'linear-gradient(#2a2c33,#111217)', borderRadius:'2px 60% 60% 2px', transform:'rotate(4deg)' }} />
      </div>
    </div>
  );
}

/* ---- Nachtzwaluw: nightjar, mottled, flat on the ground (the 'ratel') ---- */
function Nachtzwaluw({ size = 80 }) {
  const s = size / 80; const px = (n) => n * s + 'px';
  return (
    <div className="sprite nachtzwaluw" style={{ position:'relative', width: px(78), height: px(50) }} aria-hidden="true">
      <Shadow w={size * 0.66} op={0.18} y={px(0)} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* low flat body */}
        <div style={{ position:'absolute', left: px(8), top: px(16), width: px(62), height: px(30),
          borderRadius:'48% 52% 50% 50% / 70% 70% 40% 40%',
          background:'linear-gradient(160deg,#9a8763 0%,#7c6a48 60%,#62543a 100%)',
          boxShadow:'inset 0 -3px 6px rgba(0,0,0,.22)' }} />
        {/* mottle speckles (camouflage) */}
        {[[18,22],[30,30],[42,24],[52,32],[26,38],[46,40],[36,18]].map((p,i) => (
          <div key={i} style={{ position:'absolute', left: px(p[0]), top: px(p[1]), width: px(4), height: px(3), borderRadius:'50%', background:'rgba(40,30,18,.45)' }} />
        ))}
        {/* head + big night eye */}
        <div style={{ position:'absolute', left: px(54), top: px(12), width: px(22), height: px(20), borderRadius:'50%', background:'linear-gradient(#8c7a56,#6c5c3e)' }}>
          <div style={{ position:'absolute', left: px(6), top: px(6), width: px(9), height: px(9), borderRadius:'50%', background:'#16110a', boxShadow:`inset ${px(-1.5)} ${px(-1.5)} 0 rgba(255,255,255,.5)` }} />
        </div>
      </div>
    </div>
  );
}

/* ---- Das: badger, low body, white face with two black stripes ---- */
function Das({ size = 96 }) {
  const s = size / 96; const px = (n) => n * s + 'px';
  return (
    <div className="sprite das" style={{ position:'relative', width: px(96), height: px(60) }} aria-hidden="true">
      <Shadow w={size * 0.74} op={0.24} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* body */}
        <div style={{ position:'absolute', left: px(8), top: px(18), width: px(72), height: px(38),
          borderRadius:'46% 50% 46% 46% / 64% 64% 40% 40%',
          background:'linear-gradient(160deg,#9aa0a6 0%,#7a7f86 55%,#5c6066 100%)',
          boxShadow:'inset 0 -4px 8px rgba(0,0,0,.26)' }} />
        {/* head (white) */}
        <div style={{ position:'absolute', left: px(58), top: px(14), width: px(34), height: px(34), borderRadius:'50% 56% 44% 50%',
          background:'linear-gradient(#f4f1ea,#dcd7cc)' }} />
        {/* two black face stripes */}
        <div style={{ position:'absolute', left: px(64), top: px(14), width: px(7), height: px(30), borderRadius: px(4), background:'#23262b', transform:'rotate(8deg)' }} />
        <div style={{ position:'absolute', left: px(80), top: px(14), width: px(7), height: px(30), borderRadius: px(4), background:'#23262b', transform:'rotate(-8deg)' }} />
        {/* snout + eye */}
        <div style={{ position:'absolute', left: px(88), top: px(30), width: px(8), height: px(8), borderRadius:'50%', background:'#1a1c20' }} />
        {/* ears */}
        <div style={{ position:'absolute', left: px(60), top: px(10), width: px(10), height: px(10), borderRadius:'50%', background:'#f1ede4' }} />
        <div style={{ position:'absolute', left: px(80), top: px(10), width: px(10), height: px(10), borderRadius:'50%', background:'#f1ede4' }} />
      </div>
    </div>
  );
}

/* ---- Eekhoorn: red squirrel, bushy tail, ear tufts (the 'tjik' caller) ---- */
function Eekhoorn({ size = 80 }) {
  const s = size / 80; const px = (n) => n * s + 'px';
  return (
    <div className="sprite eekhoorn" style={{ position:'relative', width: px(76), height: px(72) }} aria-hidden="true">
      <Shadow w={size * 0.6} y={px(2)} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* big bushy tail curving up behind */}
        <div style={{ position:'absolute', left: px(2), top: px(8), width: px(30), height: px(54),
          borderRadius:'60% 40% 50% 50% / 60% 50% 50% 40%',
          background:'linear-gradient(150deg,#cf7a36 0%,#a85a24 70%,#8a4a1c 100%)',
          boxShadow:'inset 0 -3px 7px rgba(0,0,0,.22)', transform:'rotate(-14deg)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(26), top: px(24), width: px(36), height: px(40),
          borderRadius:'52% 52% 46% 46% / 58% 58% 42% 42%',
          background:'linear-gradient(160deg,#d2823c 0%,#b1632a 72%,#974f20 100%)',
          boxShadow:'inset 0 -4px 8px rgba(0,0,0,.18), inset 0 3px 5px rgba(255,255,255,.2)' }} />
        {/* pale belly */}
        <div style={{ position:'absolute', left: px(34), top: px(40), width: px(20), height: px(22), borderRadius:'50%', background:'linear-gradient(#fbf1e3,#ecd7be)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(34), top: px(12), width: px(28), height: px(26), borderRadius:'52% 52% 48% 48%',
          background:'linear-gradient(#d98a44,#b1632a)' }}>
          {/* snout */}
          <div style={{ position:'absolute', left: px(-3), top: px(12), width: px(11), height: px(9), borderRadius:'50%', background:'linear-gradient(#e8b97f,#c98c52)' }}>
            <div style={{ position:'absolute', left: px(1), top: px(3), width: px(3), height: px(4), borderRadius:'50%', background:'#2a1c0e' }} />
          </div>
          {/* eye */}
          <div style={{ position:'absolute', right: px(8), top: px(9), width: px(7), height: px(8), borderRadius:'50%', background:'#26190f', boxShadow:`inset ${px(-1.3)} ${px(-1.3)} 0 rgba(255,255,255,.8)` }} />
        </div>
        {/* ear tufts */}
        <div style={{ position:'absolute', left: px(38), top: px(2), width: px(8), height: px(16), borderRadius:'50% 50% 30% 30%', background:'linear-gradient(#b1632a,#8a4a1c)', transform:'rotate(-16deg)', transformOrigin:'bottom' }} />
        <div style={{ position:'absolute', left: px(52), top: px(2), width: px(8), height: px(16), borderRadius:'50% 50% 30% 30%', background:'linear-gradient(#b1632a,#8a4a1c)', transform:'rotate(14deg)', transformOrigin:'bottom' }} />
        {/* little front paws */}
        <div style={{ position:'absolute', left: px(40), top: px(50), width: px(8), height: px(12), borderRadius: px(5), background:'linear-gradient(#c1702f,#9a5320)' }} />
      </div>
    </div>
  );
}

/* ---- Vos: red fox — pointy ears, white cheeks, black socks, white-tipped brush ---- */
function Vos({ size = 88 }) {
  const s = size / 88; const px = (n) => n * s + 'px';
  return (
    <div className="sprite vos" style={{ position:'relative', width: px(96), height: px(74) }} aria-hidden="true">
      <Shadow w={size * 0.74} op={0.24} />
      <div className="sprite-bob" style={{ position:'absolute', inset:0 }}>
        {/* big brush tail with white tip, curving up behind */}
        <div style={{ position:'absolute', left: px(0), top: px(20), width: px(40), height: px(30),
          borderRadius:'60% 50% 60% 50% / 70% 60% 50% 50%',
          background:'linear-gradient(150deg,#e07a32 0%,#c25e22 60%,#a44d1b 100%)',
          boxShadow:'inset 0 -3px 7px rgba(0,0,0,.2)', transform:'rotate(-18deg)' }} />
        <div style={{ position:'absolute', left: px(-2), top: px(20), width: px(18), height: px(18), borderRadius:'50%',
          background:'linear-gradient(#fbf3e6,#e7d8c2)', transform:'rotate(-18deg)' }} />
        {/* body */}
        <div style={{ position:'absolute', left: px(24), top: px(26), width: px(44), height: px(38),
          borderRadius:'50% 52% 46% 46% / 58% 58% 42% 42%',
          background:'linear-gradient(160deg,#e88a3e 0%,#cf6a26 70%,#b2531c 100%)',
          boxShadow:'inset 0 -4px 8px rgba(0,0,0,.18), inset 0 3px 5px rgba(255,255,255,.22)' }} />
        {/* pale chest */}
        <div style={{ position:'absolute', left: px(48), top: px(40), width: px(18), height: px(22), borderRadius:'50%', background:'linear-gradient(#fbf3e6,#ecd9c0)' }} />
        {/* black front sock */}
        <div style={{ position:'absolute', left: px(52), top: px(54), width: px(9), height: px(16), borderRadius: px(4), background:'linear-gradient(#3a2a1c,#241710)' }} />
        <div style={{ position:'absolute', left: px(36), top: px(54), width: px(9), height: px(16), borderRadius: px(4), background:'linear-gradient(#3a2a1c,#241710)' }} />
        {/* head */}
        <div style={{ position:'absolute', left: px(50), top: px(14), width: px(36), height: px(32), borderRadius:'52% 52% 46% 46%',
          background:'linear-gradient(#ec934a,#cf6a26)' }}>
          {/* white cheeks/muzzle */}
          <div style={{ position:'absolute', left: px(4), top: px(14), width: px(24), height: px(16), borderRadius:'48% 48% 50% 50%', background:'linear-gradient(#fbf3e6,#ecd9c0)' }} />
          {/* pointed snout */}
          <div style={{ position:'absolute', left: px(-5), top: px(16), width: px(14), height: px(11), borderRadius:'50% 30% 40% 50%', background:'linear-gradient(#f0e4d2,#d8c3a6)' }}>
            <div style={{ position:'absolute', left: px(0), top: px(3), width: px(5), height: px(5), borderRadius:'50%', background:'#23150b' }} />
          </div>
          {/* amber eye */}
          <div style={{ position:'absolute', right: px(9), top: px(11), width: px(8), height: px(9), borderRadius:'50%', background:'radial-gradient(circle at 60% 40%,#caa24a 0%,#7c5417 70%)', boxShadow:`inset ${px(-1.3)} ${px(-1.3)} 0 rgba(255,255,255,.7)` }} />
        </div>
        {/* pointed ears with dark tips */}
        <div style={{ position:'absolute', left: px(54), top: px(2), width: px(14), height: px(18), borderRadius:'50% 50% 14% 30%', background:'linear-gradient(#cf6a26,#a44d1b)', transform:'rotate(-18deg)', transformOrigin:'bottom' }}>
          <div style={{ position:'absolute', left: px(3), top: px(0), width: px(8), height: px(8), borderRadius:'50% 50% 14% 30%', background:'#2a1b10' }} />
        </div>
        <div style={{ position:'absolute', left: px(72), top: px(2), width: px(14), height: px(18), borderRadius:'50% 50% 30% 14%', background:'linear-gradient(#cf6a26,#a44d1b)', transform:'rotate(16deg)', transformOrigin:'bottom' }}>
          <div style={{ position:'absolute', left: px(3), top: px(0), width: px(8), height: px(8), borderRadius:'50% 50% 30% 14%', background:'#2a1b10' }} />
        </div>
      </div>
    </div>
  );
}

/* ---- Resolver: id → sprite component (used by the new engines) ---- */
function DierSprite({ id, size = 80, mood = 'calm' }) {
  switch (id) {
    case 'wildzwijn':   return <Boar size={size * 1.05} />;
    case 'ree':         return <Ree size={size * 1.5} />;
    case 'reekalf':     return <Reekalf size={size} />;
    case 'edelhert':    return <Hert size={size * 1.5} />;
    case 'raaf':        return <Raaf size={size} />;
    case 'nachtzwaluw': return <Nachtzwaluw size={size} />;
    case 'das':         return <Das size={size * 1.1} />;
    case 'eekhoorn':    return <Eekhoorn size={size} />;
    case 'vos':         return <Vos size={size * 1.15} />;
    default:            return <Frisling size={size} mood={mood} />;
  }
}

/* ---- Elegant placeholder plate for illustrated scenes ---- */
function ArtPlate({ label, w = '100%', h = '100%', round = 16, children, style }) {
  return (
    <div className="art-slot" style={{ width: w, height: h, borderRadius: round, ...style }}>
      {children}
      <div className="art-label">{label}</div>
    </div>
  );
}

Object.assign(window, { Shadow, Frisling, Boar, Ranger, Reekalf, Ree, Hert, Raaf, Nachtzwaluw, Das, Eekhoorn, Vos, DierSprite, ArtPlate });
