import { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  TrendingUp, TrendingDown, Trash2, ArrowLeft,
  Coffee, Sun, Moon, ChevronDown, ChevronUp,
  AlertTriangle, Sparkles, Edit3, X, Check,
  ClipboardList, BarChart3, Heart
} from 'lucide-react';

// ============ CONSTANTS ============
const MEALS = [
  { key: 'breakfast', name: '早餐', icon: Coffee },
  { key: 'lunch', name: '午餐', icon: Sun },
  { key: 'dinner', name: '晚餐', icon: Moon },
];

const CATEGORIES = [
  { key: 'staple', name: '主食', unit: '拳頭', mealTarget: 1, dailyTarget: 3, weeklyTarget: 21 },
  { key: 'vegetables', name: '蔬菜', unit: '拳頭', mealTarget: 2, dailyTarget: 6, weeklyTarget: 42 },
  { key: 'protein', name: '蛋白質', unit: '掌心', mealTarget: 1, dailyTarget: 3, weeklyTarget: 21 },
];

// 容差設定：日 0.1（嚴格）、週 1.0（放寬）
const DAILY_TOLERANCE = 0.1;
const WEEKLY_TOLERANCE = 1.0;

// ============ HELPERS ============
const parseLocal = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
};

const fmtDate = (d) => {
  const dt = d instanceof Date ? d : parseLocal(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayStr = () => fmtDate(new Date());

const fmtChinese = (dateStr) => {
  const d = parseLocal(dateStr);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} 週${week}`;
};

const fmtFullChinese = (dateStr) => {
  const d = parseLocal(dateStr);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${week}`;
};

const addDays = (dateStr, n) => {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

const getWeekNumber = (startDate, date) => {
  const start = parseLocal(startDate);
  const target = parseLocal(date);
  const diffDays = Math.floor((target - start) / 86400000);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
};

const getWeekDates = (startDate, weekNumber) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(startDate, (weekNumber - 1) * 7 + i));
  }
  return dates;
};

const emptyMeal = () => ({ staple: 0, vegetables: 0, protein: 0, notes: '' });
const emptyDay = () => ({
  breakfast: emptyMeal(),
  lunch: emptyMeal(),
  dinner: emptyMeal(),
  badFoods: [],
});

const sumDay = (day) => {
  if (!day) return { staple: 0, vegetables: 0, protein: 0, badCount: 0, badPortions: 0 };
  let s = 0, v = 0, p = 0;
  ['breakfast', 'lunch', 'dinner'].forEach(m => {
    if (day[m]) {
      s += day[m].staple || 0;
      v += day[m].vegetables || 0;
      p += day[m].protein || 0;
    }
  });
  const badPortions = day.badFoods ? day.badFoods.reduce((a, b) => a + (Number(b.portions) || 0), 0) : 0;
  const badCount = day.badFoods ? day.badFoods.length : 0;
  return { staple: s, vegetables: v, protein: p, badCount, badPortions };
};

const sumDays = (entries, dates) => {
  let t = { staple: 0, vegetables: 0, protein: 0, badCount: 0, badPortions: 0, daysLogged: 0 };
  dates.forEach(d => {
    if (entries[d]) {
      const ds = sumDay(entries[d]);
      t.staple += ds.staple;
      t.vegetables += ds.vegetables;
      t.protein += ds.protein;
      t.badCount += ds.badCount;
      t.badPortions += ds.badPortions;
      if (ds.staple > 0 || ds.vegetables > 0 || ds.protein > 0 || ds.badCount > 0) t.daysLogged++;
    }
  });
  return t;
};

