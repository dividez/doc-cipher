import { BUILD_INFO } from '../build-info.js';

/** 是否为内置 llama 运行时的 AI 版构建（编译期由 DOCIPHER_BUNDLE_LLAMA 决定）。 */
export function isLocalAiBundled(): boolean {
  return BUILD_INFO.features.localAi;
}

/** 本地开发构建（未注入 GITHUB_SHA 时为 dev）。 */
export function isDevBuild(): boolean {
  return String(BUILD_INFO.build) === 'dev';
}
