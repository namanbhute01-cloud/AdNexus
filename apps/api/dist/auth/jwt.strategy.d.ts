import { ConfigService } from '@nestjs/config';
type JwtPayload = {
    sub: string;
    serial_number?: string;
    roles?: string[];
};
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: JwtPayload): JwtPayload;
}
export {};
