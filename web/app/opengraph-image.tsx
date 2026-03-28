import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GerMedBench — LLM-Benchmark für deutsche klinische Texte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo bars */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
          <div
            style={{
              width: "32px",
              height: "60px",
              borderRadius: "8px",
              background: "rgba(99, 102, 241, 0.4)",
              marginTop: "40px",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "80px",
              borderRadius: "8px",
              background: "rgba(99, 102, 241, 0.7)",
              marginTop: "20px",
            }}
          />
          <div
            style={{
              width: "32px",
              height: "100px",
              borderRadius: "8px",
              background: "#6366f1",
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
          }}
        >
          <span style={{ color: "#6366f1" }}>Ger</span>
          <span style={{ color: "#f1f5f9" }}>Med</span>
          <span style={{ color: "#6366f1" }}>Bench</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            marginTop: "16px",
            textAlign: "center",
            maxWidth: "800px",
          }}
        >
          LLM-Benchmark für deutsche klinische Texte
        </div>

        {/* Tags */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "40px",
          }}
        >
          {["ICD-10 Kodierung", "Zusammenfassung", "Klinisches Reasoning", "NER"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  padding: "8px 20px",
                  borderRadius: "999px",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "#94a3b8",
                  fontSize: "18px",
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "18px",
            color: "#64748b",
          }}
        >
          germedbench.de — by ThalamiQ
        </div>
      </div>
    ),
    { ...size }
  );
}
