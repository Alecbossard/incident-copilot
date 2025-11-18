import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export const SEVERITY_VALUES = ['SEV1','SEV2','SEV3','SEV4','SEV5'] as const;
export const STATUS_VALUES = ['OPEN','ACKNOWLEDGED','MITIGATING','RESOLVED','CLOSED'] as const;

export class CreateIncidentDto {
    @ApiProperty({ example: 'Cache miss explosion' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiPropertyOptional({ example: 'Redis timeouts on shard 3' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ enum: SEVERITY_VALUES, example: 'SEV3' })
    @IsOptional()
    @IsEnum(SEVERITY_VALUES as unknown as string[])
    severity?: (typeof SEVERITY_VALUES)[number];

    @ApiPropertyOptional({ enum: STATUS_VALUES, example: 'OPEN' })
    @IsOptional()
    @IsEnum(STATUS_VALUES as unknown as string[])
    status?: (typeof STATUS_VALUES)[number];
}
