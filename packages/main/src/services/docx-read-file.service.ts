import { access, constants, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { DocxReadFilePayload, DocxReadFileResult } from '@app/shared';

export async function readDocxFile(payload: DocxReadFilePayload): Promise<DocxReadFileResult> {
  if (extname(payload.filePath).toLowerCase() !== '.docx') {
    throw new Error('仅支持 .docx 文件');
  }

  await access(payload.filePath, constants.R_OK);
  const buffer = await readFile(payload.filePath);
  return { base64: buffer.toString('base64') };
}
