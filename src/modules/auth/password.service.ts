import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// 12 rounds: ~300ms on modern hardware — slow enough to prevent brute force,
// fast enough for user-facing login. OWASP recommends >= 10.
const SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, SALT_ROUNDS);
  }

  async compare(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
