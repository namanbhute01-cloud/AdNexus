import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class DeviceCertGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ deviceCert?: unknown }>();
    return Boolean(req.deviceCert);
  }
}

