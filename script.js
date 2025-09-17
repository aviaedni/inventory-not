// ===== הגדרות ראשוניות =====
const DEFAULT_BUDGETS = {
  // משתנות
  "אוכל": 3000,
  "סופר": 2000,
  "מסעדות/וולט": 1000,
  "תחבורה": 300,
  // קבועות
  "חשבונות": 280,
  "מנויים קבועים": 315,
  "החזר הלוואה": 1000,
  "החזרי קרדיט": 1914,
  "העברות קרדיט": 1226,
  "חוב סכין": 318,
  "חשבון חשמל (חוב)": 184,
  "מתנות": 186,
  "שכר דירה": 3600
};

const VARIABLE_KEYS = ["אוכל","סופר","מסעדות/וולט","תחבורה"];
const FIXED_KEYS    = ["חשבונות","מנויים קבועים","החזר הלוואה","החזרי קרדיט","העברות קרדיט","חוב סכין","חשבון חשמל (חוב)","מתנות","שכר דירה"];

const monthInput = document.getElementById('month');
const switchBtn  = document.getElementById('switchMonth');
const resetBtn   = document.getElementById('resetMonth');
const exportBtn  = document.getElementById('exportJson');

const sumBudgetEl = document.getElementById('sumBudget');
const sumSpentEl  = document.getElementById('sumSpent');
const sumLeftEl   = document.getElementById('sumLeft');

const tpl = document.getElementById('catRow');

const variableWrap = document.getElementById('variable');
const fixedWrap    = document.getElementById('fixed');

