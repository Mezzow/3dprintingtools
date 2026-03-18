import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import ImageToSTL from './App.jsx'
import TextCircleTool from './TextCircleTool.jsx'

var TOOLS = [
  { id: "image", label: "Bild zu STL", desc: "Bild in 3D-Druck umwandeln" },
  { id: "textcircle", label: "Text + Ellipse", desc: "Text mit Ellipse als 3D-Druck" },
];

function App() {
  var _s = useState;
  var sa = _s("image"), activeTab = sa[0], setActiveTab = sa[1];

  return (
    <div style={{
      minHeight: "100vh", background: "#faf5ef",
      fontFamily: "'Nunito', 'Segoe UI', sans-serif", color: "#3d2e1f", padding: "16px",
      display: "flex", flexDirection: "column", alignItems: "center"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#6b4c30" }}>
          3D-Druck Werkzeuge
        </h1>
        <p style={{ fontSize: 14, color: "#9a7d5f", margin: "4px 0 0" }}>
          Werkzeuge zum Erstellen von 3D-druckbaren STL-Dateien
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 20,
        background: "#fff", borderRadius: 16, padding: 4,
        boxShadow: "0 2px 8px rgba(80,50,20,0.08)",
        width: "100%", maxWidth: 540
      }}>
        {TOOLS.map(function(tool) {
          var isActive = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              onClick={function() { setActiveTab(tool.id); }}
              style={{
                flex: 1, padding: "12px 8px",
                background: isActive ? "linear-gradient(135deg, #c97d44, #a05e2c)" : "transparent",
                color: isActive ? "#fff" : "#9a7d5f",
                border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: isActive ? 800 : 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2
              }}
            >
              <span>{tool.label}</span>
              <span style={{
                fontSize: 10, opacity: isActive ? 0.85 : 0.7,
                fontWeight: 400
              }}>{tool.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Tool Content */}
      {activeTab === "image" && <ImageToSTL />}
      {activeTab === "textcircle" && <TextCircleTool />}

      <div style={{ marginTop: 28, fontSize: 12, color: "#bba88e", textAlign: "center", maxWidth: 440, lineHeight: 1.6 }}>
        Tipp: Die STL-Datei kann direkt in Bambu Studio, Cura oder PrusaSlicer geladen werden.
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
