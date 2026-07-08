import { describe, expect, it } from 'vitest';
import { checksum } from '../services/storage.js';

describe('storage service', () => {
  it('generates consistent sha256 checksums', () => {
    const hash = checksum(Buffer.from('test'));
    expect(hash).toHaveLength(64);
    expect(hash).toBe(checksum(Buffer.from('test')));
  });
});
