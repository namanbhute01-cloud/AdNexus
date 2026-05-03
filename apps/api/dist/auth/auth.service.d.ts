export declare class AuthService {
    generateTotpSecret(label: string): {
        secret: string;
        otpauthUrl: string;
    };
    verifyTotp(token: string, secret: string): boolean;
}
