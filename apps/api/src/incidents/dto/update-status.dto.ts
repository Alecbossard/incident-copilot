import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export type Status = 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATING' | 'RESOLVED' | 'CLOSED';

export class UpdateStatusDto {
    @ApiProperty({ enum: ['OPEN','ACKNOWLEDGED','MITIGATING','RESOLVED','CLOSED'], example: 'ACKNOWLEDGED' })
    @IsEnum(['OPEN','ACKNOWLEDGED','MITIGATING','RESOLVED','CLOSED'])
    status!: Status;
}
