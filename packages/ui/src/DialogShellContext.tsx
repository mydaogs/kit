"use client";

import { createContext } from "react";
import type { DialogShellApi } from "./dialog-shell/createDialogShellStore";

export const DialogShellContext = createContext<DialogShellApi | null>(null);
