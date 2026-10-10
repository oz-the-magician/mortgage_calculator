'use strict';

// ── STATE ─────────────────────────────────────────────────────
const DEFAULTS = {
  saleA: 8500000, mortA: 1000000, buyB: 12500000, comm: 350000,
  matcap: 960000, savings: 1500000, income: 200000, rate: 22, years: 30,
};
const MONEY_FIELDS = ['saleA', 'mortA', 'buyB', 'comm', 'matcap', 'savings', 'income'];

const state = {
  payType: 'ann',   // 'ann' | 'diff'
  view: 5,          // лет в графике ипотеки; Infinity — весь срок
  loans: [],        // { id, amount, rate, years }
};
let loanSeq = 0;

const $ = id => document.getElementById(id);

// ── FORMATTING ────────────────────────────────────────────────
const NBSP = ' ';
const fmtN = n => Math.round(n).toLocaleString('ru-RU');
const fmt  = n => fmtN(n) + NBSP + '₽';
const pct  = n => (+n).toFixed(1) + '%';
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const parseMoney = str => Number(String(str).replace(/\D/g, '')) || 0;

// Переформатирует поле с разделителями тысяч, сохраняя позицию курсора
function formatMoneyInput(el) {
  const caret = el.selectionStart ?? el.value.length;
  const digitsBefore = el.value.slice(0, caret).replace(/\D/g, '').length;
  const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  el.value = digits ? fmtN(Number(digits)) : '';
  if (document.activeElement !== el) return;
  let pos = 0, seen = 0;
  while (pos < el.value.length && seen < digitsBefore) {
    if (/\d/.test(el.value[pos])) seen++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}

function setMoney(el, n) { el.value = n ? fmtN(n) : ''; }

const money = id => parseMoney($(id).value);
const num   = id => parseFloat($(id).value) || 0;

// ── MATH ──────────────────────────────────────────────────────
function annuity(principal, ratePct, years) {
  if (principal <= 0 || years <= 0) return 0;
  const n = years * 12;
  if (ratePct <= 0) return principal / n;
  const r = ratePct / 100 / 12;
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

function diffStats(principal, ratePct, years) {
  if (principal <= 0 || years <= 0) return { first: 0, last: 0, total: 0 };
  const n = years * 12;
  const r = ratePct > 0 ? ratePct / 100 / 12 : 0;
  const prinPart = principal / n;
  // Сумма процентов: r × (P + P−p + … + p) = r × p × n(n+1)/2
  const total = principal + r * prinPart * n * (n + 1) / 2;
  return { first: prinPart + principal * r, last: prinPart * (1 + r), total };
}

function loanStats(principal, ratePct, years, type) {
  if (principal <= 0) return { monthly: 0, last: 0, total: 0 };
  if (type === 'diff') {
    const d = diffStats(principal, ratePct, years);
    return { monthly: d.first, last: d.last, total: d.total };
  }
  const m = annuity(principal, ratePct, years);
  return { monthly: m, last: m, total: m * years * 12 };
}

// Годовые строки графика погашения
function scheduleRows(principal, ratePct, totalYears, showYears, type) {
  if (principal <= 0 || totalYears <= 0) return '';
  const r = ratePct > 0 ? ratePct / 100 / 12 : 0;
  const n = totalYears * 12;
  const mp = annuity(principal, ratePct, totalYears);
  const prinFixed = principal / n;
  let balance = principal;
  const rows = [];
  for (let yr = 1; yr <= Math.min(showYears, totalYears); yr++) {
    let paid = 0, prin = 0, interest = 0;
    for (let m = 0; m < 12; m++) {
      const intPart = balance * r;
      const prinPart = type === 'diff' ? prinFixed : Math.min(mp - intPart, balance);
      paid += prinPart + intPart;
      interest += intPart;
      prin += prinPart;
      balance = Math.max(0, balance - prinPart);
    }
    const hl = yr % 5 === 0 ? ' class="yr-highlight"' : '';
    rows.push(
      `<tr${hl}><td>${yr}</td><td>${fmt(paid)}</td>` +
      `<td class="pos">${fmt(prin)}</td><td class="neg">${fmt(interest)}</td>` +
      `<td>${fmt(balance)}</td><td class="muted">${pct((principal - balance) / principal * 100)}</td></tr>`
    );
  }
  return rows.join('');
}

const tableHead =
  '<thead><tr><th scope="col">Год</th><th scope="col">Платёж/год</th><th scope="col">Осн. долг</th>' +
  '<th scope="col">Проценты</th><th scope="col">Остаток</th><th scope="col">% погашено</th></tr></thead>';

// ── LOANS UI ──────────────────────────────────────────────────
function renderLoans() {
  $('loansContainer').innerHTML = state.loans.map((l, i) => `
    <section class="card loan-block" data-loan="${l.id}" aria-label="Займ ${i + 1}">
      <div class="loan-header">
        <span class="loan-tag">займ ${i + 1}</span>
        <button type="button" class="loan-remove no-print" data-remove="${l.id}" aria-label="Удалить займ ${i + 1}">×</button>
      </div>
      <div class="grid3 grid-tight">
        <div class="field"><label for="la_${l.id}">Сумма, ₽</label>
          <input class="money" id="la_${l.id}" data-field="amount" inputmode="numeric" autocomplete="off" value="${l.amount ? fmtN(l.amount) : ''}"></div>
        <div class="field"><label for="lr_${l.id}">Ставка, %/год</label>
          <input type="number" id="lr_${l.id}" data-field="rate" step="0.5" min="0" value="${l.rate}"></div>
        <div class="field"><label for="ly_${l.id}">Срок, лет</label>
          <input type="number" id="ly_${l.id}" data-field="years" step="1" min="1" max="30" value="${l.years}"></div>
      </div>
      <div class="loan-result" id="lres_${l.id}" hidden>
        <div class="row row-total"><span class="row-label">Платёж/мес</span><span class="row-value pos" id="lm_${l.id}">—</span></div>
        <div class="row"><span class="row-label">Переплата</span><span class="row-value neg" id="lo_${l.id}">—</span></div>
      </div>
    </section>`).join('');
}

function addLoan(data = {}) {
  state.loans.push({ id: ++loanSeq, amount: 0, rate: 0, years: 3, ...data });
}

$('addLoanBtn').addEventListener('click', () => {
  addLoan();
  renderLoans();
  calc();
  $('la_' + loanSeq).focus();
});

$('loansContainer').addEventListener('click', e => {
  const id = Number(e.target.closest('[data-remove]')?.dataset.remove);
  if (!id) return;
  state.loans = state.loans.filter(l => l.id !== id);
  renderLoans();
  calc();
});

$('loansContainer').addEventListener('input', e => {
  const card = e.target.closest('[data-loan]');
  const field = e.target.dataset.field;
  if (!card || !field) return;
  const loan = state.loans.find(l => l.id === Number(card.dataset.loan));
  if (field === 'amount') { formatMoneyInput(e.target); loan.amount = parseMoney(e.target.value); }
  if (field === 'rate')   loan.rate  = Math.max(0, parseFloat(e.target.value) || 0);
  if (field === 'years')  loan.years = Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1));
  calc();
});

