"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Real Time Voice Chatting",
  "Free 4K Screen Share",
  "Tournaments Organizations",
  "Phone Calls and Messaging",
];

const ROTATE_MS = 3000;
const FADE_MS = 500;

export function RotatingTagline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout>;

    const id = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);

    return () => {
      clearInterval(id);
      clearTimeout(swap);
    };
  }, []);

  return (
    <div className="flex min-h-[5rem] items-center justify-center px-4 text-center">
      <h2
        className={`text-3xl font-bold leading-tight tracking-tight text-white transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {PHRASES[index]}
      </h2>
    </div>
  );
}
