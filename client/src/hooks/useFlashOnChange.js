import { useEffect, useRef, useState } from "react";

/** Returns "flash-up" | "flash-down" | "" for ~900ms after `value` changes. */
export default function useFlashOnChange(value, duration = 900) {
  const previous = useRef(value);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const before = Number(previous.current);
    const after = Number(value);

    previous.current = value;

    if (!Number.isFinite(before) || before === after) return;

    setFlash(after > before ? "flash-up" : "flash-down");

    const id = setTimeout(() => setFlash(""), duration);
    return () => clearTimeout(id);
  }, [value, duration]);

  return flash;
}