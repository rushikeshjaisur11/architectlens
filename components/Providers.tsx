"use client";

import { SessionProvider } from "next-auth/react";
import { ProgressSync } from "./ProgressSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ProgressSync />
      {children}
    </SessionProvider>
  );
}
