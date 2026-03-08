"use client";
import { useState, useEffect, useRef } from "react";

// ============================================================
// CONFIG & DATA
// ============================================================
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const CATEGORIES = {
  URGENT: { label: "🔥 Urgent", color: "#FF4D4D" },
  ETUDES: { label: "📚 Études", color: "#4D9FFF" },
  TRAVAIL: { label: "💼 Travail", color: "#A78BFA" },
  PERSO:   { label: "🌱 Perso",  color: "#34D399" },
  IDEE:    { label: "💡 Idée",   color: "#FBBF24" },
  ACHAT:   { label: "🛒 Achat",  color: "#F472B6" },
};

const ENERGIE_CONFIG = {
  1: { label: "Épuisé·e",  color: "#6366f1", emoji: "🌑" },
  2: { label: "Mou·lle",   color: "#8b5cf6", emoji: "🌒" },
  3: { label: "Correct·e", color: "#3b82f6", emoji: "🌓" },
  4: { label: "Bien",      color: "#10b981", emoji: "🌔" },
  5: { label: "En forme!", color: "#f59e0b", emoji: "🌕" },
};

const ROUTINES_DATA = {
  matin: {
    label: "Routine Matin", emoji: "🌅", color: "#f59e0b",
    steps: [
      { id: "m1", label: "Rester allongé·e 2 min", emoji: "👁️", duree: 120, tip: "Pas d'écran. Juste respirer." },
      { id: "m2", label: "Boire un verre d'eau", emoji: "💧", duree: 60, tip: "Avant le café. Réhydrate le cerveau." },
      { id: "m3", label: "Lever et allumer la lumière", emoji: "💡", duree: 30, tip: "Signal lumineux = c'est parti." },
      { id: "m4", label: "Se laver le visage", emoji: "🚿", duree: 300, tip: "Active le corps sans effort." },
      { id: "m5", label: "Manger quelque chose", emoji: "🍳", duree: 600, tip: "Même petit. Le glucose aide la concentration." },
      { id: "m6", label: "Ouvrir le Brief du Jour", emoji: "📋", duree: 120, tip: "2 minutes de planification max." },
      { id: "m7", label: "Choisir UNE première tâche", emoji: "🎯", duree: 60, tip: "Une seule. La plus facile à démarrer." },
    ]
  },
  soir: {
    label: "Routine Après travail", emoji: "🌆", color: "#8b5cf6",
    steps: [
      { id: "s1", label: "Poser les affaires — 5 min off", emoji: "🎒", duree: 300, tip: "Signal 'c'est fini'. Pose tout." },
      { id: "s2", label: "Boisson chaude ou froide", emoji: "☕", duree: 180, tip: "Rituel sensoriel. Ancre la décompression." },
      { id: "s3", label: "5 min de mouvement", emoji: "🚶", duree: 300, tip: "Évacue le cortisol du travail." },
      { id: "s4", label: "Vider les notes du jour", emoji: "🧠", duree: 180, tip: "Libère la RAM mentale." },
      { id: "s5", label: "1 chose accomplie aujourd'hui", emoji: "✅", duree: 60, tip: "Le cerveau TDAH oublie ses victoires." },
      { id: "s6", label: "Préparer 1 truc pour demain", emoji: "🔮", duree: 120, tip: "Toi-du-soir aide toi-du-matin." },
    ]
  }
};

const CAPTURE_PROMPT = `Tu es un assistant de capture de tâches pour une personne TDAH. 
Analyse l'entrée brute et réponds UNIQUEMENT en JSON valide sans markdown :
{"action":"action claire max 10 mots","categorie":"URGENT|ETUDES|TRAVAIL|PERSO|IDEE|ACHAT","priorite":1,"temps":15,"emoji":"emoji pertinent"}
Priorité : 1=critique, 2=important, 3=peut attendre. Temps en minutes.`;