// ── MAIN CALC ─────────────────────────────────────────────────
function setText(id, text) { $(id).textContent = text; }

function calc() {
  const saleA = money('saleA'), mortA = money('mortA'), buyB = money('buyB');
  const comm = money('comm'), matcap = money('matcap'), savings = money('savings');
  const income = money('income');
  const rate = Math.max(0, num('rate'));
  const years = parseInt($('years').value, 10) || DEFAULTS.years;

  setText('yearsOut', years + NBSP + plural(years, 'год', 'года', 'лет'));

  const loans = state.loans.filter(l => l.amount > 0);
  const loansAmt = loans.reduce((s, l) => s + l.amount, 0);

  // Баланс сделки
  const netSale    = saleA - mortA;
  const totalAvail = netSale - comm + matcap + savings + loansAmt;
  const mortNeeded = Math.max(0, buyB - totalAvail);
  const surplus    = Math.max(0, totalAvail - buyB);
  // Первый взнос — только собственные средства: займы тоже долг
  const ownDown    = Math.max(0, buyB - mortNeeded - loansAmt);
  const downPctVal = buyB > 0 ? ownDown / buyB * 100 : 0;

  setText('saleAout', fmt(saleA));
  setText('mortAout', '−' + NBSP + fmt(mortA));
  $('netSale').innerHTML = fmt(netSale) +
    (netSale < 0 ? '<span class="badge badge-warn">долг больше цены</span>' : '');
  setText('commOut', '−' + NBSP + fmt(comm));
  setText('matcapOut', '+' + NBSP + fmt(matcap));
  setText('savingsOut', '+' + NBSP + fmt(savings));

  $('loansBalanceRows').innerHTML = state.loans.map((l, i) => l.amount > 0
    ? `<div class="row"><span class="row-label">Плюс займ${NBSP}${i + 1}</span><span class="row-value pos">+${NBSP}${fmt(l.amount)}</span></div>`
    : '').join('');

  setText('totalAvail', fmt(totalAvail));
  setText('buyBOut', fmt(buyB));
  setText('mortNeeded', fmt(mortNeeded));
  $('surplusRow').hidden = surplus <= 0;
  setText('surplus', '+' + NBSP + fmt(surplus));
  setText('downPctLabel', loansAmt > 0 ? 'Первый взнос (без займов)' : 'Первый взнос');
  $('downPct').innerHTML = pct(downPctVal) + (downPctVal < 20
    ? `<span class="badge badge-warn">&lt;${NBSP}20%</span>`
    : '<span class="badge badge-ok">норма</span>');

  // Ипотека
  const mort = loanStats(mortNeeded, rate, years, state.payType);
  $('monthly').innerHTML = mort.monthly > 0
    ? fmt(mort.monthly) + (state.payType === 'diff' ? `<span class="sub-value">→ ${fmt(mort.last)} к концу</span>` : '')
    : '—';

  // Займы — всегда аннуитет
  let loansMonthly = 0, loansTotal = 0;
  state.loans.forEach(l => {
    const s = loanStats(l.amount, l.rate, l.years, 'ann');
    loansMonthly += s.monthly;
    loansTotal   += s.total;
    $('lres_' + l.id).hidden = l.amount <= 0;
    setText('lm_' + l.id, fmt(s.monthly));
    setText('lo_' + l.id, fmt(s.total - l.amount));
  });

  $('loansAmortContainer').innerHTML = state.loans.map((l, i) => l.amount > 0 ? `
    <section class="section card loan-block" aria-label="График займа ${i + 1}">
      <h2 class="card-title">График займа${NBSP}${i + 1}</h2>
      <div class="table-wrap"><table>${tableHead}
        <tbody>${scheduleRows(l.amount, l.rate, l.years, Infinity, 'ann')}</tbody>
      </table></div>
    </section>` : '').join('');

  // Итоговые показатели
  const subLabel = loansAmt > 0 ? `ипотека${NBSP}+${NBSP}займы` : `по${NBSP}ипотеке`;
  const combMonthly = mort.monthly + loansMonthly;
  const combTotal   = mort.total + loansTotal;
  const combOverpay = combTotal - mortNeeded - loansAmt;

  $('totalMonthly').innerHTML = combMonthly > 0
    ? fmt(combMonthly) + (state.payType === 'diff' && mortNeeded > 0
        ? `<span class="sub-value">→${NBSP}${fmt(mort.last + loansMonthly)}</span>` : '')
    : '—';
  setText('totalMonthlySub', (state.payType === 'diff' ? 'дифф. · ' : '') + subLabel);
  setText('overpay', combOverpay > 0 ? fmt(combOverpay) : '—');
  setText('overpaySub', subLabel);
  setText('totalPay', combTotal > 0 ? fmt(combTotal) : '—');
  setText('totalPaySub', subLabel);

  const burdenEl = $('burden');
  if (income > 0 && combMonthly > 0) {
    const b = combMonthly / income * 100;
    burdenEl.textContent = pct(b);
    burdenEl.style.color = b > 50 ? 'var(--red)' : b > 35 ? 'var(--amber)' : 'var(--green)';
    setText('burdenNote', state.payType === 'diff' ? '1-й платёж' : subLabel);
  } else {
    burdenEl.textContent = '—';
    burdenEl.style.color = '';
    setText('burdenNote', '');
  }

  setText('footerPayType', state.payType === 'diff' ? 'Дифференцированный платёж' : 'Аннуитетный платёж');
  $('amortBody').innerHTML = scheduleRows(mortNeeded, rate, years, state.view, state.payType);

  saveToUrl();
}

