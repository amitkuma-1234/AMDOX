export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "1rem",
          }}
        >
          AMDOX
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            color: "#94a3b8",
            maxWidth: "600px",
            lineHeight: 1.6,
          }}
        >
          Intelligent Document Platform — AI-powered enterprise workflows.
        </p>
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "9999px",
              background: "rgba(102, 126, 234, 0.15)",
              border: "1px solid rgba(102, 126, 234, 0.3)",
              fontSize: "0.875rem",
              color: "#667eea",
            }}
          >
            Next.js 15
          </span>
          <span
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "9999px",
              background: "rgba(118, 75, 162, 0.15)",
              border: "1px solid rgba(118, 75, 162, 0.3)",
              fontSize: "0.875rem",
              color: "#a78bfa",
            }}
          >
            Turbopack
          </span>
          <span
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "9999px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontSize: "0.875rem",
              color: "#10b981",
            }}
          >
            React 19
          </span>
        </div>
      </div>
    </main>
  );
}
