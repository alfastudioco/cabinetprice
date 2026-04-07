import { useState, useCallback } from "react";

const GRADES = ["Builder Grade", "Semi-Custom", "Custom", "Luxury / Bespoke"];
const BOX_TYPES = ["Particleboard", "Plywood", "Solid Wood"];
const DOOR_STYLES = ["Full Overlay", "Inset", "Beaded Inset", "Shaker"];
const FINISHES = ["Thermofoil", "Painted", "Stained", "Two-Tone"];
const HARDWARE = ["Basic Soft Close", "Blum Soft Close", "Grass / Hettich", "Premium (Hafele)"];

const C = {
  cream: "#f5f0e8", warm: "#faf8f4", dark: "#2a2520",
  brown: "#6b5744", gold: "#c4a24d", border: "#d4c9b8",
  light: "#f0ebe0", red: "#8b3a3a"
};


const lbl = { fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 6 };
const td = (r) => ({ padding: "10px 14px", background: C.warm, borderBottom: "1px solid " + C.border, textAlign: r ? "right" : "left" });
const tdT = (r) => ({ padding: "10px 14px", background: C.light, fontWeight: 700, textAlign: r ? "right" : "left" });

function Sel({ label, val, set, opts }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <select value={val} onChange={e => set(e.target.value)}
        style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: C.dark, outline: "none" }}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Num({ label, val, set, ph }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <input type="number" placeholder={ph} value={val} onChange={e => set(e.target.value)}
        style={{ width: "100%", background: C.warm, border: "1px solid " + C.border, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: C.dark, outline: "none" }} />
    </div>
  );
}

