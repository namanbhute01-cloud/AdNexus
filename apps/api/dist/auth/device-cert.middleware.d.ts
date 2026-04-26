import { NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
type MaybeTLSRequest = Request & {
    deviceCert?: unknown;
    socket: Request['socket'] & {
        authorized?: boolean;
        getPeerCertificate?: () => unknown;
    };
};
export declare class DeviceCertMiddleware implements NestMiddleware {
    use(req: MaybeTLSRequest, _res: Response, next: NextFunction): void;
}
export {};
