import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';

@Injectable()
export class AuthService {
  generateTotpSecret(label: string): { secret: string; otpauthUrl: string } {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      secret,
      label,
      issuer: 'AdNexus',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
    return { secret, otpauthUrl };
  }

  verifyTotp(token: string, secret: string): boolean {
    return verifySync({
      token,
      secret,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epochTolerance: 30,
    }).valid;
  }
}
