"use client";

import { useState, useEffect, useRef } from "react";

const EXAMPLE_IDEAS = [
  "AI tools for video editing in 2026",
  "Morning routine for productivity",
  "How to fix a leaky faucet",
  "Best budget cameras for beginners",
  "Learn Python in 30 days",
];

function AnimatedScore({ score, color }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    let start = 0;
    const duration = 1200;
    const step = 16;
    const increment = (score / duration) * step;
    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setCurrent(score);
        clearInterval(timer);
      } else {
        setCurrent(Math.floor(start));
      }
    }, step);
    return () => clearInterval(timer);
  }, [score]);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (current / 100) * circumference;

  return (
    <div style={{
      opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.8)",
      transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
      position: "relative", width: 148, height: 148, flexShrink: 0,
    }}>
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle cx="74" cy="74" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="74" cy="74" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 74 74)"
          style={{ transition: "stroke-dashoffset 0.1s linear", filter: `drop-shadow(0 0 8px ${color}55)` }} />
      </svg>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1 }}>{current}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>/ 100</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, rating, detail, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  const ratingColors = { High: "#22c55e", Medium: "#eab308", Low: "#ef4444" };
  const bgColors = { High: "rgba(34,197,94,0.08)", Medium: "rgba(234,179,8,0.08)", Low: "rgba(239,68,68,0.08)" };

  // Context-aware labels based on which metric this is
  const getLabel = () => {
    if (label === "Competition") {
      if (rating === "High") return "LOW";      // low competition = good (green)
      if (rating === "Medium") return "MODERATE";
      return "HIGH";                              // high competition = bad (red)
    }
    if (label === "Search Demand") {
      if (rating === "High") return "HIGH";
      if (rating === "Medium") return "MODERATE";
      return "LOW";
    }
    if (label === "Trend") {
      if (rating === "High") return "RISING";
      if (rating === "Medium") return "STABLE";
      return "FALLING";
    }
    if (label === "Title Score") {
      if (rating === "High") return "GREAT";
      if (rating === "Medium") return "OK";
      return "NEEDS WORK";
    }
    return rating === "High" ? "STRONG" : rating === "Medium" ? "OK" : "WEAK";
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "18px 20px",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease",
    }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>{value}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: ratingColors[rating], background: bgColors[rating], padding: "4px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
          {getLabel()}
        </span>
      </div>
      {detail && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{detail}</div>}
    </div>
  );
}

