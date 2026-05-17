import { randomBytes } from 'node:crypto';

const PROFILE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function createProfileId(): string {
  return randomBytes(12).toString('base64url');
}

export function isValidProfileId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && PROFILE_ID_PATTERN.test(id);
}
