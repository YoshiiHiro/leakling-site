/// <reference types="vite/client" />

declare module "*.png" {
  const src: string;
  export default src;
}

interface Window {
  electronAPI?: {
    isElectron: boolean;
    minimizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    hideToTray: () => Promise<void>;
    showFromTray: () => Promise<void>;
    resizeToContent: (contentHeight: number) => Promise<void>;
    showOverlay: (opts?: { position?: string; opacity?: number }) => Promise<void>;
    hideOverlay: () => Promise<void>;
    setOverlayOpacity: (opacity: number) => Promise<void>;
    setOverlayPosition: (pos: string) => Promise<void>;
    sendDeathEvent: (data: any) => void;
    sendTagEvent: (data: any) => void;
    sendSkipEvent: (data: any) => void;
    sendDismissEvent: (data: any) => void;
    onHotkey: (cb: (name: string) => void) => () => void;
    snapScreen: (screenIndex?: number, opts?: { width?: number; height?: number }) => Promise<{ success: boolean; dataUrl?: string; width?: number; height?: number; bytes?: number; screenIndex?: number; screenName?: string; error?: string }>;
    detectScreens: () => Promise<{ success: boolean; displays?: Array<{ index: number; id: number; internal: boolean; bounds: any; size: any; primary: boolean }>; valorantScreenIndex?: number | null; videoViewerScreenIndex?: number | null; valorantFound?: boolean; videoViewerFound?: boolean; error?: string }>;
    isValorantOpen: () => Promise<{ success: boolean; isOpen: boolean; error?: string }>;
    isVideoViewerOpen: () => Promise<{ success: boolean; isOpen: boolean; screenIndex?: number | null; error?: string }>;
    snapWindow: (kind?: string, opts?: { width?: number; height?: number }) => Promise<{ success: boolean; dataUrl?: string; width?: number; height?: number; bytes?: number; name?: string; error?: string }>;
    ocrRecognize: (dataUrl: string) => Promise<{ success: boolean; text?: string; confidence?: number; error?: string }>;
    loadModel: () => Promise<{ success: boolean; loaded?: boolean; flawTypes?: string[]; flawNames?: string[]; numFrames?: number; frameSize?: number; error?: string }>;
    detectFlaw: (payload: { flawedFrames: number[][]; flawlessFrames: number[][] }) => Promise<{ success: boolean; flawIndex?: number; flawType?: string; flawName?: string; severity?: number; confidence?: number; logits?: number[]; probs?: number[]; error?: string }>;
    getModelMetadata: () => Promise<{ success: boolean; metadata?: any; flawTypes?: string[]; error?: string }>;
    updateHotkeys: (hotkeys: { toggle?: string; manualTag?: string }) => Promise<{ success: boolean }>;
  };
  simulateDeathAutopsy?: () => any;
  endMockMatch?: (outcome?: string) => any;
  owEventBus?: any;
  autopsyStore?: any;
  MOCK_MODE?: boolean;
  testSnap?: () => Promise<string>;
}