function THead({ cols }) {
  return (
    <thead>
      <tr>
        {cols.map((h, i) => (
          <th key={h} style={{ background: C.dark, color: C.cream, padding: "10px 14px", textAlign: i === 0 ? "left" : "right", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 400 }}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

export default function App() {
  const [mode, setMode] = useState("layout");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [grade, setGrade] = useState("Semi-Custom");
  const [box, setBox] = useState("Plywood");
  const [door, setDoor] = useState("Inset");
  const [finish, setFinish] = useState("Painted");
  const [hardware, setHardware] = useState("Blum Soft Close");
  const [price, setPrice] = useState("");
  const [width, setWidth] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [photoRes, setPhotoRes] = useState(null);
  const [error, setError] = useState("");

  const switchMode = (m2) => {
    setMode(m2); setFiles([]); setPreviews([]);
    setResults(null); setPhotoRes(null); setError("");
  };

  const handleFiles = useCallback((newFiles) => {
    Array.from(newFiles).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        const src = e.target.result;
        setPreviews(p => [...p, { src }]);
        setFiles(f => [...f, { b64: src.split(",")[1], type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeFile = (i) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const fmt = n => "$" + Math.round(n).toLocaleString();
  const fmtLF = n => parseFloat(n).toFixed(1);

  const callAPI = async (messages) => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: messages
      })
    });
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error("Server error: " + raw.slice(0, 300)); }
    if (!res.ok || data.error) { throw new Error(data.error || JSON.stringify(data)); }
    const text = data.content.map(i => i.text || "").join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  };

  const buildLayoutPrompt = () => {
    const priceStr = price
      ? "Grand total MUST equal exactly $" + parseInt(price).toLocaleString() + ". Work backwards from this to set costs."
      : "Estimate fair market price based on specs: Grade:" + grade + ", Box:" + box + ", Door:" + door + ", Finish:" + finish + ", Hardware:" + hardware + ".";

    return "You are a cabinet estimator. Read every dimension label printed on the elevation drawings exactly as shown. Do not estimate — only use numbers explicitly written on the drawings.\n\nFor each wall:\n1. List every dimension you can read\n2. Sum them, convert inches to feet (divide by 12)\n3. upperLF = totalLF x 0.5, lowerLF = totalLF x 0.5\n4. Lowers = 60% of cost, uppers = 40%\n5. " + priceStr + "\n\nSpecs: Grade:" + grade + ", Box:" + box + ", Door:" + door + ", Finish:" + finish + ", Hardware:" + hardware + "\n\nRespond ONLY with valid JSON, no markdown:\n{\"walls\":[{\"name\":\"str\",\"totalLF\":0.0,\"upperLF\":0.0,\"lowerLF\":0.0,\"upperCost\":0,\"lowerCost\":0,\"totalCost\":0,\"costPerLF\":0,\"dimensionsRead\":[\"str\"],\"features\":[\"str\"]}],\"totalLF\":0.0,\"totalUpperLF\":0.0,\"totalLowerLF\":0.0,\"totalUpperCost\":0,\"totalLowerCost\":0,\"grandTotal\":0,\"upperCostPerLF\":0,\"lowerCostPerLF\":0,\"blendedCostPerLF\":0,\"specs\":[\"str\"],\"notes\":\"str\"}";
  };

  const buildPhotoPrompt = () => {
    const widthStr = width ? "Cabinet run is approximately " + width + " inches wide. " : "";
    const priceStr = price
      ? "Target sale price: $" + parseInt(price).toLocaleString() + "."
      : "Estimate fair market pricing.";

    return "You are an expert cabinet estimator. Analyze these cabinet photos. " + widthStr + priceStr + " Customer wants: Grade:" + grade + ", Box:" + box + ", Door:" + door + ", Finish:" + finish + ", Hardware:" + hardware + ". Identify style, finish, door type. Estimate LF for uppers and lowers. Note special features and condition. Lowers 60% of cost, uppers 40%.\n\nRespond ONLY with valid JSON, no markdown:\n{\"detectedStyle\":\"str\",\"detectedFinish\":\"str\",\"detectedDoorStyle\":\"str\",\"specialFeatures\":[\"str\"],\"condition\":\"str\",\"estimatedUpperLF\":0.0,\"estimatedLowerLF\":0.0,\"estimatedTotalLF\":0.0,\"upperCost\":0,\"lowerCost\":0,\"grandTotal\":0,\"upperCostPerLF\":0,\"lowerCostPerLF\":0,\"blendedCostPerLF\":0,\"confidence\":\"Low/Medium/High\",\"confidenceReason\":\"str\",\"recommendations\":[\"str\"],\"notes\":\"str\"}";
  };

  const analyzeLayout = async () => {
    if (!files.length) { setError("Upload at least one drawing."); return; }
    setError(""); setLoading(true); setResults(null);
    try {
      const content = [
        ...files.map(f => ({ type: "image", source: { type: "base64", media_type: f.type, data: f.b64 } })),
        { type: "text", text: buildLayoutPrompt() }
      ];
      setResults(await callAPI([{ role: "user", content }]));
    } catch (e) {
      setError("Analysis failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzePhoto = async () => {
    if (!files.length) { setError("Upload at least one photo."); return; }
    setError(""); setLoading(true); setPhotoRes(null);
    try {
      const content = [
        ...files.map(f => ({ type: "image", source: { type: "base64", media_type: f.type, data: f.b64 } })),
        { type: "text", text: buildPhotoPrompt() }
      ];
      setPhotoRes(await callAPI([{ role: "user", content }]));
    } catch (e) {
      setError("Analysis failed: " + e.message);
    } finally {
      setLoading(false);
    }
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

  const btnStyle = {
    width: "100%", background: loading ? C.brown : C.dark, color: C.cream,
    border: "none", padding: 16, fontFamily: "monospace", fontSize: 11,
    letterSpacing: 3, textTransform: "uppercase",
    cursor: loading ? "not-allowed" : "pointer", marginBottom: 28
  };

  return (
    <div style={{ fontFamily: "Georgia, serif", background: C.cream, minHeight: "100vh", color: C.dark }}>

      {/* Header */}
      <div style={{ background: C.dark, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid " + C.gold }}>
        <div style={{ color: C.cream, fontSize: 20 }}>Cabinet<span style={{ color: C.gold }}>Pricer</span></div>
        <div style={{ background: C.gold, color: C.dark, fontFamily: "monospace", fontSize: 10, padding: "4px 10px", letterSpacing: 2, textTransform: "uppercase" }}>AI Powered</div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Cabinet Estimating Tool</h1>

        {/* Mode Toggle */}
        <div style={{ display: "flex", marginBottom: 24, border: "1px solid " + C.border }}>
          {[["layout", "Layout / Drawings"], ["photo", "Photo Pricing"]].map(([mv, mlbl], i) => (
            <button key={mv} onClick={() => switchMode(mv)}
              style={{ flex: 1, padding: "13px", background: mode === mv ? C.dark : C.warm, color: mode === mv ? C.cream : C.dark, border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", borderRight: i === 0 ? "1px solid " + C.border : "none" }}>
              {mlbl}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "#fdf0f0", border: "1px solid #d4a0a0", padding: "12px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 12, color: C.red }}>
            {error}
          </div>
        )}

        {/* LAYOUT MODE */}
        {mode === "layout" && (
          <>
            <div style={{ border: "2px dashed " + C.border, background: C.warm, padding: "28px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📐</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Upload Elevation Drawings</div>
              <label style={{ display: "inline-block", background: C.dark, color: C.cream, padding: "10px 22px", cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                Browse Files
                <input type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
              </label>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: C.brown, marginTop: 8 }}>JPG or PNG</div>
              <Previews />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <Sel label="Cabinet Grade" val={grade} set={setGrade} opts={GRADES} />
              <Sel label="Box Material" val={box} set={setBox} opts={BOX_TYPES} />
              <Sel label="Door Style" val={door} set={setDoor} opts={DOOR_STYLES} />
              <Sel label="Finish" val={finish} set={setFinish} opts={FINISHES} />
              <Sel label="Hardware" val={hardware} set={setHardware} opts={HARDWARE} />
              <Num label="Target Sale Price ($)" val={price} set={setPrice} ph="e.g. 40000" />
            </div>

            <button onClick={analyzeLayout} disabled={loading} style={btnStyle}>
              {loading ? "Analyzing..." : "Analyze Layout & Price"}
            </button>

            {results && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid " + C.dark }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Pricing Breakdown</div>
                  <div style={{ background: C.gold, color: C.dark, padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{fmt(results.grandTotal)}</div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {(results.specs || []).map(s => (
                    <span key={s} style={{ background: C.dark, color: C.cream, fontFamily: "monospace", fontSize: 10, padding: "3px 10px", letterSpacing: 1, textTransform: "uppercase" }}>{s}</span>
                  ))}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontFamily: "monospace", fontSize: 12 }}>
                  <THead cols={["Wall", "Lin Ft", "Uppers", "Lowers", "Total", "$/LF"]} />
                  <tbody>
                    {results.walls.map((w, i) => (
                      <tr key={i}>
                        <td style={td(false)}>
                          {w.name}
                          {w.dimensionsRead && w.dimensionsRead.length > 0 && (
                            <div style={{ fontSize: 10, color: C.brown, marginTop: 2 }}>{w.dimensionsRead.join(" + ")}</div>
                          )}
                        </td>
                        <td style={td(true)}>{fmtLF(w.totalLF)}</td>
                        <td style={td(true)}>{fmt(w.upperCost)}</td>
                        <td style={td(true)}>{fmt(w.lowerCost)}</td>
                        <td style={td(true)}>{fmt(w.totalCost)}</td>
                        <td style={td(true)}>{fmt(w.costPerLF)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={tdT(false)}>TOTAL</td>
                      <td style={tdT(true)}>{fmtLF(results.totalLF)} LF</td>
                      <td style={tdT(true)}>{fmt(results.totalUpperCost)}</td>
                      <td style={tdT(true)}>{fmt(results.totalLowerCost)}</td>
                      <td style={tdT(true)}>{fmt(results.grandTotal)}</td>
                      <td style={tdT(true)}>{fmt(results.blendedCostPerLF)}/LF</td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontFamily: "monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Summary", "LF", "$/LF", "Total"].map((h, i) => (
                        <th key={h} style={{ background: C.brown, color: C.cream, padding: "10px 14px", textAlign: i === 0 ? "left" : "right", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={td(false)}>Uppers</td>
                      <td style={td(true)}>{fmtLF(results.totalUpperLF)}</td>
                      <td style={td(true)}>{fmt(results.upperCostPerLF)}/LF</td>
                      <td style={td(true)}>{fmt(results.totalUpperCost)}</td>
                    </tr>
                    <tr>
                      <td style={td(false)}>Lowers</td>
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

                <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "14px 18px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 8 }}>AI Notes</div>
                  <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>{results.notes}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* PHOTO MODE */}
        {mode === "photo" && (
          <>
            <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "12px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.7 }}>
              Upload or take a photo of cabinets. AI identifies style, estimates LF, and prices to your specs.
            </div>

            <div style={{ background: C.warm, border: "1px solid " + C.border, padding: "28px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🚪</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Upload Cabinet Photo</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.dark, color: C.cream, padding: "12px 20px", cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  Gallery
                  <input type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.brown, color: C.cream, padding: "12px 20px", cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
                  Camera
                  <input type="file" accept="image/*" capture="environment" onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
                </label>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: C.brown, marginTop: 10 }}>Include a reference object for better scale accuracy</div>
              <Previews />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <Num label="Est. Width (inches, optional)" val={width} set={setWidth} ph="e.g. 120" />
              <Num label="Target Sale Price ($)" val={price} set={setPrice} ph="e.g. 40000" />
              <Sel label="Quote Grade" val={grade} set={setGrade} opts={GRADES} />
              <Sel label="Box Material" val={box} set={setBox} opts={BOX_TYPES} />
              <Sel label="Door Style" val={door} set={setDoor} opts={DOOR_STYLES} />
              <Sel label="Finish" val={finish} set={setFinish} opts={FINISHES} />
              <Sel label="Hardware" val={hardware} set={setHardware} opts={HARDWARE} />
            </div>

            <button onClick={analyzePhoto} disabled={loading} style={btnStyle}>
              {loading ? "Analyzing..." : "Analyze Photo & Price"}
            </button>

            {photoRes && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid " + C.dark }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Photo Analysis</div>
                  <div style={{ background: C.gold, color: C.dark, padding: "8px 18px", fontSize: 18, fontWeight: 700 }}>{fmt(photoRes.grandTotal)}</div>
                </div>

                <div style={{ background: C.warm, border: "1px solid " + C.border, padding: "10px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: C.brown, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Confidence:</span>
                  <strong style={{ color: photoRes.confidence === "High" ? "#4a7c59" : photoRes.confidence === "Medium" ? C.gold : C.red }}>{photoRes.confidence}</strong>
                  <span style={{ color: C.brown }}>— {photoRes.confidenceReason}</span>
                </div>

                <div style={{ background: C.warm, borderLeft: "3px solid " + C.dark, padding: "14px 18px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 10 }}>What AI Detected</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace", fontSize: 12 }}>
                    <div><span style={{ color: C.brown }}>Style: </span>{photoRes.detectedStyle}</div>
                    <div><span style={{ color: C.brown }}>Finish: </span>{photoRes.detectedFinish}</div>
                    <div><span style={{ color: C.brown }}>Door: </span>{photoRes.detectedDoorStyle}</div>
                    <div><span style={{ color: C.brown }}>Condition: </span>{photoRes.condition}</div>
                  </div>
                  {photoRes.specialFeatures && photoRes.specialFeatures.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {photoRes.specialFeatures.map(f => (
                        <span key={f} style={{ background: C.dark, color: C.cream, fontFamily: "monospace", fontSize: 10, padding: "3px 10px", letterSpacing: 1, textTransform: "uppercase" }}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontFamily: "monospace", fontSize: 12 }}>
                  <THead cols={["Cabinet Type", "Est. LF", "$/LF", "Total"]} />
                  <tbody>
                    <tr>
                      <td style={td(false)}>Upper Cabinets</td>
                      <td style={td(true)}>{fmtLF(photoRes.estimatedUpperLF)}</td>
                      <td style={td(true)}>{fmt(photoRes.upperCostPerLF)}/LF</td>
                      <td style={td(true)}>{fmt(photoRes.upperCost)}</td>
                    </tr>
                    <tr>
                      <td style={td(false)}>Lower Cabinets</td>
                      <td style={td(true)}>{fmtLF(photoRes.estimatedLowerLF)}</td>
                      <td style={td(true)}>{fmt(photoRes.lowerCostPerLF)}/LF</td>
                      <td style={td(true)}>{fmt(photoRes.lowerCost)}</td>
                    </tr>
                    <tr>
                      <td style={tdT(false)}>Total</td>
                      <td style={tdT(true)}>{fmtLF(photoRes.estimatedTotalLF)} LF</td>
                      <td style={tdT(true)}>{fmt(photoRes.blendedCostPerLF)}/LF</td>
                      <td style={tdT(true)}>{fmt(photoRes.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>

                {photoRes.recommendations && photoRes.recommendations.length > 0 && (
                  <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "14px 18px", marginBottom: 16 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 8 }}>Recommendations</div>
                    <ul style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2, paddingLeft: 16 }}>
                      {photoRes.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ background: C.warm, borderLeft: "3px solid " + C.gold, padding: "14px 18px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.brown, marginBottom: 8 }}>AI Notes</div>
                  <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>{photoRes.notes}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
