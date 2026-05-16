import {createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import type {EncryptedMapping, RestoreMapping} from '@app/shared';
import {encryptedMappingSchema, restoreMappingSchema} from '@app/shared';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  if (!password) {
    throw new Error('密码不能为空');
  }

  return await scrypt(password, salt, KEY_LENGTH) as Buffer;
}

export async function encryptMapping(mapping: RestoreMapping, password: string): Promise<EncryptedMapping> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(restoreMappingSchema.parse(mapping)), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    version: '1.0.0',
    algorithm: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export async function decryptMapping(payload: unknown, password: string): Promise<RestoreMapping> {
  const encrypted = encryptedMappingSchema.parse(payload);
  const salt = Buffer.from(encrypted.salt, 'base64');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const key = await deriveKey(password, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return restoreMappingSchema.parse(JSON.parse(plaintext.toString('utf8')));
}
