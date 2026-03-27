"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import type { FeedbackWidgetProps } from "./types";
import { VoiceRecorder } from "./recorder";

// ─── Inline Styles ──────────────────────────────────────────────────────────

const colors = {
  bg: "#1a1a2e",
  bgSecondary: "#16213e",
  bgTertiary: "#0f3460",
  border: "#1a3a5c",
  text: "#e0e0e0",
  textSecondary: "#8899aa",
  primary: "#4361ee",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  white: "#ffffff",
  backdrop: "rgba(0,0,0,0.4)",
};

// ─── Component ──────────────────────────────────────────────────────────────

type FeedbackTab = "text" | "voice";

export function FeedbackWidget({
  user,
  onSubmit,
  transcribe,
  placeholder = "Bug, idea, complaint, compliment — anything goes...",
  maxRecordingSeconds = 300,
  warningSeconds = 30,
}: FeedbackWidgetProps) {
  const recorderRef = useRef<VoiceRecorder | null>(null);
  if (!recorderRef.current) {
    recorderRef.current = new VoiceRecorder(
      maxRecordingSeconds,
      warningSeconds,
      transcribe,
      onSubmit,
      user,
    );
  }
  const recorder = recorderRef.current;

  const recorderState = useSyncExternalStore(
    (cb) => recorder.subscribe(cb),
    () => ({
      recordingState: recorder.state,
      elapsedTime: recorder.elapsedTime,
      errorMessage: recorder.errorMessage,
      timeWarning: recorder.timeWarning,
    }),
  );

  const { recordingState, elapsedTime, errorMessage, timeWarning } = recorderState;

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<FeedbackTab>("text");
  const [response, setResponse] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isActivelyRecording =
    recordingState === "recording" ||
    recordingState === "requesting-permission" ||
    recordingState === "time-limit";
  const showMiniIndicator = !isOpen && isActivelyRecording;

  // ── Text submit ──
  const handleTextSubmit = async () => {
    if (!response.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit({
        type: "text",
        response: response.trim(),
        page: window.location.pathname,
        userId: user.id,
        userName: user.name,
        timestamp: new Date(),
      });
      setResponse("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch {
      // consumer's onSubmit handles its own errors
    } finally {
      setIsSaving(false);
    }
  };

  // ── Voice controls ──
  const startRecording = useCallback(() => recorder.startRecording(), [recorder]);
  const cancelRecording = useCallback(() => recorder.cancelRecording(), [recorder]);
  const finishRecording = useCallback(() => recorder.finishRecording(), [recorder]);

  // Keyboard shortcuts
  useEffect(() => {
    if (recordingState === "idle") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRecording();
      } else if (e.key === "Enter" && recordingState === "recording") {
        e.preventDefault();
        finishRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingState, cancelRecording, finishRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const maxMinutes = Math.floor(maxRecordingSeconds / 60);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      {!showMiniIndicator && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Give Feedback"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: colors.primary,
            color: colors.white,
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Mini recording indicator */}
      {showMiniIndicator && (
        <button
          onClick={() => {
            setTab("voice");
            setIsOpen(true);
          }}
          aria-label="Recording in progress"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 999,
            background: recordingState === "time-limit" || timeWarning ? colors.amber : colors.red,
            color: colors.white,
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: colors.white,
              animation: `fb-pulse ${recordingState === "time-limit" ? "0.5s" : "1s"} ease-in-out infinite`,
            }}
          />
          {recordingState === "time-limit" ? "Sending..." : formatTime(elapsedTime)}
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
            />
          </svg>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{ position: "fixed", inset: 0, background: colors.backdrop, zIndex: 9999 }}
        />
      )}

      {/* Slide-out panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "100%",
          maxWidth: 420,
          zIndex: 10000,
          background: colors.bg,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease-out",
          display: "flex",
          flexDirection: "column",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: colors.text,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Feedback</div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Type it or just talk
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: colors.textSecondary,
              cursor: "pointer",
              padding: 8,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}` }}>
          {(["text", "voice"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 14,
                fontWeight: 500,
                background: "none",
                border: "none",
                borderBottom: tab === t ? `2px solid ${colors.primary}` : "2px solid transparent",
                color: tab === t ? colors.primary : colors.textSecondary,
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {t === "text" ? "Write" : "Talk"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {/* ── TEXT TAB ── */}
          {tab === "text" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {showSuccess ? (
                <SuccessMessage message="Thanks for the feedback!" />
              ) : (
                <>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder={placeholder}
                    rows={8}
                    style={{
                      width: "100%",
                      flex: 1,
                      padding: "12px 16px",
                      background: colors.bgTertiary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      color: colors.text,
                      fontSize: 14,
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12 }}>
                    {user.name} &middot; {window.location.pathname}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── VOICE TAB ── */}
          {tab === "voice" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
                gap: 24,
              }}
            >
              {recordingState === "idle" && (
                <>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      background: `${colors.primary}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="48" height="48" fill="none" stroke={colors.primary} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Voice Feedback</div>
                    <div style={{ fontSize: 14, color: colors.textSecondary, maxWidth: 280 }}>
                      Hit record and talk for up to {maxMinutes} minute{maxMinutes !== 1 ? "s" : ""}.
                      Say whatever comes to mind — it gets transcribed automatically.
                    </div>
                  </div>
                  <PrimaryButton onClick={startRecording}>Start Recording</PrimaryButton>
                </>
              )}

              {recordingState === "requesting-permission" && (
                <div style={{ color: colors.textSecondary }}>Requesting microphone access...</div>
              )}

              {recordingState === "recording" && (
                <>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      background: `${colors.red}33`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: colors.red,
                        animation: "fb-pulse 1s ease-in-out infinite",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500 }}>Recording</div>
                    <div style={{ fontSize: 28, fontFamily: "monospace", color: colors.primary, marginTop: 4 }}>
                      {formatTime(elapsedTime)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 8,
                        color: timeWarning ? colors.amber : colors.textSecondary,
                        fontWeight: timeWarning ? 600 : 400,
                        animation: timeWarning ? "fb-pulse 1s ease-in-out infinite" : undefined,
                      }}
                    >
                      {maxRecordingSeconds - elapsedTime}s remaining
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <SecondaryButton onClick={cancelRecording}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={finishRecording}>Send Feedback</PrimaryButton>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>
                    <Kbd>Esc</Kbd> cancel <Kbd style={{ marginLeft: 8 }}>Enter</Kbd> send
                  </div>
                </>
              )}

              {recordingState === "time-limit" && (
                <>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      background: `${colors.amber}33`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="48"
                      height="48"
                      fill="none"
                      stroke={colors.amber}
                      viewBox="0 0 24 24"
                      style={{ animation: "fb-pulse 0.5s ease-in-out infinite" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: colors.amber }}>Time limit reached</div>
                    <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
                      Auto-sending in a moment...
                    </div>
                  </div>
                </>
              )}

              {recordingState === "submitting" && (
                <div style={{ color: colors.textSecondary }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      border: `2px solid ${colors.primary}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "fb-spin 0.8s linear infinite",
                      margin: "0 auto 12px",
                    }}
                  />
                  Sending feedback...
                </div>
              )}

              {recordingState === "success" && (
                <SuccessMessage message="Feedback sent! Your recording has been transcribed." />
              )}

              {recordingState === "error" && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: `${colors.red}33`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <svg width="32" height="32" fill="none" stroke={colors.red} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div style={{ color: colors.red, marginBottom: 16 }}>
                    {errorMessage || "An error occurred"}
                  </div>
                  <SecondaryButton onClick={() => recorder.reset()}>Try Again</SecondaryButton>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — text tab only */}
        {tab === "text" && !showSuccess && (
          <div style={{ padding: 16, borderTop: `1px solid ${colors.border}`, background: colors.bg }}>
            <PrimaryButton
              onClick={handleTextSubmit}
              disabled={!response.trim() || isSaving}
              style={{ width: "100%" }}
            >
              {isSaving ? "Submitting..." : "Submit Feedback"}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fb-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────

function PrimaryButton({
  children,
  disabled,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      style={{
        padding: "10px 32px",
        fontSize: 14,
        fontWeight: 600,
        borderRadius: 8,
        border: "none",
        background: disabled ? `${colors.primary}66` : colors.primary,
        color: colors.white,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      style={{
        padding: "10px 24px",
        fontSize: 14,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: "transparent",
        color: colors.textSecondary,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function Kbd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <kbd
      style={{
        padding: "2px 6px",
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        fontSize: 11,
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `${colors.green}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <svg width="32" height="32" fill="none" stroke={colors.green} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{message}</div>
      <div style={{ fontSize: 14, color: colors.textSecondary }}>Your input helps make this better.</div>
    </div>
  );
}
