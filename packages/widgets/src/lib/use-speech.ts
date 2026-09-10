"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Pronunciation via the browser's Web Speech API — free, offline, no key.
 * Isolated here so a cloud-TTS adapter could replace it later without touching
 * callers. `language` is the widget's target-language string (e.g. "Spanish").
 */

// Common language names → BCP-47 tags. Unknown names fall back to the raw value
// if it already looks like a code, else "" (browser default voice).
const LANG_MAP: Record<string, string> = {
  spanish: "es-ES",
  español: "es-ES",
  espanol: "es-ES",
  german: "de-DE",
  deutsch: "de-DE",
  french: "fr-FR",
  français: "fr-FR",
  francais: "fr-FR",
  italian: "it-IT",
  italiano: "it-IT",
  portuguese: "pt-PT",
  português: "pt-PT",
  english: "en-US",
  dutch: "nl-NL",
  polish: "pl-PL",
  russian: "ru-RU",
  japanese: "ja-JP",
  mandarin: "zh-CN",
  chinese: "zh-CN",
};

export function toBcp47(language: string): string {
  const key = language.trim().toLowerCase();
  if (LANG_MAP[key]) return LANG_MAP[key];
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(language.trim())) return language.trim();
  return "";
}

export function useSpeech(language: string): {
  speak: (text: string) => void;
  supported: boolean;
} {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const lang = toBcp47(language);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (lang) utter.lang = lang;
      const prefix = lang.slice(0, 2).toLowerCase();
      const voice = prefix
        ? voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
        : undefined;
      if (voice) utter.voice = voice;
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    },
    [supported, lang, voices],
  );

  return { speak, supported };
}