const dayHasData = (day) => {
  if (!day) return false;
  const s = sumDay(day);
  return s.staple > 0 || s.vegetables > 0 || s.protein > 0 || s.badCount > 0;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ============ STORAGE ============
const storage = {
  async getClients() {
    try {
      const data = localStorage.getItem('nt_clients');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },
  async saveClients(clients) {
    try { localStorage.setItem('nt_clients', JSON.stringify(clients)); } catch (e) { console.error(e); }
  },
  async getEntries(clientId) {
    try {
      const data = localStorage.getItem(`nt_entries_${clientId}`);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },
  async saveEntries(clientId, entries) {
    try { localStorage.setItem(`nt_entries_${clientId}`, JSON.stringify(entries)); } catch (e) { console.error(e); }
  },
  async deleteClientData(clientId) {
    try { localStorage.removeItem(`nt_entries_${clientId}`); } catch {}
  },
};

// ============ DESIGN TOKENS / STYLES ============
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Manrope:wght@300;400;500;600;700;800&display=swap');

  .nt-app {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #2A2620;
    background: #F7F1E3;
    min-height: 100vh;
    background-image:
      radial-gradient(circle at 20% 10%, rgba(199, 118, 88, 0.06) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(61, 90, 64, 0.05) 0%, transparent 45%);
  }
  .nt-display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'ss01'; letter-spacing: -0.01em; }
  .nt-paper { background: #FFFBF1; border: 1px solid #E5DDC9; }
  .nt-paper-warm { background: #FBF5E5; border: 1px solid #E5DDC9; }
  .nt-divider { background: #E5DDC9; height: 1px; }
  .nt-btn { transition: all 0.18s ease; }
  .nt-btn:hover { transform: translateY(-1px); }
  .nt-btn:active { transform: translateY(0); }
  .nt-input {
    background: #FFFBF1;
    border: 1px solid #E5DDC9;
    color: #2A2620;
    transition: all 0.15s ease;
    font-family: 'Manrope', sans-serif;
  }
  .nt-input:focus { outline: none; border-color: #3D5A40; box-shadow: 0 0 0 3px rgba(61,90,64,0.1); }
  .nt-stepper-btn {
    background: #FFFBF1;
    border: 1px solid #E5DDC9;
    color: #3D5A40;
    transition: all 0.15s ease;
  }
  .nt-stepper-btn:hover:not(:disabled) { background: #3D5A40; color: #FFFBF1; border-color: #3D5A40; }
  .nt-stepper-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .nt-pill {
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .nt-card {
    background: #FFFBF1;
    border: 1px solid #E5DDC9;
    border-radius: 16px;
    transition: all 0.2s ease;
  }
  .nt-card:hover { box-shadow: 0 4px 20px rgba(61, 90, 64, 0.07); }
  .nt-tab {
    cursor: pointer;
    padding: 10px 4px;
    border-bottom: 2px solid transparent;
    color: #8B8275;
    font-weight: 500;
    transition: all 0.18s ease;
    white-space: nowrap;
  }
  .nt-tab:hover { color: #2A2620; }
  .nt-tab.active { color: #3D5A40; border-bottom-color: #3D5A40; }
  .nt-bar-track { background: #EFE7D2; border-radius: 999px; overflow: hidden; }
  .nt-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes nt-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .nt-fade-up { animation: nt-fade-up 0.4s ease-out both; }
  .nt-grain {
    position: relative;
  }
  .nt-grain::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
    border-radius: inherit;
  }
  /* Hide number input arrows */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
`;

// ============ SMALL COMPONENTS ============
const Stepper = ({ value, onChange, max = 10, step = 0.5, accent = '#3D5A40' }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(Math.max(0, value - step))}
      disabled={value <= 0}
      className="nt-stepper-btn rounded-full w-8 h-8 flex items-center justify-center text-base font-semibold"
      aria-label="減少"
    >−</button>
    <div className="min-w-[3rem] text-center font-semibold tabular-nums" style={{ fontSize: '17px', color: accent }}>
      {value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
    </div>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + step))}
      disabled={value >= max}
      className="nt-stepper-btn rounded-full w-8 h-8 flex items-center justify-center text-base font-semibold"
      aria-label="增加"
    >+</button>
  </div>
);

const ProgressBar = ({ value, target, color = '#3D5A40' }) => {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target;
  return (
    <div className="nt-bar-track" style={{ height: 6 }}>
      <div
        className="nt-bar-fill"
        style={{
          width: `${Math.min(100, pct)}%`,
          background: over ? '#C77658' : color,
        }}
      />
    </div>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    short:   { bg: '#FBE8DA', fg: '#A85A3F', text: '不足' },
    over:    { bg: '#F4E2D1', fg: '#A85A3F', text: '過量' },
    perfect: { bg: '#E0EAD8', fg: '#3D5A40', text: '達標' },
    none:    { bg: '#EFE7D2', fg: '#8B8275', text: '未填' },
  };
  const s = map[status] || map.none;
  return (
    <span className="nt-pill" style={{ background: s.bg, color: s.fg }}>{s.text}</span>
  );
};

// ============ MAIN APP ============
export default function App() {
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Manrope:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    (async () => {
      const list = await storage.getClients();
      setClients(list);
      setLoading(false);
    })();
  }, []);

  const persistClients = async (next) => {
    setClients(next);
    await storage.saveClients(next);
  };

  const addClient = async (name, startDate, notes) => {
    const newClient = {
      id: uid(),
      name: name.trim(),
      startDate: startDate || todayStr(),
      notes: (notes || '').trim(),
      createdAt: Date.now(),
    };
    await persistClients([...clients, newClient]);
    setShowAddClient(false);
    setActiveClientId(newClient.id);
  };

  const removeClient = async (id) => {
    await persistClients(clients.filter(c => c.id !== id));
    await storage.deleteClientData(id);
    if (activeClientId === id) setActiveClientId(null);
  };

  const updateClient = async (id, patch) => {
    await persistClients(clients.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const activeClient = clients.find(c => c.id === activeClientId);

  return (
    <div className="nt-app">
      <style>{styles}</style>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-stone-400">載入中…</div>
          </div>
        ) : !activeClient ? (
          <ClientListView
            clients={clients}
            onOpen={(id) => setActiveClientId(id)}
            onAdd={() => setShowAddClient(true)}
            onRemove={removeClient}
          />
        ) : (
          <ClientDetailView
            client={activeClient}
            onBack={() => setActiveClientId(null)}
            onUpdateClient={(patch) => updateClient(activeClient.id, patch)}
            onRemove={() => {
              if (window.confirm(`確定要刪除「${activeClient.name}」的所有資料嗎？此操作無法復原。`)) {
                removeClient(activeClient.id);
              }
            }}
          />
        )}

        {showAddClient && (
          <AddClientModal
            onClose={() => setShowAddClient(false)}
            onSubmit={addClient}
          />
        )}
      </main>
    </div>
  );
}

// ============ CLIENT LIST ============
function ClientListView({ clients, onOpen, onAdd, onRemove }) {
  return (
    <div className="nt-fade-up">
      <header className="mb-10 sm:mb-14">
        <div className="flex items-center gap-2 mb-3 text-sm" style={{ color: '#8B8275', letterSpacing: '0.12em' }}>
          <Heart size={14} style={{ color: '#C77658' }} />
          <span className="uppercase font-semibold">營養師工作台</span>
        </div>
        <h1 className="nt-display text-4xl sm:text-5xl md:text-6xl font-medium leading-[1.05] mb-3" style={{ color: '#2A2620' }}>
          每日<span style={{ fontStyle: 'italic', color: '#3D5A40' }}>飲食</span>追蹤
        </h1>
        <p className="text-base sm:text-lg max-w-xl leading-relaxed" style={{ color: '#5C5447' }}>
          以「拳頭．掌心」為單位追蹤客戶每日營養攝取，提供 12 週飲食調整依據與每週總結。
        </p>
      </header>

      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#8B8275' }}>客戶名單</div>
          <div className="nt-display text-2xl mt-1" style={{ color: '#2A2620' }}>
            {clients.length} <span style={{ color: '#8B8275', fontSize: 16 }}>位客戶</span>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="nt-btn flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm"
          style={{ background: '#3D5A40', color: '#FFFBF1' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          新增客戶
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="nt-card p-12 sm:p-16 text-center nt-grain">
          <div className="nt-display text-2xl mb-2" style={{ color: '#2A2620' }}>還沒有客戶</div>
          <p className="mb-6" style={{ color: '#5C5447' }}>點擊上方「新增客戶」開始你的第一份追蹤紀錄。</p>
          <button
            onClick={onAdd}
            className="nt-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm"
            style={{ background: '#3D5A40', color: '#FFFBF1' }}
          >
            <Plus size={16} strokeWidth={2.5} /> 新增第一位客戶
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c, i) => (
            <ClientCard key={c.id} client={c} onOpen={() => onOpen(c.id)} delay={i * 60} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, onOpen, delay }) {
  const [todayEntries, setTodayEntries] = useState(null);

  useEffect(() => {
    (async () => {
      const e = await storage.getEntries(client.id);
      setTodayEntries(e);
    })();
  }, [client.id]);

  const week = getWeekNumber(client.startDate, todayStr());
  const weekDisplay = week < 1 ? '尚未開始' : week > 12 ? '已完成 12 週' : `第 ${week} / 12 週`;
  const progressPct = Math.max(0, Math.min(100, (week / 12) * 100));

  const todayKey = todayStr();
  const todaySum = todayEntries ? sumDay(todayEntries[todayKey]) : null;

  return (
    <button
      onClick={onOpen}
      className="nt-card text-left p-5 nt-fade-up cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="nt-display text-xl font-semibold leading-tight" style={{ color: '#2A2620' }}>
            {client.name}
          </div>
          <div className="text-xs mt-1" style={{ color: '#8B8275' }}>
            起始 {client.startDate}
          </div>
        </div>
        <div
          className="rounded-full w-10 h-10 flex items-center justify-center"
          style={{ background: '#FBF5E5', color: '#3D5A40' }}
        >
          <span className="nt-display text-sm font-semibold">
            {client.name.slice(0, 1)}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: '#5C5447' }} className="font-medium">{weekDisplay}</span>
          <span className="tabular-nums" style={{ color: '#8B8275' }}>{Math.round(progressPct)}%</span>
        </div>
        <ProgressBar value={progressPct} target={100} color="#3D5A40" />
      </div>

      {todaySum && (
        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px dashed #E5DDC9' }}>
          <div className="text-xs" style={{ color: '#8B8275' }}>今日</div>
          <div className="flex gap-2 text-xs font-medium tabular-nums" style={{ color: '#5C5447' }}>
            <span>主 {todaySum.staple}</span>
            <span>蔬 {todaySum.vegetables}</span>
            <span>蛋 {todaySum.protein}</span>
            {todaySum.badCount > 0 && (
              <span style={{ color: '#A85A3F' }}>壞 {todaySum.badCount} 項</span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

// ============ ADD CLIENT MODAL ============
function AddClientModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(42, 38, 32, 0.4)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nt-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 nt-fade-up"
        style={{ animation: 'nt-fade-up 0.25s ease-out' }}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="nt-display text-2xl font-semibold" style={{ color: '#2A2620' }}>新增客戶</div>
            <div className="text-sm mt-1" style={{ color: '#8B8275' }}>建立 12 週的營養追蹤紀錄</div>
          </div>
          <button onClick={onClose} className="nt-btn p-1.5 rounded-full" style={{ color: '#5C5447' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>客戶姓名</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：林小姐"
              className="nt-input w-full px-4 py-2.5 rounded-lg text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="nt-input w-full px-4 py-2.5 rounded-lg text-base"
            />
            <div className="text-xs mt-1.5" style={{ color: '#8B8275' }}>從這天開始計算 12 週服務期</div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>備註（選填）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="目標、過敏食物、注意事項…"
              rows={3}
              className="nt-input w-full px-4 py-2.5 rounded-lg text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="nt-btn flex-1 py-2.5 rounded-full font-semibold text-sm"
            style={{ background: 'transparent', color: '#5C5447', border: '1px solid #E5DDC9' }}
          >取消</button>
          <button
            onClick={() => name.trim() && onSubmit(name, startDate, notes)}
            disabled={!name.trim()}
            className="nt-btn flex-1 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50"
            style={{ background: '#3D5A40', color: '#FFFBF1' }}
          >建立</button>
        </div>
      </div>
    </div>
  );
}

// ============ CLIENT DETAIL ============
function ClientDetailView({ client, onBack, onUpdateClient, onRemove }) {
  const [tab, setTab] = useState('today');
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const e = await storage.getEntries(client.id);
      setEntries(e);
      setLoading(false);
    })();
  }, [client.id]);

  const persistEntry = async (date, dayData) => {
    const next = { ...entries, [date]: dayData };
    setEntries(next);
    await storage.saveEntries(client.id, next);
  };

  const currentWeek = getWeekNumber(client.startDate, todayStr());
  const weekStatus = currentWeek < 1 ? '尚未開始' : currentWeek > 12 ? '已完成' : `第 ${currentWeek} / 12 週`;

  return (
    <div className="nt-fade-up">
      <button
        onClick={onBack}
        className="nt-btn flex items-center gap-1.5 text-sm font-medium mb-6"
        style={{ color: '#5C5447' }}
      >
        <ArrowLeft size={16} /> 返回客戶名單
      </button>

      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest font-semibold" style={{ color: '#8B8275' }}>
          <span>客戶檔案</span>
          <span>·</span>
          <span style={{ color: '#3D5A40' }}>{weekStatus}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="nt-display text-4xl sm:text-5xl font-medium leading-[1.05]" style={{ color: '#2A2620' }}>
            {client.name}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingClient(true)}
              className="nt-btn flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'transparent', color: '#5C5447', border: '1px solid #E5DDC9' }}
            >
              <Edit3 size={13} /> 編輯
            </button>
            <button
              onClick={onRemove}
              className="nt-btn flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'transparent', color: '#A85A3F', border: '1px solid #F4D5C5' }}
            >
              <Trash2 size={13} /> 刪除
            </button>
          </div>
        </div>
        <div className="mt-3 text-sm flex flex-wrap gap-x-5 gap-y-1" style={{ color: '#5C5447' }}>
          <span>起始：{client.startDate}</span>
          <span>結束：{addDays(client.startDate, 83)}</span>
        </div>
        {client.notes && (
          <div className="mt-3 text-sm p-3 rounded-lg" style={{ background: '#FBF5E5', color: '#5C5447' }}>
            {client.notes}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-6 overflow-x-auto" style={{ borderColor: '#E5DDC9' }}>
        <div onClick={() => setTab('today')} className={`nt-tab flex items-center gap-1.5 ${tab === 'today' ? 'active' : ''}`}>
          <ClipboardList size={15} /> 每日輸入
        </div>
        <div onClick={() => setTab('weekly')} className={`nt-tab flex items-center gap-1.5 ${tab === 'weekly' ? 'active' : ''}`}>
          <BarChart3 size={15} /> 12 週總結
        </div>
        <div onClick={() => setTab('history')} className={`nt-tab flex items-center gap-1.5 ${tab === 'history' ? 'active' : ''}`}>
          <CalendarIcon size={15} /> 歷史紀錄
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center" style={{ color: '#8B8275' }}>載入中…</div>
      ) : (
        <>
          {tab === 'today' && (
            <DailyEntryView
              client={client}
              entries={entries}
              onSave={persistEntry}
            />
          )}
          {tab === 'weekly' && (
            <WeeklySummaryView client={client} entries={entries} />
          )}
          {tab === 'history' && (
            <HistoryView client={client} entries={entries} onPick={(date) => {}} />
          )}
        </>
      )}

      {editingClient && (
        <EditClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSave={(patch) => { onUpdateClient(patch); setEditingClient(false); }}
        />
      )}
    </div>
  );
}

function EditClientModal({ client, onClose, onSave }) {
  const [name, setName] = useState(client.name);
  const [startDate, setStartDate] = useState(client.startDate);
  const [notes, setNotes] = useState(client.notes || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(42, 38, 32, 0.4)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nt-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 sm:p-8"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="nt-display text-2xl font-semibold" style={{ color: '#2A2620' }}>編輯客戶</div>
          <button onClick={onClose} className="nt-btn p-1.5 rounded-full" style={{ color: '#5C5447' }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>客戶姓名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="nt-input w-full px-4 py-2.5 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>起始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="nt-input w-full px-4 py-2.5 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#5C5447' }}>備註</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="nt-input w-full px-4 py-2.5 rounded-lg text-sm resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="nt-btn flex-1 py-2.5 rounded-full font-semibold text-sm" style={{ background: 'transparent', color: '#5C5447', border: '1px solid #E5DDC9' }}>取消</button>
          <button onClick={() => name.trim() && onSave({ name: name.trim(), startDate, notes: notes.trim() })} className="nt-btn flex-1 py-2.5 rounded-full font-semibold text-sm" style={{ background: '#3D5A40', color: '#FFFBF1' }}>儲存</button>
        </div>
      </div>
    </div>
  );
}

// ============ DAILY ENTRY ============
function DailyEntryView({ client, entries, onSave }) {
  const [date, setDate] = useState(todayStr());
  const day = entries[date] || emptyDay();

  const updateMeal = (mealKey, mealData) => {
    const next = { ...day, [mealKey]: { ...day[mealKey], ...mealData } };
    onSave(date, next);
  };

  const addBadFood = (food) => {
    const next = { ...day, badFoods: [...(day.badFoods || []), food] };
    onSave(date, next);
  };

  const removeBadFood = (idx) => {
    const next = { ...day, badFoods: (day.badFoods || []).filter((_, i) => i !== idx) };
    onSave(date, next);
  };

  const updateBadFood = (idx, patch) => {
    const next = {
      ...day,
      badFoods: (day.badFoods || []).map((f, i) => i === idx ? { ...f, ...patch } : f),
    };
    onSave(date, next);
  };

  const summary = sumDay(day);

  return (
    <div className="space-y-6">
      {/* Date selector */}
      <div className="nt-card p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="nt-stepper-btn rounded-full w-9 h-9 flex items-center justify-center"
          ><ChevronLeft size={16} /></button>
          <div>
            <div className="nt-display text-lg sm:text-xl font-semibold" style={{ color: '#2A2620' }}>
              {fmtFullChinese(date)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#8B8275' }}>
              {(() => {
                const w = getWeekNumber(client.startDate, date);
                if (w < 1) return '尚未開始';
                if (w > 12) return '已超過 12 週';
                return `客戶第 ${w} 週 (Day ${Math.floor((parseLocal(date) - parseLocal(client.startDate)) / 86400000) + 1})`;
              })()}
            </div>
          </div>
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="nt-stepper-btn rounded-full w-9 h-9 flex items-center justify-center"
          ><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="nt-input px-3 py-1.5 rounded-lg text-sm"
          />
          {date !== todayStr() && (
            <button
              onClick={() => setDate(todayStr())}
              className="nt-btn text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: '#FBF5E5', color: '#3D5A40' }}
            >今天</button>
          )}
        </div>
      </div>

      {/* Daily Summary */}
      <DailySummaryCard day={day} summary={summary} />

      {/* Meals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {MEALS.map(meal => (
          <MealCard
            key={meal.key}
            meal={meal}
            data={day[meal.key]}
            onChange={(patch) => updateMeal(meal.key, patch)}
          />
        ))}
      </div>

      {/* Bad foods */}
      <BadFoodsSection
        items={day.badFoods || []}
        onAdd={addBadFood}
        onRemove={removeBadFood}
        onUpdate={updateBadFood}
      />
    </div>
  );
}

function DailySummaryCard({ day, summary }) {
  const dailyTargets = { staple: 3, vegetables: 6, protein: 3 };
  const hasAnyData = dayHasData(day);

  const getStatus = (val, target) => {
    if (val === 0) return 'none';
    const diff = val - target;
    if (Math.abs(diff) <= DAILY_TOLERANCE) return 'perfect';
    if (diff > 0) return 'over';
    return 'short';
  };

  // Build discussion talking points
  const talkingPoints = useMemo(() => {
    const points = [];
    CATEGORIES.forEach(cat => {
      const val = summary[cat.key];
      const target = dailyTargets[cat.key];
      const diff = val - target;
      if (val === 0) {
        points.push({ kind: 'warn', text: `今日完全沒有${cat.name}（建議 ${target} ${cat.unit}）` });
      } else if (Math.abs(diff) <= DAILY_TOLERANCE) {
        points.push({ kind: 'good', text: `${cat.name}達標 ✓` });
      } else if (diff < 0) {
        points.push({ kind: 'short', text: `${cat.name}不足 ${Math.abs(diff).toFixed(1)} ${cat.unit}（已 ${val}，建議 ${target}）` });
      } else {
        points.push({ kind: 'over', text: `${cat.name}過量 ${diff.toFixed(1)} ${cat.unit}（已 ${val}，建議 ${target}）` });
      }
    });
    if (summary.badCount > 0) {
      points.push({ kind: 'bad', text: `今日攝取壞食物 ${summary.badCount} 項，共 ${summary.badPortions} 份` });
    }
    return points;
  }, [summary]);

  return (
    <div className="nt-card p-5 sm:p-6 nt-grain" style={{ background: '#FBF5E5' }}>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#8B8275' }}>本日彙總</div>
          <div className="nt-display text-xl sm:text-2xl font-semibold" style={{ color: '#2A2620' }}>
            營養缺口分析
          </div>
        </div>
        {hasAnyData && (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: '#FFFBF1', color: '#5C5447' }}>
            <Sparkles size={13} style={{ color: '#3D5A40' }} />
            <span>可作為跟客戶討論的依據</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {CATEGORIES.map(cat => {
          const val = summary[cat.key];
          const target = dailyTargets[cat.key];
          const status = getStatus(val, target);
          const diff = val - target;
          return (
            <div key={cat.key} className="p-4 rounded-xl" style={{ background: '#FFFBF1', border: '1px solid #E5DDC9' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold" style={{ color: '#5C5447' }}>{cat.name}</div>
                <StatusPill status={status} />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="nt-display text-3xl font-semibold tabular-nums" style={{ color: '#2A2620' }}>
                  {val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}
                </span>
                <span className="text-sm" style={{ color: '#8B8275' }}>/ {target} {cat.unit}</span>
              </div>
              <ProgressBar value={val} target={target} color="#3D5A40" />
              {val > 0 && Math.abs(diff) > DAILY_TOLERANCE && (
                <div className="mt-2 text-xs flex items-center gap-1" style={{ color: diff > 0 ? '#A85A3F' : '#A85A3F' }}>
                  {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {diff > 0 ? `多 ${diff.toFixed(1)}` : `少 ${Math.abs(diff).toFixed(1)}`} {cat.unit}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bad foods summary */}
      {summary.badCount > 0 && (
        <div className="p-3 rounded-xl flex items-center gap-3 mb-5" style={{ background: '#FBE8DA', border: '1px solid #F4D5C5' }}>
          <AlertTriangle size={18} style={{ color: '#A85A3F' }} />
          <div className="flex-1 text-sm" style={{ color: '#A85A3F' }}>
            <span className="font-semibold">壞食物 {summary.badCount} 項</span>
            <span className="ml-2">共 {summary.badPortions} 份</span>
          </div>
        </div>
      )}

      {/* Talking points */}
      {hasAnyData && talkingPoints.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#8B8275' }}>討論重點</div>
          <ul className="space-y-1.5">
            {talkingPoints.map((p, i) => {
              const colors = {
                good: { bg: '#E0EAD8', fg: '#3D5A40' },
                warn: { bg: '#F4E2D1', fg: '#A85A3F' },
                short: { bg: '#F4E2D1', fg: '#A85A3F' },
                over: { bg: '#F4E2D1', fg: '#A85A3F' },
                bad: { bg: '#FBE8DA', fg: '#A85A3F' },
              }[p.kind];
              return (
                <li key={i} className="text-sm flex items-start gap-2 p-2 rounded-lg" style={{ background: colors.bg, color: colors.fg }}>
                  <span style={{ marginTop: 1 }}>•</span>
                  <span className="flex-1 font-medium">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hasAnyData && (
        <div className="text-center py-4 text-sm" style={{ color: '#8B8275' }}>
          尚未填入今日飲食，請從下方輸入三餐
        </div>
      )}
    </div>
  );
}

function MealCard({ meal, data, onChange }) {
  const Icon = meal.icon;
  const filled = data && (data.staple > 0 || data.vegetables > 0 || data.protein > 0);

  return (
    <div className="nt-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="rounded-full w-9 h-9 flex items-center justify-center"
            style={{ background: '#FBF5E5', color: '#3D5A40' }}
          >
            <Icon size={17} />
          </div>
          <div>
            <div className="nt-display text-lg font-semibold" style={{ color: '#2A2620' }}>{meal.name}</div>
            <div className="text-xs" style={{ color: '#8B8275' }}>建議 1 拳主食 / 2 拳蔬菜 / 1 掌心蛋白質</div>
          </div>
        </div>
        {filled && <Check size={16} style={{ color: '#3D5A40' }} />}
      </div>

      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const val = data?.[cat.key] || 0;
          const onTarget = Math.abs(val - cat.mealTarget) <= DAILY_TOLERANCE && val > 0;
          return (
            <div key={cat.key} className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-2" style={{ color: '#2A2620' }}>
                  {cat.name}
                  <span className="text-xs font-normal" style={{ color: '#8B8275' }}>
                    建議 {cat.mealTarget} {cat.unit}
                  </span>
                  {onTarget && <Check size={12} style={{ color: '#3D5A40' }} />}
                </div>
              </div>
              <Stepper
                value={val}
                onChange={(v) => onChange({ [cat.key]: v })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px dashed #E5DDC9' }}>
        <input
          type="text"
          placeholder="這餐吃了什麼？（選填備註）"
          value={data?.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="nt-input w-full px-3 py-2 rounded-lg text-sm"
        />
      </div>
    </div>
  );
}

function BadFoodsSection({ items, onAdd, onRemove, onUpdate }) {
  const [name, setName] = useState('');
  const [portions, setPortions] = useState(1);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), portions });
    setName('');
    setPortions(1);
  };

  const totalPortions = useMemo(
    () => items.reduce((a, b) => a + (Number(b.portions) || 0), 0),
    [items]
  );

  return (
    <div className="nt-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={17} style={{ color: '#A85A3F' }} />
        <div className="nt-display text-xl font-semibold" style={{ color: '#2A2620' }}>壞食物紀錄</div>
      </div>
      <div className="text-xs mb-4" style={{ color: '#8B8275' }}>
        紀錄客戶今日攝取的非建議食物（油炸、含糖飲料、加工食品等）
      </div>

      {/* Add form */}
      <div className="space-y-3 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="食物名稱（例：珍奶、炸雞、蛋糕）"
          className="nt-input w-full px-3 py-2.5 rounded-lg text-sm"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 nt-input rounded-lg px-3 py-1">
            <span className="text-xs whitespace-nowrap" style={{ color: '#8B8275' }}>份數</span>
            <Stepper
              value={portions}
              onChange={setPortions}
              max={20}
              step={0.5}
              accent="#A85A3F"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="nt-btn px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50 ml-auto"
            style={{ background: '#A85A3F', color: '#FFFBF1' }}
          >
            <Plus size={15} /> 加入
          </button>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-sm rounded-lg" style={{ background: '#FBF5E5', color: '#8B8275' }}>
          今日尚未紀錄任何壞食物
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-3 rounded-lg flex-wrap"
              style={{ background: '#FBF5E5', border: '1px solid #E5DDC9' }}
            >
              <div className="flex-1 min-w-0 font-medium truncate" style={{ color: '#2A2620' }}>
                {item.name}
              </div>
              <div className="flex items-center gap-2">
                <Stepper
                  value={Number(item.portions) || 0}
                  onChange={(v) => onUpdate(i, { portions: v })}
                  max={20}
                  step={0.5}
                  accent="#A85A3F"
                />
                <span className="text-xs font-medium" style={{ color: '#5C5447' }}>份</span>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="nt-btn p-1.5 rounded-full"
                style={{ color: '#A85A3F' }}
                aria-label="刪除"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-2 text-sm font-medium" style={{ color: '#A85A3F' }}>
            合計 {items.length} 項 · {totalPortions % 1 === 0 ? totalPortions.toFixed(0) : totalPortions.toFixed(1)} 份
          </div>
        </div>
      )}
    </div>
  );
}


// ============ WEEKLY SUMMARY ============
function WeeklySummaryView({ client, entries }) {
  const weeks = useMemo(() => {
    const arr = [];
    for (let w = 1; w <= 12; w++) {
      const dates = getWeekDates(client.startDate, w);
      const totals = sumDays(entries, dates);
      arr.push({
        weekNumber: w,
        startDate: dates[0],
        endDate: dates[6],
        ...totals,
      });
    }
    return arr;
  }, [client.startDate, entries]);

  const overall = useMemo(() => {
    let s = 0, v = 0, p = 0, bp = 0, bc = 0, days = 0;
    weeks.forEach(w => {
      s += w.staple; v += w.vegetables; p += w.protein;
      bp += w.badPortions; bc += w.badCount; days += w.daysLogged;
    });
    return { staple: s, vegetables: v, protein: p, badPortions: bp, badCount: bc, daysLogged: days };
  }, [weeks]);

  const today = todayStr();

  return (
    <div className="space-y-6">
      {/* Overall stats */}
      <div className="nt-card p-5 sm:p-6 nt-grain" style={{ background: '#FBF5E5' }}>
        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#8B8275' }}>12 週總覽</div>
        <div className="nt-display text-2xl font-semibold mb-5" style={{ color: '#2A2620' }}>
          {client.name} 的整體紀錄
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => (
            <div key={cat.key} className="p-3 rounded-xl" style={{ background: '#FFFBF1' }}>
              <div className="text-xs font-medium mb-1" style={{ color: '#8B8275' }}>{cat.name}</div>
              <div className="nt-display text-2xl font-semibold tabular-nums" style={{ color: '#2A2620' }}>
                {overall[cat.key] % 1 === 0 ? overall[cat.key].toFixed(0) : overall[cat.key].toFixed(1)}
              </div>
              <div className="text-xs" style={{ color: '#8B8275' }}>{cat.unit} 累計</div>
            </div>
          ))}
          <div className="p-3 rounded-xl" style={{ background: '#FBE8DA' }}>
            <div className="text-xs font-medium mb-1" style={{ color: '#A85A3F' }}>壞食物</div>
            <div className="nt-display text-2xl font-semibold tabular-nums" style={{ color: '#A85A3F' }}>
              {overall.badPortions % 1 === 0 ? overall.badPortions.toFixed(0) : overall.badPortions.toFixed(1)}
            </div>
            <div className="text-xs" style={{ color: '#A85A3F' }}>份累計（{overall.badCount} 項）</div>
          </div>
        </div>
      </div>

      {/* Weeks */}
      <div className="space-y-3">
        {weeks.map((w) => (
          <WeekRow
            key={w.weekNumber}
            week={w}
            client={client}
            entries={entries}
            isPast={w.endDate < today}
            isCurrent={today >= w.startDate && today <= w.endDate}
          />
        ))}
      </div>
    </div>
  );
}

function WeekRow({ week, client, entries, isPast, isCurrent }) {
  const [expanded, setExpanded] = useState(isCurrent);

  const dailyAvg = week.daysLogged > 0 ? {
    staple: week.staple / week.daysLogged,
    vegetables: week.vegetables / week.daysLogged,
    protein: week.protein / week.daysLogged,
  } : { staple: 0, vegetables: 0, protein: 0 };

  // Talking points
  const points = useMemo(() => {
    const out = [];
    if (week.daysLogged === 0) {
      return [{ kind: 'none', text: '本週無資料' }];
    }
    CATEGORIES.forEach(cat => {
      const total = week[cat.key];
      const target = cat.weeklyTarget;
      const diff = total - target;
      const avg = total / 7;
      const targetAvg = cat.dailyTarget;
      if (Math.abs(diff) <= WEEKLY_TOLERANCE) {
        out.push({ kind: 'good', text: `${cat.name}：${total.toFixed(1)} ${cat.unit}（達標）` });
      } else if (diff < 0) {
        out.push({
          kind: 'short',
          text: `${cat.name}不足：累計 ${total.toFixed(1)} / ${target} ${cat.unit}（少 ${Math.abs(diff).toFixed(1)}），日均 ${avg.toFixed(1)} 應為 ${targetAvg}`,
        });
      } else {
        out.push({
          kind: 'over',
          text: `${cat.name}過量：累計 ${total.toFixed(1)} / ${target} ${cat.unit}（多 ${diff.toFixed(1)}），日均 ${avg.toFixed(1)} 應為 ${targetAvg}`,
        });
      }
    });
    if (week.badCount > 0) {
      out.push({
        kind: 'bad',
        text: `壞食物本週共 ${week.badCount} 項、${week.badPortions} 份`,
      });
    }
    return out;
  }, [week]);

  const status = isCurrent ? '當週' : isPast ? '已過' : '未到';
  const statusColor = isCurrent ? '#3D5A40' : isPast ? '#8B8275' : '#C7BFA8';

  return (
    <div className="nt-card overflow-hidden" style={{ borderColor: isCurrent ? '#3D5A40' : '#E5DDC9' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 sm:p-5 flex items-center gap-4 text-left"
      >
        <div
          className="rounded-xl w-12 h-12 flex flex-col items-center justify-center flex-shrink-0"
          style={{
            background: isCurrent ? '#3D5A40' : '#FBF5E5',
            color: isCurrent ? '#FFFBF1' : '#3D5A40',
          }}
        >
          <div className="text-[10px] font-medium opacity-80">WEEK</div>
          <div className="nt-display font-bold text-base leading-none">{week.weekNumber}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold" style={{ color: '#2A2620' }}>
              第 {week.weekNumber} 週
            </div>
            <span className="nt-pill" style={{ background: '#FBF5E5', color: statusColor }}>{status}</span>
            {week.daysLogged > 0 && (
              <span className="text-xs" style={{ color: '#8B8275' }}>
                · 已紀錄 {week.daysLogged}/7 天
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#8B8275' }}>
            {week.startDate} ~ {week.endDate}
          </div>
          {week.daysLogged > 0 && (
            <div className="flex gap-3 mt-2 text-xs font-medium tabular-nums flex-wrap">
              <span style={{ color: '#5C5447' }}>主食 {week.staple}</span>
              <span style={{ color: '#5C5447' }}>蔬菜 {week.vegetables}</span>
              <span style={{ color: '#5C5447' }}>蛋白質 {week.protein}</span>
              {week.badCount > 0 && (
                <span style={{ color: '#A85A3F' }}>壞食物 {week.badCount} 項</span>
              )}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={18} style={{ color: '#8B8275' }} /> : <ChevronDown size={18} style={{ color: '#8B8275' }} />}
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 nt-fade-up">
          <div className="nt-divider mb-4"></div>
          {/* Bars */}
          <div className="space-y-3 mb-5">
            {CATEGORIES.map(cat => {
              const val = week[cat.key];
              const target = cat.weeklyTarget;
              const pct = (val / target) * 100;
              const over = val > target + WEEKLY_TOLERANCE;
              const short = val < target - WEEKLY_TOLERANCE;
              return (
                <div key={cat.key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="text-sm font-medium" style={{ color: '#5C5447' }}>{cat.name}</div>
                    <div className="text-sm tabular-nums" style={{ color: '#5C5447' }}>
                      <span className="font-semibold" style={{ color: over || short ? '#A85A3F' : '#3D5A40' }}>
                        {val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}
                      </span>
                      <span style={{ color: '#8B8275' }}> / {target} {cat.unit}</span>
                      <span className="ml-2 text-xs" style={{ color: '#8B8275' }}>
                        ({Math.round(pct)}%)
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={val} target={target} color="#3D5A40" />
                </div>
              );
            })}
          </div>

          {/* Talking points */}
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#8B8275' }}>本週重點</div>
          <ul className="space-y-1.5">
            {points.map((p, i) => {
              const colors = {
                good: { bg: '#E0EAD8', fg: '#3D5A40' },
                short: { bg: '#F4E2D1', fg: '#A85A3F' },
                over: { bg: '#F4E2D1', fg: '#A85A3F' },
                bad: { bg: '#FBE8DA', fg: '#A85A3F' },
                none: { bg: '#FBF5E5', fg: '#8B8275' },
              }[p.kind];
              return (
                <li key={i} className="text-sm flex items-start gap-2 p-2.5 rounded-lg" style={{ background: colors.bg, color: colors.fg }}>
                  <span>•</span>
                  <span className="flex-1 font-medium">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============ HISTORY ============
function HistoryView({ client, entries }) {
  const sortedDates = useMemo(() => {
    return Object.keys(entries)
      .filter(d => dayHasData(entries[d]))
      .sort((a, b) => b.localeCompare(a));
  }, [entries]);

  if (sortedDates.length === 0) {
    return (
      <div className="nt-card p-12 text-center">
        <div className="nt-display text-xl mb-2" style={{ color: '#2A2620' }}>還沒有任何紀錄</div>
        <div className="text-sm" style={{ color: '#8B8275' }}>請至「每日輸入」開始填入飲食資料</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedDates.map((date, i) => {
        const day = entries[date];
        const s = sumDay(day);
        const w = getWeekNumber(client.startDate, date);
        return (
          <div key={date} className="nt-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="font-semibold" style={{ color: '#2A2620' }}>{fmtFullChinese(date)}</div>
                <div className="text-xs" style={{ color: '#8B8275' }}>
                  第 {w > 12 ? '—' : w < 1 ? '—' : w} 週
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="nt-pill" style={{ background: '#FBF5E5', color: '#5C5447' }}>主食 {s.staple}</span>
                <span className="nt-pill" style={{ background: '#FBF5E5', color: '#5C5447' }}>蔬菜 {s.vegetables}</span>
                <span className="nt-pill" style={{ background: '#FBF5E5', color: '#5C5447' }}>蛋白質 {s.protein}</span>
                {s.badCount > 0 && (
                  <span className="nt-pill" style={{ background: '#FBE8DA', color: '#A85A3F' }}>壞食物 {s.badCount} 項</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MEALS.map(m => {
                const md = day[m.key] || {};
                const Icon = m.icon;
                const filled = md.staple > 0 || md.vegetables > 0 || md.protein > 0;
                return (
                  <div key={m.key} className="text-xs p-2.5 rounded-lg" style={{ background: '#FBF5E5', opacity: filled ? 1 : 0.6 }}>
                    <div className="flex items-center gap-1.5 mb-1 font-semibold" style={{ color: '#5C5447' }}>
                      <Icon size={12} /> {m.name}
                    </div>
                    {filled ? (
                      <div className="tabular-nums" style={{ color: '#5C5447' }}>
                        主 {md.staple || 0} · 蔬 {md.vegetables || 0} · 蛋 {md.protein || 0}
                      </div>
                    ) : (
                      <div style={{ color: '#8B8275' }}>未填</div>
                    )}
                    {md.notes && <div className="mt-1 italic" style={{ color: '#8B8275' }}>「{md.notes}」</div>}
                  </div>
                );
              })}
            </div>

            {day.badFoods && day.badFoods.length > 0 && (
              <div className="mt-2 text-xs flex items-start gap-2 p-2.5 rounded-lg" style={{ background: '#FBE8DA' }}>
                <AlertTriangle size={12} style={{ color: '#A85A3F', marginTop: 2 }} />
                <div style={{ color: '#A85A3F' }}>
                  壞食物：{day.badFoods.map(b => `${b.name}(${b.portions} 份)`).join('、')}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}