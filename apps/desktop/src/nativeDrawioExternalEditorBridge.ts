import { invoke } from "@tauri-apps/api/core";
import {
  hashDrawioSourceBytes,
  isUsableDrawioSource,
  type DrawioBridgeSession,
  type DrawioSaveBackResult,
  type DrawioBridgeStatusEvent
} from "./drawioBridgeModel.js";

interface CheckoutResponse {
  sessionId: string;
  sourceAssetId: string;
  tempPath: string;
  originalSourceHash: string;
}

interface ReadBackResponse {
  sessionId: string;
  sourceAssetId: string;
  tempPath: string;
  status: DrawioSaveBackResult["status"];
  sourceHash?: string;
  sourceBytes?: number[];
  message?: string;
}

export interface DrawioExternalEditorBridge {
  checkoutSource(sourceAssetId: string, sourceBytes: Uint8Array): Promise<DrawioBridgeSession>;
  openExternalEditor(sessionId: string, executablePath?: string): Promise<DrawioBridgeStatusEvent>;
  readEditedSource(session: DrawioBridgeSession, latestSourceBytes: Uint8Array): Promise<DrawioSaveBackResult>;
  closeSession(sessionId: string): Promise<DrawioBridgeStatusEvent>;
}

export const nativeDrawioExternalEditorBridge: DrawioExternalEditorBridge = {
  async checkoutSource(sourceAssetId, sourceBytes) {
    if (!isUsableDrawioSource(sourceBytes)) {
      throw new Error(`Invalid Draw.io source asset: ${sourceAssetId}`);
    }

    return invoke<CheckoutResponse>("checkout_drawio_source_asset", {
      sourceAssetId,
      sourceBytes: Array.from(sourceBytes)
    });
  },

  async openExternalEditor(sessionId, executablePath) {
    return invoke<DrawioBridgeStatusEvent>("open_drawio_external_editor", {
      sessionId,
      executablePath: executablePath?.trim() || null
    });
  },

  async readEditedSource(session, latestSourceBytes) {
    const result = await invoke<ReadBackResponse>("read_drawio_external_edit", {
      sessionId: session.sessionId,
      latestSourceHash: hashDrawioSourceBytes(latestSourceBytes)
    });

    return {
      status: result.status,
      sessionId: result.sessionId,
      sourceAssetId: result.sourceAssetId,
      tempPath: result.tempPath,
      sourceHash: result.sourceHash,
      message: result.message,
      sourceBytes: result.sourceBytes ? new Uint8Array(result.sourceBytes) : undefined
    };
  },

  async closeSession(sessionId) {
    return invoke<DrawioBridgeStatusEvent>("close_drawio_external_edit", { sessionId });
  }
};
