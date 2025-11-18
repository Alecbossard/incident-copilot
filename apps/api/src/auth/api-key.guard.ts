import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly headerName = 'x-api-key';
    private readonly bypassPaths = new Set<string>(['/health']);

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request & { path?: string }>();

        // Bypass preflight + /health
        const method = (req as any).method?.toUpperCase?.() ?? '';
        const path = (req as any).path ?? (req as any).url ?? '';
        if (method === 'OPTIONS') return true;
        if (this.bypassPaths.has(path)) return true;

        const expected = process.env.API_KEY;
        // Pas de clé définie => on ne bloque pas en dev
        if (!expected) return true;

        const got =
            ((req as any).headers?.[this.headerName] as string | undefined) ??
            ((req as any).headers?.[this.headerName.toLowerCase()] as string | undefined);

        if (got && got === expected) return true;

        throw new UnauthorizedException('Missing or invalid x-api-key');
    }
}
