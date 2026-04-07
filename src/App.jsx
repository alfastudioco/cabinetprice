import { useState, useCallback } from "react";

// ── RATE CARD ─────────────────────────────────────────────────
// These are YOUR prices. AI reads dimensions, your rates do the math.
const DEFAULT_RATES = {
  "Builder Grade":    { upper: 350, lower: 500 },
  "Semi-Custom":      { upper: 550, lower: 800 },
  "Custom":           { upper: 800, lower: 1100 },
  "Luxury / Bespoke": { upper: 1200, lower: 1600 },
};

const GRADES = Object.keys(DEFAULT_RATES);
const BOX_TYPES = ["Particleboard", "Plywood", "Solid Wood"];
const DOOR_STYLES = ["Full Overlay", "Inset", "Beaded Inset", "Shaker"];
const FINISHES = ["Thermofoil", "Painted", "Stained", "Two-Tone"];
const HARDWARE = ["Basic Soft Close", "Blum Soft Close", "Grass / Hettich", "Premium (Hafele)"];

const C = {
  cream: "#f5f0e8", warm: "#faf8f4", dark: "#2a2520",
  brown: "#6b5744", gold: "#c4a24d", border: "#d4c9b8",
  light: "#f0ebe0", red: "#8b3a3a", green: "#4a7c59"
};

const mono = { fontFamily: "monospace" };
const lbl = { fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 6 };
const td = (r) => ({ padding: "10px 14px", background: C.warm, borderBottom: "1px solid " + C.border, textAlign: r ? "right" : "left", fontFamily: "monospace", fontSize: 12 });
const tdT = (r) => ({ padding: "10px 14px", background: C.light, fontWeight: 700, textAlign: r ? "right" : "left", fontFamily: "monospace", fontSize: 12 });

function Sel({ label, val, set, opts }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <select value={val} onChange={e => set(e.target.value)}
        style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", ...mono, fontSize: 13, color: C.dark, outline: "none" }}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function NumInput({ label, val, set, ph, prefix }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", ...mono, fontSize: 13, color: C.brown }}>{prefix}</span>}
        <input type="number" placeholder={ph} value={val} onChange={e => set(e.target.value)}
          style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: prefix ? "10px 14px 10px 26px" : "10px 14px", ...mono, fontSize: 13, color: C.dark, outline: "none" }} />
      </div>
    </div>
  );
}

