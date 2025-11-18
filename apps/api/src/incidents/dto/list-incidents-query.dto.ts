import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsPositive,
    IsString,
    Max,
    Min,
} from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

function csvToEnumArray<T>(raw: unknown): T[] {
    if (typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0) as unknown as T[];
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export class ListIncidentsQueryDto {
    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @Transform(({ value }) => csvToEnumArray<IncidentStatus>(value))
    @IsEnum(IncidentStatus, { each: true })
    status?: IncidentStatus[];

    @IsOptional()
    @Transform(({ value }) => csvToEnumArray<IncidentSeverity>(value))
    @IsEnum(IncidentSeverity, { each: true })
    severity?: IncidentSeverity[];

    @IsOptional()
    @IsIn(['createdAt', 'title', 'status', 'severity'])
    sort?: 'createdAt' | 'title' | 'status' | 'severity' = 'createdAt';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    dir?: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @Transform(({ value }) => {
        const v = Number(value ?? 1);
        return clamp(Number.isFinite(v) ? Math.trunc(v) : 1, 1, 10_000);
    })
    @IsInt()
    @IsPositive()
    page: number = 1;

    @IsOptional()
    @Transform(({ value }) => {
        const v = Number(value ?? 10);
        return clamp(Number.isFinite(v) ? Math.trunc(v) : 10, 1, 100);
    })
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize: number = 10;
}
