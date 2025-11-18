import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { ApiBody, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('assistant')
@ApiSecurity('x-api-key')
@Controller('assistant')
export class AssistantController {
    constructor(private readonly assistant: AssistantService) {}

    @Post('query')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                question: { type: 'string' },
            },
            required: ['question'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Global assistant reply based on incidents + question',
    })
    async query(@Body() body: { question?: string }) {
        const q = (body?.question ?? '').toString();
        return this.assistant.query(q);
    }
}
