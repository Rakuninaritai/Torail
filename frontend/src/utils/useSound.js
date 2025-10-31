// src/utils/useSound.js
import { useRef, useCallback, useEffect } from "react";

export default function useSound() {
  const ctxRef = useRef(null);
  const getCtx = () => (ctxRef.current ??= new (window.AudioContext || window.webkitAudioContext)());
  // ★ 初回ユーザー操作で AudioContext を確実に再開（自動再生ポリシー対策）
  useEffect(() => {
    const unlock = () => {
      try { getCtx().resume?.(); } catch {}
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const beep = useCallback(async (freq = 880, ms = 140) => {
    const ctx = getCtx();
    try { await ctx.resume?.(); } catch {}
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.04; // 小さめ
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect(); gain.disconnect();
    }, ms);
  }, []);

  // 中断時：下降2音、再開時：上昇2音
  const playPause = useCallback(async () => { await beep(660, 120); setTimeout(()=>beep(520,130), 120); }, [beep]);
  const playResume = useCallback(async () => { await beep(520, 120); setTimeout(()=>beep(660,130), 120); }, [beep]);

  return { beep, playPause, playResume };
}