// ── CONTROLS ──────────────────────────────────────────────────
function setPressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
}

function setPayType(t) {
  state.payType = t === 'diff' ? 'diff' : 'ann';
  setPressed('.pay-btn', 'pay', state.payType);
}

function setView(v) {
  state.view = v === 'all' ? Infinity : (Number(v) || 5);
  setPressed('.tab', 'view', state.view === Infinity ? 'all' : state.view);
}

document.querySelectorAll('.pay-btn').forEach(b =>
  b.addEventListener('click', () => { setPayType(b.dataset.pay); calc(); }));
document.querySelectorAll('.tab').forEach(b =>
  b.addEventListener('click', () => { setView(b.dataset.view); calc(); }));

MONEY_FIELDS.forEach(id => $(id).addEventListener('input', e => {
  formatMoneyInput(e.target);
  if (id === 'income') $('incomeRange').value = parseMoney(e.target.value);
  calc();
}));
$('incomeRange').addEventListener('input', e => { setMoney($('income'), Number(e.target.value)); calc(); });
$('rate').addEventListener('input', calc);
$('years').addEventListener('input', calc);

// ── URL STATE ─────────────────────────────────────────────────
// Параметры расчёта живут в адресе, поэтому ссылкой можно поделиться
function saveToUrl() {
  const p = new URLSearchParams();
  MONEY_FIELDS.forEach(id => p.set(id, money(id)));
  p.set('rate', num('rate'));
  p.set('years', $('years').value);
  if (state.payType !== 'ann') p.set('pay', state.payType);
  if (state.view !== 5) p.set('view', state.view === Infinity ? 'all' : state.view);
  const loans = state.loans.filter(l => l.amount > 0);
  if (loans.length) p.set('loans', loans.map(l => [l.amount, l.rate, l.years].join('_')).join('~'));
  history.replaceState(null, '', '#' + p.toString());
}

function loadFromUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const get = (k, def) => p.has(k) && isFinite(parseFloat(p.get(k))) ? parseFloat(p.get(k)) : def;

  MONEY_FIELDS.forEach(id => setMoney($(id), Math.max(0, get(id, DEFAULTS[id]))));
  $('rate').value = get('rate', DEFAULTS.rate);
  $('years').value = Math.min(30, Math.max(1, Math.round(get('years', DEFAULTS.years))));
  $('incomeRange').value = money('income');
  setPayType(p.get('pay'));
  setView(p.get('view') || 5);

  (p.get('loans') || '').split('~').filter(Boolean).forEach(s => {
    const [amount, rate, years] = s.split('_').map(Number);
    if (amount > 0) addLoan({ amount, rate: Math.max(0, rate || 0), years: Math.min(30, Math.max(1, years || 3)) });
  });
  renderLoans();
}

$('shareBtn').addEventListener('click', async () => {
  const label = $('shareLabel');
  try {
    await navigator.clipboard.writeText(location.href);
    label.textContent = 'Скопировано';
  } catch {
    window.prompt('Скопируйте ссылку на расчёт:', location.href);
  }
  setTimeout(() => { label.textContent = 'Ссылка на расчёт'; }, 2000);
});

// ── PRINT / PDF ───────────────────────────────────────────────
// Печать браузера даёт векторный PDF с выделяемым текстом
$('printBtn').addEventListener('click', () => {
  stamp();
  window.print();
});

function stamp() {
  const s = new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  setText('ts', s);
  setText('ts2', s);
}

// ── INIT ──────────────────────────────────────────────────────
stamp();
loadFromUrl();
calc();
