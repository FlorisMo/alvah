import fs from 'node:fs';
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/^MESHY_API_KEY=(.*)$/m)?.[1] || '').trim();
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bal = async () => (await (await fetch('https://api.meshy.ai/openapi/v1/balance', {headers:H})).json()).balance;

const id = process.argv[2];                  // refine task id
const height = parseFloat(process.argv[3] || '0.9');
const before = await bal();
console.log('balance before:', before);

const r = await fetch('https://api.meshy.ai/openapi/v1/rigging', {
  method:'POST', headers:H,
  body: JSON.stringify({ input_task_id: id, height_meters: height })
});
const j = await r.json().catch(()=>({}));
console.log('rigging POST HTTP', r.status, JSON.stringify(j).slice(0,300));
const taskId = j.result || j.id;
if (!taskId) { console.log('no rig task id — rigging not accepted. balance after:', await bal()); process.exit(); }

let final;
for (let i=0;i<80;i++){
  const t = await (await fetch(`https://api.meshy.ai/openapi/v1/rigging/${taskId}`, {headers:H})).json();
  if (t.status==='SUCCEEDED'){ final=t; break; }
  if (t.status==='FAILED'){ console.log('rig FAILED:', JSON.stringify(t.task_error||t).slice(0,300)); final=t; break; }
  process.stdout.write(`\r  rig ${t.status} ${t.progress??0}%   `);
  await sleep(5000);
}
console.log('\nrig status:', final?.status);
if (final?.status==='SUCCEEDED') console.log('rig outputs:', Object.keys(final.model_urls||final.result||{}));
const after = await bal();
console.log('balance after:', after, '| rigging cost =', before-after, 'credits');