function fmt(n){ return Number(n||0).toLocaleString('he-IL',{maximumFractionDigits:0}); }
function nowMonthStr(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function storageKey(month){ return `budget-tracker:${month}`; }

function loadMonth(month){
  const raw = localStorage.getItem(storageKey(month));
  if(!raw){
    // יצירת רשומה חדשה
    const data = {
      month,
      budgets:{...DEFAULT_BUDGETS},
      spent:Object.fromEntries(Object.keys(DEFAULT_BUDGETS).map(k=>[k,0])),
      history:[] // [{ts,cat,amount}]
    };
    localStorage.setItem(storageKey(month), JSON.stringify(data));
    return data;
  }
  return JSON.parse(raw);
}

function saveMonth(data){
  localStorage.setItem(storageKey(data.month), JSON.stringify(data));
}

function renderCategory(parent, data, catKey){
  const node = tpl.content.firstElementChild.cloneNode(true);
  const nameEl = node.querySelector('.cat-name');
  const budgetEl = node.querySelector('.budget');
  const spentEl  = node.querySelector('.spent');
  const leftEl   = node.querySelector('.left');
  const bar      = node.querySelector('.bar');
  const addBtn   = node.querySelector('.add');
  const minusBtn = node.querySelector('.minus');
  const input    = node.querySelector('.add-input');
  const editBtn  = node.querySelector('.edit');
  const chips    = node.querySelector('.chips');

  nameEl.textContent = catKey;

  function refresh(){
    const b = data.budgets[catKey]||0;
    const s = data.spent[catKey]||0;
    const left = b - s;
    budgetEl.textContent = fmt(b);
    spentEl.textContent  = fmt(s);
    leftEl.textContent   = fmt(left);
    // bar width: percent spent but cap to 100%+
    const pct = b>0 ? Math.min(100,(s/b)*100) : 0;
    bar.style.width = `${pct}%`;
    bar.style.background = left >= 0
      ? 'linear-gradient(90deg,var(--accent2),var(--accent1))'
      : `linear-gradient(90deg,var(--warn),var(--danger))`;
    // chips (קיצורי דרך לסכומים)
    chips.innerHTML = '';
    [50,100,200].forEach(val=>{
      const c = document.createElement('button');
      c.type='button';
      c.className='chip';
      c.textContent = `+${val}₪`;
      c.addEventListener('click',()=>{ add(val); });
      chips.appendChild(c);
    });
  }

  function add(amount){
    const v = Number(amount);
    if(!v || isNaN(v)) return;
    data.spent[catKey] = (data.spent[catKey]||0) + v;
    data.history.push({ts:Date.now(), cat:catKey, amount:v});
    saveMonth(data);
    refresh();
    refreshSummary();
    celebrateIfOnTrack();
    input.value='';
  }

  addBtn.addEventListener('click', ()=> add(Number(input.value)));
  minusBtn.addEventListener('click', ()=>{
    const v = Number(input.value);
    if(!v || isNaN(v)) return;
    data.spent[catKey] = Math.max(0, (data.spent[catKey]||0) - v);
    saveMonth(data);
    refresh();
    refreshSummary();
    input.value='';
  });

  editBtn.addEventListener('click', ()=>{
    const current = data.budgets[catKey]||0;
    const next = prompt(`קבעי יעד חדש ל"${catKey}" (₪):`, current);
    if(next===null) return;
    const n = Number(next);
    if(Number.isFinite(n) && n>=0){
      data.budgets[catKey]=n;
      saveMonth(data);
      refresh();
      refreshSummary();
    }
  });

  parent.appendChild(node);
  refresh();
  return {refresh};
}

let current;
function refreshSummary(){
  const budgets = Object.values(current.budgets).reduce((a,b)=>a+(b||0),0);
  const spent   = Object.values(current.spent).reduce((a,b)=>a+(b||0),0);
  const left    = budgets - spent;
  sumBudgetEl.textContent = fmt(budgets)+' ₪';
  sumSpentEl.textContent  = fmt(spent)+' ₪';
  sumLeftEl.textContent   = fmt(left)+' ₪';
}

function celebrateIfOnTrack(){
  // מגע קטן של אופטימיות: אם אחרי עדכון נשארת בתוך היעד בכל הקטגוריות המשתנות – הבזק קטן :)
  const ok = VARIABLE_KEYS.every(k => (current.spent[k]||0) <= (current.budgets[k]||0));
  if(!ok) return;
  const spark = document.createElement('div');
  spark.style.position='fixed';
  spark.style.inset='0';
  spark.style.pointerEvents='none';
  spark.style.animation='fade .8s ease-out forwards';
  spark.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;">
    <div style="padding:8px 14px;border-radius:999px;background:#ecfeff;border:1px solid #a5f3fc;color:#0e7490;font-weight:700;box-shadow:0 10px 30px rgba(14,116,144,.15);">
      מעולה! את במסלול טוב 👏
    </div></div>`;
  document.body.appendChild(spark);
  setTimeout(()=>spark.remove(),800);
}
const style = document.createElement('style');
style.textContent = `@keyframes fade{from{opacity:0}20%{opacity:1}to{opacity:0}}`;
document.head.appendChild(style);

function boot(){
  // חודש ברירת מחדל = הנוכחי
  monthInput.value = nowMonthStr();
  current = loadMonth(monthInput.value);

  // רענון מסכים
  variableWrap.innerHTML='';
  fixedWrap.innerHTML='';

  const rows = [];
  VARIABLE_KEYS.forEach(k=> rows.push(renderCategory(variableWrap, current, k)));
  FIXED_KEYS.forEach(k=> rows.push(renderCategory(fixedWrap, current, k)));

  refreshSummary();
}

switchBtn.addEventListener('click', ()=>{
  current = loadMonth(monthInput.value);
  boot();
});

resetBtn.addEventListener('click', ()=>{
  if(!confirm('לאפס נתוני חודש זה?')) return;
  const fresh = {
    month: monthInput.value,
    budgets:{...DEFAULT_BUDGETS},
    spent:Object.fromEntries(Object.keys(DEFAULT_BUDGETS).map(k=>[k,0])),
    history:[]
  };
  localStorage.setItem(storageKey(monthInput.value), JSON.stringify(fresh));
  current = fresh;
  boot();
});

exportBtn.addEventListener('click', ()=>{
  const data = current;
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `budget-${data.month}.json`;
  a.click();
});

boot();
