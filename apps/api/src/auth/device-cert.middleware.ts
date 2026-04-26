import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type MaybeTLSRequest = Request & {
  deviceCert?: unknown;
  socket: Request['socket'] & {
    authorized?: boolean;
    getPeerCertificate?: () => unknown;
  };
};

@Injectable()
export class DeviceCertMiddleware implements NestMiddleware {
  use(req: MaybeTLSRequest, _res: Response, next: NextFunction): void {
    const certFromHeader = req.header('x-device-cert');
    const certFromProxy = req.header('x-ssl-client-cert');

    if (certFromHeader || certFromProxy) {
      req.deviceCert = certFromHeader ?? certFromProxy ?? true;
      next();
      return;
    }

    if (req.socket?.authorized && req.socket.getPeerCertificate) {
      const cert = req.socket.getPeerCertificate();
      if (cert) {
        req.deviceCert = cert;
      }
    }
    next();
  }
}