function THead({ cols, brown }) {
  return (
    <thead>
      <tr>
        {cols.map((h, i) => (
          <th key={h} style={{ background: brown ? C.brown : C.dark, color: C.cream, padding: "10px 14px", textAlign: i === 0 ? "left" : "right", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 400 }}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

export default function App() {
  const [mode, setMode] = useState("layout");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Specs
  const [grade, setGrade] = useState("Semi-Custom");
  const [box, setBox] = useState("Plywood");
  const [door, setDoor] = useState("Inset");
  const [finish, setFinish] = useState("Painted");
  const [hardware, setHardware] = useState("Blum Soft Close");

  // Rate card — user can override
  const [upperRate, setUpperRate] = useState(DEFAULT_RATES["Semi-Custom"].upper);
  const [lowerRate, setLowerRate] = useState(DEFAULT_RATES["Semi-Custom"].lower);

  // Cabinet type
  const [cabinetType, setCabinetType] = useState("both");

  // Manual LF overrides
  const [manualUpper, setManualUpper] = useState("");
  const [manualLower, setManualLower] = useState("");

  // Photo mode extras
  const [width, setWidth] = useState("");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [photoRes, setPhotoRes] = useState(null);
  const [error, setError] = useState("");

  const switchMode = (m) => {
    setMode(m); setFiles([]); setPreviews([]);
    setResults(null); setPhotoRes(null); setError("");
  };

  // When grade changes, update default rates
  const handleGradeChange = (g) => {
    setGrade(g);
    setUpperRate(DEFAULT_RATES[g].upper);
    setLowerRate(DEFAULT_RATES[g].lower);
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          resolve({ src: compressed, b64: compressed.split(",")[1], type: "image/jpeg" });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = useCallback((newFiles) => {
    Array.from(newFiles).forEach(async file => {
      if (!file.type.startsWith("image/")) return;
      const compressed = await compressImage(file);
      setPreviews(p => [...p, { src: compressed.src }]);
      setFiles(f => [...f, { b64: compressed.b64, type: compressed.type }]);
    });
  }, []);

  const removeFile = (i) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const fmt = n => "$" + Math.round(n).toLocaleString();
  const fmtLF = n => parseFloat(n).toFixed(1);

  // Apply rate card to AI-returned LF numbers
  const applyRates = (walls) => {
    return walls.map(w => {
      const uCost = Math.round(w.upperLF * upperRate);
      const lCost = Math.round(w.lowerLF * lowerRate);
      const total = uCost + lCost;
      const lf = w.upperLF + w.lowerLF;
      return {
        ...w,
        upperCost: uCost,
        lowerCost: lCost,
        totalCost: total,
        costPerLF: lf > 0 ? Math.round(total / lf) : 0
      };
    });
  };

  const callAPI = async (messages) => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages })
    });
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error("Server error: " + raw.slice(0, 200)); }
    if (!res.ok || data.error) throw new Error(data.error || JSON.stringify(data));
    const text = data.content.map(i => i.text || "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI could not read dimensions. Try a clearer image.");
    return JSON.parse(match[0]);
  };

  const buildLayoutPrompt = () => {
    const typeStr = cabinetType === "lowers"
      ? "LOWER CABINETS ONLY. Set upperLF=0 for all walls."
      : cabinetType === "uppers"
      ? "UPPER CABINETS ONLY. Set lowerLF=0 for all walls."
      : "Read upper and lower cabinet dimensions independently for each wall.";

    const manualStr = (manualUpper || manualLower)
      ? "OVERRIDE — use these exact totals: " +
        (manualUpper ? "totalUpperLF=" + manualUpper + " " : "") +
        (manualLower ? "totalLowerLF=" + manualLower : "") +
        ". Distribute proportionally across walls."
      : "";

    return "You are a cabinet estimator. Read ONLY the dimension numbers printed on these drawings. Do not estimate.\n\n" +
      typeStr + "\n" + manualStr + "\n\n" +
      "For each wall: list dimensions read, sum them, convert to LF (inches / 12).\n" +
      "DO NOT calculate any costs or prices — only return linear footage numbers.\n\n" +
      "Your entire response must be this JSON only, nothing else:\n" +
      "{\"walls\":[{\"name\":\"str\",\"totalLF\":0.0,\"upperLF\":0.0,\"lowerLF\":0.0,\"dimensionsRead\":[\"str\"],\"features\":[\"str\"]}]," +
      "\"totalLF\":0.0,\"totalUpperLF\":0.0,\"totalLowerLF\":0.0,\"specs\":[\"str\"],\"notes\":\"str\"}";
  };

  const buildPhotoPrompt = () => {
    const widthStr = width ? "Total cabinet run is approximately " + width + " inches wide. " : "";
    const typeStr = cabinetType === "lowers" ? "LOWER CABINETS ONLY, set estimatedUpperLF=0. "
      : cabinetType === "uppers" ? "UPPER CABINETS ONLY, set estimatedLowerLF=0. " : "";

    return "You are a cabinet estimator. Analyze this photo and estimate linear footage only. " +
      widthStr + typeStr +
      "DO NOT calculate costs — only return LF estimates.\n\n" +
      "Your entire response must be this JSON only, nothing else:\n" +
      "{\"detectedStyle\":\"str\",\"detectedFinish\":\"str\",\"detectedDoorStyle\":\"str\"," +
      "\"specialFeatures\":[\"str\"],\"condition\":\"str\"," +
      "\"estimatedUpperLF\":0.0,\"estimatedLowerLF\":0.0,\"estimatedTotalLF\":0.0," +
      "\"confidence\":\"Low/Medium/High\",\"confidenceReason\":\"str\"," +
      "\"recommendations\":[\"str\"],\"notes\":\"str\"}";
  };

  const analyzeLayout = async () => {
    if (!files.length) { setError("Upload at least one drawing."); return; }
    setError(""); setLoading(true); setResults(null);
    try {
      const content = [
        ...files.map(f => ({ type: "image", source: { type: "base64", media_type: f.type, data: f.b64 } })),
        { type: "text", text: buildLayoutPrompt() }
      ];
      const raw = await callAPI([{ role: "user", content }]);

      // Apply rate card to get consistent pricing
      const walls = applyRates(raw.walls || []);
      const totalUpperLF = walls.reduce((s, w) => s + w.upperLF, 0);
      const totalLowerLF = walls.reduce((s, w) => s + w.lowerLF, 0);
      const totalUpperCost = walls.reduce((s, w) => s + w.upperCost, 0);
      const totalLowerCost = walls.reduce((s, w) => s + w.lowerCost, 0);
      const grandTotal = totalUpperCost + totalLowerCost;
      const totalLF = totalUpperLF + totalLowerLF;

      setResults({
        walls,
        totalLF,
        totalUpperLF,
        totalLowerLF,
        totalUpperCost,
        totalLowerCost,
        grandTotal,
        upperCostPerLF: upperRate,
        lowerCostPerLF: lowerRate,
        blendedCostPerLF: totalLF > 0 ? Math.round(grandTotal / totalLF) : 0,
        specs: raw.specs || [],
        notes: raw.notes || ""
      });
    } catch (e) { setError("Analysis failed: " + e.message); }
    finally { setLoading(false); }
  };

  const analyzePhoto = async () => {
    if (!files.length) { setError("Upload at least one photo."); return; }
    setError(""); setLoading(true); setPhotoRes(null);
    try {
      const content = [
        ...files.map(f => ({ type: "image", source: { type: "base64", media_type: f.type, data: f.b64 } })),
        { type: "text", text: buildPhotoPrompt() }
      ];
      const raw = await callAPI([{ role: "user", content }]);

      // Apply rate card
      const uLF = parseFloat(raw.estimatedUpperLF) || 0;
      const lLF = parseFloat(raw.estimatedLowerLF) || 0;
      const uCost = Math.round(uLF * upperRate);
      const lCost = Math.round(lLF * lowerRate);
      const grand = uCost + lCost;
      const totalLF = uLF + lLF;

      setPhotoRes({
        ...raw,
        upperCost: uCost,
        lowerCost: lCost,
        grandTotal: grand,
        upperCostPerLF: upperRate,
        lowerCostPerLF: lowerRate,
        blendedCostPerLF: totalLF > 0 ? Math.round(grand / totalLF) : 0
      });
    } catch (e) { setError("Analysis failed: " + e.message); }
    finally { setLoading(false); }
  };

  const Previews = () => previews.length > 0 ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
      {previews.map((p, i) => (
        <div key={i} style={{ position: "relative", width: 70, height: 70, border: "1px solid " + C.border, overflow: "hidden" }}>
          <img src={p.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button onClick={() => removeFile(i)}
            style={{ position: "absolute", top: 2, right: 2, background: C.dark, color: "white", border: "none", width: 18, height: 18, cursor: "pointer", fontSize: 12 }}>x</button>
        </div>
      ))}
    </div>
  ) : null;

  const btnStyle = (color) => ({
    width: "100%", background: loading ? C.brown : (color || C.dark), color: C.cream,
    border: "none", padding: 16, ...mono, fontSize: 11, letterSpacing: 3,
    textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", marginBottom: 28
  });

  return (
    <div style={{ fontFamily: "Georgia, serif", background: C.cream, minHeight: "100vh", color: C.dark }}>

      {/* Header */}
      <div style={{ background: C.dark, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid " + C.gold }}>
        <div style={{ color: C.cream, fontSize: 20 }}>Cabinet<span style={{ color: C.gold }}>Pricer</span></div>
        <div style={{ background: C.gold, color: C.dark, ...mono, fontSize: 10, padding: "4px 10px", letterSpacing: 2, textTransform: "uppercase" }}>AI Powered</div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Cabinet Estimating Tool</h1>
        <p style={{ ...mono, fontSize: 11, color: C.brown, marginBottom: 28, letterSpacing: 1 }}>AI reads dimensions · Your rate card prices the job</p>

        {/* Mode Toggle */}
        <div style={{ display: "flex", marginBottom: 28, border: "1px solid " + C.border }}>
          {[["layout", "Layout / Drawings"], ["photo", "Photo Pricing"], ["manual", "Manual Entry"]].map(([mv, ml], i) => (
            <button key={mv} onClick={() => switchMode(mv)}
              style={{ flex: 1, padding: "13px", background: mode === mv ? C.dark : C.warm, color: mode === mv ? C.cream : C.dark, border: "none", cursor: "pointer", ...mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", borderRight: i < 2 ? "1px solid " + C.border : "none" }}>
              {ml}
            </button>
          ))}
        </div>

        {error && <div style={{ background: "#fdf0f0", border: "1px solid #d4a0a0", padding: "12px 16px", marginBottom: 16, ...mono, fontSize: 12, color: C.red }}>{error}</div>}

        {/* ── RATE CARD (always visible) ── */}
        <div style={{ background: C.warm, border: "1px solid " + C.border, padding: "20px", marginBottom: 24 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 14 }}>Your Rate Card ($/LF)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "end" }}>
            <Sel label="Grade Preset" val={grade} set={handleGradeChange} opts={GRADES} />
            <NumInput label="Upper Cabinets $/LF" val={upperRate} set={setUpperRate} ph="e.g. 550" prefix="$" />
            <NumInput label="Lower Cabinets $/LF" val={lowerRate} set={setLowerRate} ph="e.g. 800" prefix="$" />
          </div>
          <div style={{ ...mono, fontSize: 10, color: C.brown, marginTop: 10 }}>
            Adjust rates for your specific project specs — these override the grade preset.
          </div>
        </div>

        {/* ── SPECS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <Sel label="Box Material" val={box} set={setBox} opts={BOX_TYPES} />
          <Sel label="Door Style" val={door} set={setDoor} opts={DOOR_STYLES} />
          <Sel label="Finish" val={finish} set={setFinish} opts={FINISHES} />
          <Sel label="Hardware" val={hardware} set={setHardware} opts={HARDWARE} />
        </div>

        {/* ── CABINET TYPE TOGGLE ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>What cabinets are in this project?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["both", "Uppers + Lowers"], ["lowers", "Lowers Only"], ["uppers", "Uppers Only"]].map(([v, l]) => (
              <button key={v} onClick={() => { setCabinetType(v); setManualUpper(""); setManualLower(""); }}
                style={{ flex: 1, padding: "10px 6px", background: cabinetType === v ? C.dark : C.warm, color: cabinetType === v ? C.cream : C.dark, border: "1px solid " + C.border, cursor: "pointer", ...mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── LAYOUT MODE ── */}
        {mode === "layout" && (
          <>
            <div style={{ border: "2px dashed " + C.border, background: C.warm, padding: "28px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📐</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Upload Elevation Drawings</div>
              <label style={{ display: "inline-block", background: C.dark, color: C.cream, padding: "10px 22px", cursor: "pointer", ...mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                Browse Files
                <input type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
              </label>
              <div style={{ ...mono, fontSize: 11, color: C.brown, marginTop: 8 }}>JPG or PNG · Multiple elevations OK</div>
              <Previews />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {cabinetType !== "lowers" && <NumInput label="Override Upper LF (optional)" val={manualUpper} set={setManualUpper} ph="e.g. 19.3" />}
              {cabinetType !== "uppers" && <NumInput label="Override Lower LF (optional)" val={manualLower} set={setManualLower} ph="e.g. 39.3" />}
            </div>

            <button onClick={analyzeLayout} disabled={loading} style={btnStyle()}>
              {loading ? "Reading Dimensions..." : "Analyze Layout & Price"}
            </button>

            {results && <LayoutResults results={results} fmt={fmt} fmtLF={fmtLF} td={td} tdT={tdT} THead={THead} />}
          </>
        )}

        {/* ── PHOTO MODE ── */}
        {mode === "photo" && (
          <>
            <div style={{ background: C.warm, border: "1px solid " + C.border, padding: "28px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🚪</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Upload Cabinet Photo</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.dark, color: C.cream, padding: "12px 20px", cursor: "pointer", ...mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  Gallery
                  <input type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.brown, color: C.cream, padding: "12px 20px", cursor: "pointer", ...mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  Camera
                  <input type="file" accept="image/*" capture="environment" onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
                </label>
              </div>
              <Previews />
            </div>

            <div style={{ marginBottom: 20 }}>
              <NumInput label="Estimated Total Width (inches, optional)" val={width} set={setWidth} ph="e.g. 144" />
            </div>

            <button onClick={analyzePhoto} disabled={loading} style={btnStyle()}>
              {loading ? "Analyzing Photo..." : "Analyze Photo & Price"}
            </button>

            {photoRes && <PhotoResults res={photoRes} fmt={fmt} fmtLF={fmtLF} td={td} tdT={tdT} THead={THead} C={C} />}
          </>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && (
          <ManualMode
            upperRate={upperRate} lowerRate={lowerRate}
            fmt={fmt} fmtLF={fmtLF} td={td} tdT={tdT} THead={THead} C={C} lbl={lbl}
          />
        )}
      </div>
    </div>
  );
}

// ── LAYOUT RESULTS ────────────────────────────────────────────
function LayoutResults({ results, fmt, fmtLF, td, tdT, THead }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #2a2520" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Pricing Breakdown</div>
        <div style={{ background: "#c4a24d", color: "#2a2520", padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{fmt(results.grandTotal)}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {(results.specs || []).map(s => <span key={s} style={{ background: "#2a2520", color: "#f5f0e8", fontFamily: "monospace", fontSize: 10, padding: "3px 10px", letterSpacing: 1, textTransform: "uppercase" }}>{s}</span>)}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <THead cols={["Wall", "Upper LF", "Lower LF", "Total LF", "Cost"]} />
        <tbody>
          {results.walls.map((w, i) => (
            <tr key={i}>
              <td style={td(false)}>
                {w.name}
                {w.dimensionsRead && w.dimensionsRead.length > 0 && (
                  <div style={{ fontSize: 10, color: "#6b5744", marginTop: 2 }}>{w.dimensionsRead.join(" + ")}</div>
                )}
              </td>
              <td style={td(true)}>{fmtLF(w.upperLF)}</td>
              <td style={td(true)}>{fmtLF(w.lowerLF)}</td>
              <td style={td(true)}>{fmtLF(w.totalLF)}</td>
              <td style={td(true)}>{fmt(w.totalCost)}</td>
            </tr>
          ))}
          <tr>
            <td style={tdT(false)}>TOTAL</td>
            <td style={tdT(true)}>{fmtLF(results.totalUpperLF)} LF</td>
            <td style={tdT(true)}>{fmtLF(results.totalLowerLF)} LF</td>
            <td style={tdT(true)}>{fmtLF(results.totalLF)} LF</td>
            <td style={tdT(true)}>{fmt(results.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <THead cols={["Summary", "LF", "$/LF", "Total"]} brown />
        <tbody>
          <tr>
            <td style={td(false)}>Upper Cabinets</td>
            <td style={td(true)}>{fmtLF(results.totalUpperLF)}</td>
            <td style={td(true)}>{fmt(results.upperCostPerLF)}/LF</td>
            <td style={td(true)}>{fmt(results.totalUpperCost)}</td>
          </tr>
          <tr>
            <td style={td(false)}>Lower Cabinets</td>
            <td style={td(true)}>{fmtLF(results.totalLowerLF)}</td>
            <td style={td(true)}>{fmt(results.lowerCostPerLF)}/LF</td>
            <td style={td(true)}>{fmt(results.totalLowerCost)}</td>
          </tr>
          <tr>
            <td style={tdT(false)}>Grand Total</td>
            <td style={tdT(true)}>{fmtLF(results.totalLF)} LF</td>
            <td style={tdT(true)}>{fmt(results.blendedCostPerLF)}/LF</td>
            <td style={tdT(true)}>{fmt(results.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {results.notes && (
        <div style={{ background: "#faf8f4", borderLeft: "3px solid #c4a24d", padding: "14px 18px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b5744", marginBottom: 8 }}>AI Notes</div>
          <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>{results.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── PHOTO RESULTS ─────────────────────────────────────────────
function PhotoResults({ res, fmt, fmtLF, td, tdT, THead, C }) {
  const ccol = (c) => c === "High" ? C.green : c === "Medium" ? C.gold : C.red;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid " + C.dark }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Photo Analysis</div>
        <div style={{ background: C.gold, color: C.dark, padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{fmt(res.grandTotal)}</div>
      </div>
      <div style={{ background: C.warm, border: "1px solid " + C.border, padding: "10px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: C.brown, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Confidence:</span>
        <strong style={{ color: ccol(res.confidence) }}>{res.confidence}</strong>
        <span style={{ color: C.brown }}>— {res.confidenceReason}</span>
      </div>
      <div style={{ background: C.warm, borderLeft: "3px solid " + C.dark, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 10 }}>Detected</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace", fontSize: 12 }}>
          <div><span style={{ color: C.brown }}>Style: </span>{res.detectedStyle}</div>
          <div><span style={{ color: C.brown }}>Finish: </span>{res.detectedFinish}</div>
          <div><span style={{ color: C.brown }}>Door: </span>{res.detectedDoorStyle}</div>
          <div><span style={{ color: C.brown }}>Condition: </span>{res.condition}</div>
        </div>
        {res.specialFeatures?.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {res.specialFeatures.map(f => <span key={f} style={{ background: C.dark, color: C.cream, fontFamily: "monospace", fontSize: 10, padding: "3px 10px", letterSpacing: 1, textTransform: "uppercase" }}>{f}</span>)}
          </div>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <THead cols={["Cabinet Type", "Est. LF", "$/LF", "Total"]} />
        <tbody>
          <tr><td style={td(false)}>Upper Cabinets</td><td style={td(true)}>{fmtLF(res.estimatedUpperLF)}</td><td style={td(true)}>{fmt(res.upperCostPerLF)}/LF</td><td style={td(true)}>{fmt(res.upperCost)}</td></tr>
          <tr><td style={td(false)}>Lower Cabinets</td><td style={td(true)}>{fmtLF(res.estimatedLowerLF)}</td><td style={td(true)}>{fmt(res.lowerCostPerLF)}/LF</td><td style={td(true)}>{fmt(res.lowerCost)}</td></tr>
          <tr><td style={tdT(false)}>Total</td><td style={tdT(true)}>{fmtLF(res.estimatedTotalLF)} LF</td><td style={tdT(true)}>{fmt(res.blendedCostPerLF)}/LF</td><td style={tdT(true)}>{fmt(res.grandTotal)}</td></tr>
        </tbody>
      </table>
      {res.notes && (
        <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "14px 18px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 8 }}>AI Notes</div>
          <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>{res.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── MANUAL MODE ───────────────────────────────────────────────
function ManualMode({ upperRate, lowerRate, fmt, fmtLF, td, tdT, THead, C, lbl }) {
  const [rows, setRows] = useState([{ name: "Wall 1", upperLF: "", lowerLF: "" }]);
  const addRow = () => setRows(r => [...r, { name: "Wall " + (r.length + 1), upperLF: "", lowerLF: "" }]);
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const calculated = rows.map(r => {
    const uLF = parseFloat(r.upperLF) || 0;
    const lLF = parseFloat(r.lowerLF) || 0;
    const uCost = Math.round(uLF * upperRate);
    const lCost = Math.round(lLF * lowerRate);
    return { ...r, uLF, lLF, uCost, lCost, total: uCost + lCost };
  });

  const totULF = calculated.reduce((s, r) => s + r.uLF, 0);
  const totLLF = calculated.reduce((s, r) => s + r.lLF, 0);
  const totU = calculated.reduce((s, r) => s + r.uCost, 0);
  const totL = calculated.reduce((s, r) => s + r.lCost, 0);
  const grand = totU + totL;
  const totLF = totULF + totLLF;

  return (
    <div>
      <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "12px 16px", marginBottom: 20, fontFamily: "monospace", fontSize: 12 }}>
        Enter your linear footage per wall — pricing calculates instantly from your rate card.
      </div>

      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
          <div>
            {i === 0 && <div style={lbl}>Wall Name</div>}
            <input value={r.name} onChange={e => updateRow(i, "name", e.target.value)}
              style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: C.dark, outline: "none" }} />
          </div>
          <div>
            {i === 0 && <div style={lbl}>Upper LF</div>}
            <input type="number" placeholder="0" value={r.upperLF} onChange={e => updateRow(i, "upperLF", e.target.value)}
              style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: C.dark, outline: "none" }} />
          </div>
          <div>
            {i === 0 && <div style={lbl}>Lower LF</div>}
            <input type="number" placeholder="0" value={r.lowerLF} onChange={e => updateRow(i, "lowerLF", e.target.value)}
              style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: C.dark, outline: "none" }} />
          </div>
          <button onClick={() => removeRow(i)} style={{ background: "none", border: "1px solid " + C.border, color: C.brown, width: 38, height: 42, cursor: "pointer", fontSize: 16, marginTop: i === 0 ? 22 : 0 }}>×</button>
        </div>
      ))}

      <button onClick={addRow} style={{ width: "100%", background: C.warm, border: "1px dashed " + C.border, color: C.brown, padding: 12, fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", marginBottom: 24 }}>
        + Add Wall
      </button>

      {grand > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid " + C.dark }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Pricing Breakdown</div>
            <div style={{ background: C.gold, color: C.dark, padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{fmt(grand)}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <THead cols={["Wall", "Upper LF", "Lower LF", "Upper $", "Lower $", "Total"]} />
            <tbody>
              {calculated.map((r, i) => (
                <tr key={i}>
                  <td style={td(false)}>{r.name}</td>
                  <td style={td(true)}>{fmtLF(r.uLF)}</td>
                  <td style={td(true)}>{fmtLF(r.lLF)}</td>
                  <td style={td(true)}>{fmt(r.uCost)}</td>
                  <td style={td(true)}>{fmt(r.lCost)}</td>
                  <td style={td(true)}>{fmt(r.total)}</td>
                </tr>
              ))}
              <tr>
                <td style={tdT(false)}>TOTAL</td>
                <td style={tdT(true)}>{fmtLF(totULF)} LF</td>
                <td style={tdT(true)}>{fmtLF(totLLF)} LF</td>
                <td style={tdT(true)}>{fmt(totU)}</td>
                <td style={tdT(true)}>{fmt(totL)}</td>
                <td style={tdT(true)}>{fmt(grand)}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead cols={["Summary", "LF", "$/LF", "Total"]} brown />
            <tbody>
              <tr><td style={td(false)}>Upper Cabinets</td><td style={td(true)}>{fmtLF(totULF)}</td><td style={td(true)}>{fmt(upperRate)}/LF</td><td style={td(true)}>{fmt(totU)}</td></tr>
              <tr><td style={td(false)}>Lower Cabinets</td><td style={td(true)}>{fmtLF(totLLF)}</td><td style={td(true)}>{fmt(lowerRate)}/LF</td><td style={td(true)}>{fmt(totL)}</td></tr>
              <tr><td style={tdT(false)}>Grand Total</td><td style={tdT(true)}>{fmtLF(totLF)} LF</td><td style={tdT(true)}>{fmt(totLF > 0 ? Math.round(grand / totLF) : 0)}/LF</td><td style={tdT(true)}>{fmt(grand)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