const BRIEF_PROMPT = `Tu es un coach TDAH bienveillant. Génère un plan de journée réaliste.
RÈGLES : max 5 tâches, alterner lourd/léger, pauses toutes les 45-60min, si énergie≤2 max 3 tâches.
Réponds UNIQUEMENT en JSON valide sans markdown :
{"message":"intro 2 phrases max","humeur_emoji":"emoji","conseil_jour":"conseil max 15 mots","plan":[{"heure":"09:00","type":"tache|pause","label":"nom court","duree":25,"emoji":"emoji","pourquoi":"raison max 8 mots"}],"taches_reportees":["tâche"],"mot_fin":"phrase motivante courte"}`;

const callClaude = async (system, userMsg) => {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages: [{ role: "user", content: userMsg }] })
  });
  const data = await res.json();
  return JSON.parse(data.content?.[0]?.text.replace(/```json|```/g, "").trim() || "{}");
};

const formatCountdown = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const formatTime = (s) => s >= 60 ? `${Math.floor(s/60)}min` : `${s}s`;

const STORAGE_KEY = "cerveau_plus_tasks";

// ============================================================
// CAPTURE VIEW
// ============================================================
function CaptureView({ tasks, setTasks }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("TOUT");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const capture = async () => {
    if (!input.trim() || loading) return;
    const raw = input.trim(); setInput(""); setLoading(true);
    try {
      const parsed = await callClaude(CAPTURE_PROMPT, raw);
      setTasks(prev => [{
        id: Date.now(), raw, action: parsed.action || raw,
        categorie: parsed.categorie || "PERSO", priorite: parsed.priorite || 3,
        temps: parsed.temps || "?", emoji: parsed.emoji || "📌",
        done: false, ts: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      }, ...prev].sort((a, b) => a.priorite - b.priorite));
    } catch {
      setTasks(prev => [{ id: Date.now(), raw, action: raw, categorie: "PERSO", priorite: 3, temps: "?", emoji: "📌", done: false, ts: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const filtered = filter === "TOUT" ? tasks : filter === "DONE" ? tasks.filter(i => i.done) : tasks.filter(i => i.categorie === filter && !i.done);
  const pending = tasks.filter(i => !i.done).length;

  return (
    <div>
      <div style={{ border: "1px solid #1a1a2e", borderRadius: 12, padding: "14px 16px", background: "#0e0e1c", marginBottom: 16, borderColor: loading ? "#4D9FFF44" : "#1a1a2e" }}>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); capture(); } }}
          placeholder="Jette ça ici... (Entrée pour capturer)" rows={2}
          style={{ width: "100%", background: "transparent", border: "none", color: "#e8e8f0", fontSize: 15, resize: "none", fontFamily: "inherit", lineHeight: 1.6, outline: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 9, color: loading ? "#4D9FFF" : "#333", letterSpacing: 1 }}>{loading ? "⟳ ANALYSE..." : "↵ ENTRÉE"}</span>
          <button onClick={capture} disabled={loading || !input.trim()} style={{ background: input.trim() && !loading ? "#4D9FFF" : "#1a1a2e", color: input.trim() && !loading ? "#000" : "#333", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1 }}>CAPTURER</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        {["TOUT", ...Object.keys(CATEGORIES), "DONE"].map(f => {
          const cat = CATEGORIES[f]; const isActive = filter === f;
          const count = f === "TOUT" ? tasks.length : f === "DONE" ? tasks.filter(i => i.done).length : tasks.filter(i => i.categorie === f && !i.done).length;
          return <button key={f} onClick={() => setFilter(f)} style={{ padding: "3px 8px", borderRadius: 20, fontSize: 9, letterSpacing: 1, color: isActive ? (cat?.color || "#fff") : "#444", border: `1px solid ${isActive ? (cat?.color || "#555") : "#222"}`, background: "transparent", fontFamily: "inherit", cursor: "pointer" }}>
            {f === "TOUT" ? `TOUT (${count})` : f === "DONE" ? `✓ (${count})` : `${cat.label} (${count})`}
          </button>;
        })}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "#2a2a3a", fontSize: 12, letterSpacing: 1 }}>
        {tasks.length === 0 ? "CERVEAU VIDE — C'EST BON." : "RIEN ICI."}
      </div>}

      {filtered.map(item => {
        const cat = CATEGORIES[item.categorie] || CATEGORIES.PERSO;
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", marginBottom: 7, borderRadius: 10, background: "#0e0e1c", border: `1px solid ${item.done ? "#1a1a1a" : cat.color + "22"}`, borderLeft: `3px solid ${item.done ? "#222" : cat.color}`, opacity: item.done ? 0.4 : 1 }}>
            <button onClick={() => setTasks(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))} style={{ width: 17, height: 17, borderRadius: 3, border: `1.5px solid ${item.done ? "#333" : cat.color}`, background: item.done ? "#333" : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, fontSize: 9, color: "#0f0f1a" }}>{item.done ? "✓" : ""}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: item.done ? "#444" : "#ddd", marginBottom: 4, textDecoration: item.done ? "line-through" : "none" }}>{item.emoji} {item.action}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: cat.color, border: `1px solid ${cat.color}33`, padding: "1px 5px", borderRadius: 10 }}>{cat.label}</span>
                <span style={{ fontSize: 9, color: item.priorite === 1 ? "#FF4D4D" : item.priorite === 2 ? "#FBBF24" : "#444" }}>{item.priorite === 1 ? "● CRITIQUE" : item.priorite === 2 ? "● IMPORTANT" : "● PEUT ATTENDRE"}</span>
                <span style={{ fontSize: 9, color: "#333" }}>⏱ {item.temps === "?" ? "?" : `${item.temps}min`}</span>
              </div>
            </div>
            <button onClick={() => setTasks(prev => prev.filter(i => i.id !== item.id))} style={{ background: "transparent", border: "none", color: "#2a2a3a", cursor: "pointer", fontSize: 16, padding: "0 2px" }} onMouseEnter={e => e.target.style.color = "#FF4D4D"} onMouseLeave={e => e.target.style.color = "#2a2a3a"}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// BRIEF VIEW
