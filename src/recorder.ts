import type { FeedbackEntry, FeedbackUser } from "./types";

export type RecordingState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "time-limit"
  | "submitting"
  | "success"
  | "error";

export type RecorderListener = (state: {
  recordingState: RecordingState;
  elapsedTime: number;
  errorMessage: string | null;
  timeWarning: boolean;
}) => void;

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timerId: number | null = null;
  private mimeType: string = "audio/webm";
  private stream: MediaStream | null = null;
  private warningSent = false;

  private _state: RecordingState = "idle";
  private _elapsedTime = 0;
  private _errorMessage: string | null = null;
  private _timeWarning = false;
  private _listeners = new Set<RecorderListener>();

  constructor(
    private maxSeconds: number,
    private warningSeconds: number,
    private transcribe: string | ((audio: Blob) => Promise<string>),
    private onSubmit: (entry: FeedbackEntry) => Promise<void>,
    private user: FeedbackUser,
  ) {}

  get state() {
    return this._state;
  }
  get elapsedTime() {
    return this._elapsedTime;
  }
  get errorMessage() {
    return this._errorMessage;
  }
  get timeWarning() {
    return this._timeWarning;
  }

  subscribe(listener: RecorderListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify() {
    const snapshot = {
      recordingState: this._state,
      elapsedTime: this._elapsedTime,
      errorMessage: this._errorMessage,
      timeWarning: this._timeWarning,
    };
    this._listeners.forEach((l) => l(snapshot));
  }

  private setState(s: RecordingState) {
    this._state = s;
    this.notify();
  }
  private setElapsed(t: number) {
    this._elapsedTime = t;
    this.notify();
  }
  private setError(msg: string | null) {
    this._errorMessage = msg;
    this.notify();
  }
  private setWarning(w: boolean) {
    this._timeWarning = w;
    this.notify();
  }

  async startRecording(): Promise<void> {
    try {
      this.setState("requesting-permission");
      this.setError(null);
      this.setWarning(false);
      this.warningSent = false;

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.chunks = [];

      this.mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "audio/wav";

      const mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.mimeType,
      });
      this.mediaRecorder = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      mediaRecorder.onerror = () => {
        this.setState("error");
        this.setError("Recording failed. Please try again.");
        this.cleanup();
      };

      mediaRecorder.start(1000);
      this.setState("recording");
      this.setElapsed(0);

      this.timerId = window.setInterval(() => {
        const newTime = this._elapsedTime + 1;
        this.setElapsed(newTime);

        if (newTime >= this.maxSeconds - this.warningSeconds && !this.warningSent) {
          this.warningSent = true;
          this.setWarning(true);
        }
        if (newTime >= this.maxSeconds) {
          this.handleTimeLimit();
        }
      }, 1000);
    } catch (error) {
      this.setState("error");
      this.setError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission denied. Please enable it in your browser settings."
          : "Failed to access microphone. Please try again.",
      );
    }
  }

  private cleanup(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private handleTimeLimit(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.setState("time-limit");
    setTimeout(() => this.finishRecording(), 2000);
  }

  cancelRecording(): void {
    this.cleanup();
    this.setState("idle");
    this.setElapsed(0);
    this.setError(null);
    this.setWarning(false);
  }

  async finishRecording(): Promise<void> {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.requestData();
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    const duration = this._elapsedTime;
    const blob = new Blob(this.chunks, { type: this.mimeType });
    this.mediaRecorder = null;
    this.chunks = [];

    await this.submitFeedback(blob, duration);
  }

  private async submitFeedback(blob: Blob, duration: number): Promise<void> {
    this.setState("submitting");

    try {
      let transcript: string;

      if (typeof this.transcribe === "function") {
        transcript = await this.transcribe(blob);
      } else {
        const formData = new FormData();
        const extension = this.mimeType.includes("webm")
          ? "webm"
          : this.mimeType.includes("mp4")
            ? "m4a"
            : "wav";
        formData.append("audio", blob, `feedback-${Date.now()}.${extension}`);

        const response = await fetch(this.transcribe, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        transcript = data.transcript;
      }

      await this.onSubmit({
        type: "voice",
        response: transcript || "(transcription failed)",
        page: typeof window !== "undefined" ? window.location.pathname : "",
        userId: this.user.id,
        userName: this.user.name,
        durationSeconds: duration,
        timestamp: new Date(),
      });

      this.setState("success");
      setTimeout(() => {
        this.setState("idle");
        this.setElapsed(0);
        this.setError(null);
        this.setWarning(false);
      }, 3000);
    } catch (error) {
      this.setState("error");
      this.setError(
        error instanceof Error
          ? error.message
          : "Failed to send feedback. Please try again.",
      );
    }
  }

  reset(): void {
    this.setState("idle");
    this.setElapsed(0);
    this.setError(null);
    this.setWarning(false);
  }
}
