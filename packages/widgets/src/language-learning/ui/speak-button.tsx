"use client";

import { IconButton } from "@chakra-ui/react";
import { useSpeech } from "./use-speech";

interface SpeakButtonProps {
  text: string;
  language: string;
  size?: "2xs" | "xs" | "sm";
}

/** A small 🔊 button that speaks target-language text. Renders nothing if the
 *  browser has no speech synthesis. */
export function SpeakButton({ text, language, size = "xs" }: SpeakButtonProps) {
  const { speak, supported } = useSpeech(language);
  if (!supported || !text.trim()) return null;
  return (
    <IconButton
      size={size}
      variant="ghost"
      color="fg.muted"
      _hover={{ color: "accent.solid" }}
      aria-label={`Pronounce: ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      🔊
    </IconButton>
  );
}