// ============================================================
function BriefView({ tasks }) {
  const [energie, setEnergie] = useState(3);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [donePlan, setDonePlan] = useState(new Set());

  const generatePlan = async () => {
    setLoading(true); setDonePlan(new Set());
    const taskList = tasks.filter(t => !t.done).map(t => `- ${t.action} (priorité:${t.priorite}, durée:${t.temps}min)`).join("\n") || "- Aucune tâche en attente";
    try {
      const result = await callClaude(BRIEF_PROMPT, `Heure: ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}\nÉnergie: ${energie}/5\nTâches:\n${taskList}`);
      setPlan(result);
    } catch { setPlan({ message: "Erreur de connexion.", plan: [], taches_reportees: [], mot_fin: "" }); }
    setLoading(false);
  };

  const ec = ENERGIE_CONFIG[energie];
  const totalTaches = plan?.plan?.filter(p => p.type === "tache").length || 0;
  const completedCount = plan?.plan?.filter(p => p.type === "tache" && donePlan.has(p.label)).length || 0;

  return (
    <div>
      <div style={{ background: "#0e0e1c", border: "1px solid #1a1a2e", borderRadius: 12, padding: "16px", marginBottom: 14 }}>
        <p style={{ fontSize: 9, color: "#444", letterSpacing: 2, margin: "0 0 12px" }}>COMMENT TU TE SENS CE MATIN ?</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(n => {
            const cfg = ENERGIE_CONFIG[n]; const active = energie === n;
            return <button key={n} onClick={() => { setEnergie(n); setPlan(null); }} style={{ flex: 1, padding: "8px 2px", borderRadius: 8, background: active ? cfg.color + "22" : "transparent", border: `1.5px solid ${active ? cfg.color : "#1a1a2e"}`, color: active ? cfg.color : "#333", fontFamily: "inherit", fontSize: 8, letterSpacing: 0.5, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 16 }}>{cfg.emoji}</span><span>{cfg.label}</span>
            </button>;
          })}
        </div>
      </div>

      <button onClick={generatePlan} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, marginBottom: 18, background: loading ? "#111" : `linear-gradient(135deg, ${ec.color}, ${ec.color}99)`, color: loading ? "#333" : "#000", border: "none", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer", fontWeight: 500 }}>
        {loading ? "⟳ GÉNÉRATION EN COURS..." : plan ? "↺ REGÉNÉRER" : `${ec.emoji} GÉNÉRER MON BRIEF`}
      </button>

      {plan && <>
        <div style={{ background: ec.color + "11", border: `1px solid ${ec.color}33`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{plan.humeur_emoji}</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#ddd", lineHeight: 1.6 }}>{plan.message}</p>
              <p style={{ margin: 0, fontSize: 9, color: ec.color, letterSpacing: 1 }}>💡 {plan.conseil_jour}</p>
            </div>
          </div>
        </div>

        {totalTaches > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2 }}>
            <div style={{ height: "100%", background: ec.color, borderRadius: 2, width: `${(completedCount/totalTaches)*100}%`, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 9, color: "#333", textAlign: "right", marginTop: 4 }}>{completedCount}/{totalTaches} tâches</div>
        </div>}

        {plan.plan?.map((item, i) => {
          const isDone = donePlan.has(item.label); const isPause = item.type === "pause";
          return <div key={i} onClick={() => !isPause && setDonePlan(prev => { const n = new Set(prev); n.has(item.label) ? n.delete(item.label) : n.add(item.label); return n; })}
            style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", marginBottom: 7, borderRadius: 9, background: isDone ? "#0a0a0a" : "#0e0e1c", border: `1px solid ${isDone ? "#111" : isPause ? "#111" : ec.color + "22"}`, borderLeft: `3px solid ${isDone ? "#222" : isPause ? "#1a1a2e" : ec.color}`, cursor: isPause ? "default" : "pointer", opacity: isDone ? 0.4 : 1, textDecoration: isDone ? "line-through" : "none" }}>
            <span style={{ fontSize: 9, color: "#333", width: 34, flexShrink: 0 }}>{item.heure}</span>
            <span style={{ fontSize: 13 }}>{item.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: isPause ? "#333" : "#ccc" }}>{item.label}</div>
              {item.pourquoi && !isPause && <div style={{ fontSize: 9, color: "#333", fontStyle: "italic", marginTop: 2 }}>→ {item.pourquoi}</div>}
            </div>
            <span style={{ fontSize: 9, color: "#333" }}>{item.duree}m</span>
          </div>;
        })}

        {plan.taches_reportees?.length > 0 && <div style={{ background: "#0a0a0a", border: "1px solid #111", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
          <p style={{ fontSize: 9, color: "#2a2a3a", letterSpacing: 2, margin: "0 0 6px" }}>REPORTÉ À DEMAIN</p>
          {plan.taches_reportees.map((t, i) => <p key={i} style={{ fontSize: 10, color: "#2a2a3a", margin: "2px 0" }}>— {t}</p>)}
        </div>}

        {plan.mot_fin && <p style={{ fontSize: 11, color: ec.color, textAlign: "center", fontStyle: "italic", marginTop: 16 }}>"{plan.mot_fin}"</p>}
      </>}
    </div>
  );
}

