import { BUILD_INFO } from '../build-info.js';

/** 是否为内置 llama 运行时的 AI 版构建（编译期由 DOCIPHER_BUNDLE_LLAMA 决定）。 */
export function isLocalAiBundled(): boolean {
  return BUILD_INFO.features.localAi;
}
