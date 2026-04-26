import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class DeviceCertGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