// ============================================================
// ROUTINES VIEW
// ============================================================
function RoutinesView() {
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(new Set());
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const intervalRef = useRef(null);

  const routine = activeRoutine ? ROUTINES_DATA[activeRoutine] : null;
  const steps = routine?.steps || [];
  const step = steps[currentStep];
  const color = routine?.color || "#4D9FFF";
  const progress = steps.length ? (done.size / steps.length) * 100 : 0;

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(intervalRef.current); setTimerActive(false); setTimerDone(true); return 0; } return t - 1; }), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerActive]);

  const startRoutine = (key) => { setActiveRoutine(key); setCurrentStep(0); setDone(new Set()); setTimerActive(false); setTimeLeft(0); setTimerDone(false); setCelebrating(false); };

  const completeStep = () => {
    const n = new Set(done); n.add(step.id); setDone(n);
    setTimerActive(false); setTimerDone(false); clearInterval(intervalRef.current);
    if (currentStep < steps.length - 1) { setTimeout(() => { setCurrentStep(s => s + 1); setTimeLeft(0); }, 200); }
    else setCelebrating(true);
  };

  if (!activeRoutine) return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {Object.entries(ROUTINES_DATA).map(([key, r]) => (
          <div key={key} onClick={() => startRoutine(key)} style={{ background: "#0e0e1c", border: `1px solid ${r.color}33`, borderTop: `3px solid ${r.color}`, borderRadius: 12, padding: "18px 14px", cursor: "pointer" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{r.emoji}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 9, color: "#444" }}>{r.steps.length} étapes · ~{Math.round(r.steps.reduce((a,s) => a+s.duree,0)/60)}min</div>
          </div>
        ))}
      </div>
      {Object.entries(ROUTINES_DATA).map(([key, r]) => (
        <div key={key} style={{ background: "#0a0a14", border: "1px solid #1a1a2e", borderRadius: 10, padding: "14px", marginBottom: 10 }}>
          <p style={{ fontSize: 9, color: r.color, letterSpacing: 2, margin: "0 0 8px" }}>{r.emoji} {r.label.toUpperCase()}</p>
          {r.steps.map((s, i) => <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: "#2a2a3a", width: 14 }}>{i+1}.</span>
            <span style={{ fontSize: 10, color: "#444" }}>{s.emoji} {s.label}</span>
            <span style={{ fontSize: 9, color: "#222", marginLeft: "auto" }}>{formatTime(s.duree)}</span>
          </div>)}
        </div>
      ))}
    </div>
  );

  if (celebrating) return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{routine.emoji}</div>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, color, margin: "0 0 8px" }}>TERMINÉ !</h2>
      <p style={{ fontSize: 11, color: "#666", marginBottom: 24 }}>{routine.label} complète ✓</p>
      <button onClick={() => setActiveRoutine(null)} style={{ padding: "12px 28px", borderRadius: 10, background: color, color: "#000", border: "none", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, cursor: "pointer" }}>← RETOUR</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setActiveRoutine(null)} style={{ background: "transparent", border: "none", color: "#444", fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1 }}>← RETOUR</button>
        <span style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>{done.size}/{steps.length}</span>
      </div>
      <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: "100%", background: color, borderRadius: 2, width: `${progress}%`, transition: "width 0.4s" }} />
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 20, flexWrap: "wrap" }}>
        {steps.map((s, i) => <div key={s.id} onClick={() => { setCurrentStep(i); setTimerActive(false); setTimerDone(false); }} style={{ width: 26, height: 26, borderRadius: 7, cursor: "pointer", background: done.has(s.id) ? color+"33" : "#111", border: `1.5px solid ${done.has(s.id) ? color : i===currentStep ? color : "#1a1a2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: done.has(s.id) ? 10 : 8, color: done.has(s.id) ? color : i===currentStep ? color : "#333" }}>
          {done.has(s.id) ? "✓" : i+1}
        </div>)}
      </div>
      {step && (
        <div style={{ background: "#0e0e1c", border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 14, padding: "20px" }}>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 8 }}>ÉTAPE {currentStep+1} / {steps.length}</div>
          <div style={{ fontSize: 28, marginBottom: 6 }}>{step.emoji}</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{step.label}</div>
          <div style={{ background: color+"11", borderRadius: 8, padding: "10px 12px", marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: color+"cc", margin: 0, fontStyle: "italic" }}>💬 {step.tip}</p>
          </div>
          {(timeLeft > 0 || timerActive) && <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 10px", border: `3px solid ${timerDone ? color : timerActive ? color+"66" : "#1a1a2e"}`, display: "flex", alignItems: "center", justifyContent: "center", background: timerDone ? color+"22" : "transparent" }}>
              <span style={{ fontSize: 18, color: timerDone ? color : "#ccc" }}>{timerDone ? "✓" : formatCountdown(timeLeft)}</span>
            </div>
          </div>}
          <div style={{ display: "flex", gap: 8 }}>
            {!timerActive && !timerDone && <button onClick={() => { setTimeLeft(step.duree); setTimerActive(true); setTimerDone(false); }} style={{ flex: 1, padding: "11px", borderRadius: 9, background: color+"22", color, border: "none", fontFamily: "inherit", fontSize: 10, letterSpacing: 1, cursor: "pointer" }}>⏱ {formatTime(step.duree)}</button>}
            {timerActive && <button onClick={() => { setTimerActive(false); clearInterval(intervalRef.current); }} style={{ flex: 1, padding: "11px", borderRadius: 9, background: "#1a1a2e", color: "#555", border: "none", fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}>⏸</button>}
            <button onClick={completeStep} style={{ flex: 2, padding: "11px", borderRadius: 9, background: color, color: "#000", border: "none", fontFamily: "inherit", fontSize: 10, letterSpacing: 1, fontWeight: 500, cursor: "pointer" }}>✓ FAIT</button>
          </div>
          <button onClick={() => { setTimerActive(false); clearInterval(intervalRef.current); if (currentStep < steps.length-1) { setCurrentStep(s => s+1); setTimeLeft(0); } }} style={{ width: "100%", marginTop: 7, padding: "7px", borderRadius: 7, background: "transparent", color: "#2a2a3a", border: "none", fontFamily: "inherit", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}>PASSER →</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP PRINCIPALE
// ============================================================
export default function CerveauPlus() {
  const [tab, setTab] = useState("brief");
  const [tasks, setTasks] = useState([]);

  // Persistance localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTasks(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

  const pending = tasks.filter(t => !t.done).length;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const TABS = [
    { key: "brief",    label: "Brief",    emoji: "📋" },
    { key: "capture",  label: "Capture",  emoji: "⚡", badge: pending },
    { key: "routines", label: "Routines", emoji: "🔄" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080810", fontFamily: "'DM Mono', monospace", color: "#e0e0f0", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1a1a2e; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0a0a14", borderBottom: "1px solid #1a1a2e", padding: "14px 20px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>CERVEAU<span style={{ color: "#4D9FFF" }}>+</span></span>
            <span style={{ fontSize: 9, color: "#333", marginLeft: 8, letterSpacing: 1 }}>{today.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />
            <span style={{ fontSize: 9, color: "#34D399", letterSpacing: 1 }}>{pending} TÂCHES</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 16px 100px" }}>
        {tab === "capture"  && <CaptureView tasks={tasks} setTasks={setTasks} />}
        {tab === "brief"    && <BriefView tasks={tasks} />}
        {tab === "routines" && <RoutinesView />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0a14", borderTop: "1px solid #1a1a2e", padding: "10px 16px 16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", gap: 8 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, background: active ? "#4D9FFF11" : "transparent", border: `1.5px solid ${active ? "#4D9FFF44" : "#1a1a2e"}`, fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
              {t.badge > 0 && <div style={{ position: "absolute", top: 6, right: 10, width: 14, height: 14, borderRadius: "50%", background: "#FF4D4D", fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{t.badge}</div>}
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <span style={{ fontSize: 9, color: active ? "#4D9FFF" : "#444", letterSpacing: 1 }}>{t.label.toUpperCase()}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
  );
}
