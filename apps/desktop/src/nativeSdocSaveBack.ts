import { nativeWorkspaceAdapter, type NativeWorkspaceAdapter } from "./nativeWorkspaceAdapter.js";
import {
  createNativeSdocSaveBackPlan,
  runNativeSdocSaveBack,
  type NativeSdocSaveBackPlan,
  type NativeSdocSaveBackRequest,
  type NativeSdocSaveBackResult
} from "./sdocSaveBackModel.js";

export interface NativeSdocSaveBackExecution {
  plan: NativeSdocSaveBackPlan;
  result: NativeSdocSaveBackResult;
}

export async function saveSdocPackageToNativeFile(
  request: NativeSdocSaveBackRequest,
  writer: Pick<NativeWorkspaceAdapter, "writeSdoc"> = nativeWorkspaceAdapter
): Promise<NativeSdocSaveBackExecution> {
  const plan = createNativeSdocSaveBackPlan(request);
  const result = await runNativeSdocSaveBack(writer, plan, request.bytes);
  return { plan, result };
}
