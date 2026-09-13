import "react-native-gesture-handler";
import { registerRootComponent } from "expo";

import App from "./App";

// Startup crashes ko Metro terminal mein clear dikhao
const errorUtils = (globalThis as { ErrorUtils?: {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
} }).ErrorUtils;

if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const err = error as { message?: string; stack?: string };
    console.error("[DLMS fatal]", isFatal, err?.message || error);
    if (err?.stack) console.error(err.stack);
    previousHandler?.(error, isFatal);
  });
}

// ye app ka entry point hai
registerRootComponent(App);
