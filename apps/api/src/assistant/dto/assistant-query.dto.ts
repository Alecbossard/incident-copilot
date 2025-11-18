import { ApiProperty } from '@nestjs/swagger';

export class AssistantQueryDto {
    @ApiProperty({
        example: 'Quels incidents SEV1 cette semaine ?',
        description: 'Question envoyée à l’assistant global',
    })
    question: string;
}

export class AssistantResponseDto {
    @ApiProperty()
    reply: string;
}