function BreakdownBar({ label, value, weight, delay }) {
  const [visible, setVisible] = useState(false);
  const [animatedWidth, setAnimatedWidth] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setAnimatedWidth(value), delay + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delay, value]);

  const getBarColor = (val) => {
    if (val >= 70) return "#22c55e";
    if (val >= 50) return "#84cc16";
    if (val >= 35) return "#eab308";
    if (val >= 20) return "#f97316";
    return "#ef4444";
  };

  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(6px)", transition: "all 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label} <span style={{ color: "rgba(255,255,255,0.2)" }}>({weight}%)</span></span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{value}/100</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${animatedWidth}%`, borderRadius: 3, background: getBarColor(value), transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
      </div>
    </div>
  );
}

function InsightItem({ text, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 300 + index * 120); return () => clearTimeout(t); }, [index]);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-10px)", transition: "all 0.4s ease" }}>
      <div style={{ minWidth: 6, minHeight: 6, borderRadius: 3, marginTop: 7, background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

function TitleSuggestion({ title, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 200 + index * 120); return () => clearTimeout(t); }, [index]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)", transition: "all 0.4s ease",
    }}>
      <span style={{ minWidth: 26, height: 26, borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{title}</span>
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("insights");
  const inputRef = useRef(null);

  const analyze = async (text) => {
    const input = text || idea;
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveTab("insights");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: input }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      setResult(data);
    } catch (err) {
      setError("Failed to connect. Please check your internet and try again.");
    }
    setLoading(false);
  };

  const tabs = ["insights", "titles", "feedback"];
  const tabLabels = { insights: "Key Insights", titles: "AI Title Ideas", feedback: "Title Feedback" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "system-ui, -apple-system, sans-serif", color: "#f0f0f0", position: "relative", overflow: "hidden" }}>
      {/* Ambient background */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 24, padding: "6px 16px", marginBottom: 20, fontSize: 12, color: "#818cf8", fontWeight: 600, letterSpacing: 0.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "#818cf8", boxShadow: "0 0 8px #818cf8" }} />
            BETA
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0, lineHeight: 1.15, background: "linear-gradient(135deg, #f0f0f0 0%, #a5a5a5 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>IdeaLens</h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginTop: 10, fontWeight: 400, maxWidth: 440, margin: "10px auto 0" }}>
            Validate your YouTube video ideas with real data and AI-powered analysis.
          </p>
        </div>

        {/* Input area */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 6, marginBottom: 16, display: "flex", boxShadow: "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)" }}>
          <input ref={inputRef} value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} placeholder="Type a video idea or title..." disabled={loading}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 15, padding: "14px 18px", fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500 }} />
          <button onClick={() => analyze()} disabled={loading || !idea.trim()}
            style={{ background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 14, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 0.3, transition: "all 0.2s ease", opacity: !idea.trim() && !loading ? 0.4 : 1, boxShadow: loading ? "none" : "0 2px 12px rgba(99,102,241,0.3)" }}>
            {loading ? "Analyzing..." : "Validate"}
          </button>
        </div>

        {/* Example ideas */}
        {!result && !loading && !error && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32, justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 500, alignSelf: "center", marginRight: 4 }}>Try:</span>
            {EXAMPLE_IDEAS.map((ex) => (
              <button key={ex} onClick={() => { setIdea(ex); setTimeout(() => analyze(ex), 100); }}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500, transition: "all 0.2s ease" }}>
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: "#6366f1", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }`}</style>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 500 }}>Analyzing YouTube data, Google Trends, and running AI analysis...</div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, marginTop: 20 }}>
            <div style={{ fontSize: 15, color: "#ef4444", fontWeight: 600, marginBottom: 8 }}>Analysis Failed</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{error}</div>
            <button onClick={() => { setError(null); inputRef.current?.focus(); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 20px", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500 }}>
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ marginTop: 32 }}>
            {/* Score header */}
            <div style={{ display: "flex", alignItems: "center", gap: 32, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, flexWrap: "wrap" }}>
              <AnimatedScore score={result.score} color={result.color} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: result.color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{result.label}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{result.summary}</div>
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <MetricCard label="Search Demand" value={result.searchVolume.value} rating={result.searchVolume.rating} delay={200} />
              <MetricCard label="Competition" value={`${result.competition.count} results`} rating={result.competition.rating} detail={result.competition.value + " competition"} delay={320} />
              <MetricCard label="Trend" value={result.trendDirection.change} rating={result.trendDirection.rating} detail={result.trendDirection.value} delay={440} />
              <MetricCard label="Title Score" value={result.titleScore.value} rating={result.titleScore.rating} delay={560} />
            </div>

            {/* Score Breakdown */}
            {result.breakdown && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16 }}>Score Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <BreakdownBar label="Demand" value={result.breakdown.demand} weight={30} delay={200} />
                  <BreakdownBar label="Competition" value={result.breakdown.competition} weight={25} delay={320} />
                  <BreakdownBar label="Trend" value={result.breakdown.trend} weight={20} delay={440} />
                  <BreakdownBar label="Engagement" value={result.breakdown.engagement} weight={15} delay={560} />
                  <BreakdownBar label="Title Quality" value={result.breakdown.title} weight={10} delay={680} />
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "10px 0", border: "none", borderRadius: 9,
                    background: activeTab === tab ? "rgba(99,102,241,0.15)" : "transparent",
                    color: activeTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.3)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    transition: "all 0.2s ease", letterSpacing: 0.3,
                  }}>
                  {tabLabels[tab]}
                  {tab === "titles" && result.titleSuggestions?.length > 3 && (
                    <span style={{ marginLeft: 6, fontSize: 9, background: "rgba(99,102,241,0.3)", color: "#a5b4fc", padding: "2px 6px", borderRadius: 6, fontWeight: 700, letterSpacing: 0.5 }}>AI</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
              {activeTab === "insights" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {result.insights.map((insight, i) => (
                    <InsightItem key={i} text={insight} index={i} />
                  ))}
                </div>
              )}

              {activeTab === "titles" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.titleSuggestions?.length > 3 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 10 }}>
                      <span style={{ fontSize: 14 }}>✨</span>
                      <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 500 }}>
                        These titles were generated by AI based on analysis of your top competitors
                      </span>
                    </div>
                  )}
                  {result.titleSuggestions.map((title, i) => (
                    <TitleSuggestion key={i} title={title} index={i} />
                  ))}
                </div>
              )}

              {activeTab === "feedback" && (
                <div>
                  {result.titleFeedback ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Your Title</div>
                        <div style={{ fontSize: 16, color: "#f0f0f0", fontWeight: 600 }}>"{idea}"</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{idea.length} characters {idea.length >= 40 && idea.length <= 60 ? "(optimal range)" : idea.length < 40 ? "(consider making it longer)" : "(consider shortening)"}</div>
                      </div>
                      <div style={{ padding: "16px 20px", background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 14 }}>🤖</span>
                          <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" }}>AI Feedback</span>
                        </div>
                        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{result.titleFeedback}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.3)" }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>AI title feedback unavailable</div>
                      <div style={{ fontSize: 12 }}>This feature requires the Anthropic API key to be configured. Check the Key Insights tab for basic title tips.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

           

            {/* Reset */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => { setResult(null); setIdea(""); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 13, cursor: "pointer", fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Validate another idea
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}