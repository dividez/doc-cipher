export const RECOGNITION_CANCELLED_MESSAGE = '已取消识别，文档未改写';

export function isRecognitionCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('已取消识别');
}
