/// <reference types="vite/client" />

declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  export interface RegisterSWOptions {
    immediate?: boolean;
    onRegistered?(registration: ServiceWorkerRegistration | undefined): void;
    onRegisterError?(error: unknown): void;
    onOfflineReady?(): void;
    onNeedRefresh?(): void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker(reloadPage?: boolean): Promise<void>;
  };
}
