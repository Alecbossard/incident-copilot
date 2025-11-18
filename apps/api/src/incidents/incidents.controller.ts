import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Injectable,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import {
    CreateIncidentDto,
    SEVERITY_VALUES,
    STATUS_VALUES,
} from './dto/create-incident.dto';

import {
    ApiTags,
    ApiSecurity,
    ApiQuery,
    ApiBody,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { ChatRequestDto, ChatResponseDto } from './dto/chat-incident.dto';

const SORT_KEYS = new Set(['createdAt', 'title', 'status', 'severity']);

function csvToArray(v?: string | string[] | null): string[] | null {
    if (!v) return null;
    const s = Array.isArray(v) ? v.join(',') : v;
    const arr = s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    return arr.length ? arr : null;
}

@ApiTags('incidents')
@ApiSecurity('x-api-key') // Swagger will send the authorized header
@Controller('incidents')
export class IncidentsController {
    constructor(private readonly incidents: IncidentsService) {}

    // -------- LIST (paginated + filters) --------
    @Get()
    @ApiQuery({
        name: 'status',
        required: false,
        description: 'CSV statuses',
        example: 'OPEN,CLOSED',
    })
    @ApiQuery({
        name: 'severity',
        required: false,
        description: 'CSV severities',
        example: 'SEV2,SEV3',
    })
    @ApiQuery({
        name: 'q',
        required: false,
        description: 'Search in title/description (icontains)',
    })
    @ApiQuery({
        name: 'sort',
        required: false,
        enum: ['createdAt', 'title', 'status', 'severity'],
        example: 'createdAt',
    })
    @ApiQuery({
        name: 'dir',
        required: false,
        enum: ['asc', 'desc'],
        example: 'desc',
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'pageSize', required: false, example: 20 })
    @ApiResponse({ status: 200, description: 'Paged list of incidents' })
    @ApiResponse({ status: 401, description: 'Missing or invalid x-api-key' })
    listServer(
        @Query('status') status?: string | string[],
        @Query('severity') severity?: string | string[],
        @Query('q') q?: string,
        @Query('sort') sort?: string,
        @Query('dir') dir?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const statusesRaw = csvToArray(status);
        const statuses =
            statusesRaw?.filter((s) =>
                (STATUS_VALUES as unknown as string[]).includes(s),
            ) ?? null;

        const severitiesRaw = csvToArray(severity);
        const severities =
            severitiesRaw?.filter((s) =>
                (SEVERITY_VALUES as unknown as string[]).includes(s),
            ) ?? null;

        const sortKey =
            sort && SORT_KEYS.has(sort)
                ? (sort as 'createdAt' | 'title' | 'status' | 'severity')
                : 'createdAt';
        const dirKey: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';

        const pageNum = Math.max(1, Number(page ?? 1) || 1);
        let pageSizeNum = Number(pageSize ?? 20) || 20;
        pageSizeNum = Math.min(100, Math.max(1, pageSizeNum));

        return this.incidents.listServer({
            statuses,
            severities,
            q: q ?? null,
            sort: sortKey,
            dir: dirKey,
            page: pageNum,
            pageSize: pageSizeNum,
        });
    }

    // -------- CREATE --------
    @Post()
    @ApiBody({ type: CreateIncidentDto })
    @ApiResponse({ status: 201, description: 'Incident created' })
    @ApiResponse({
        status: 200,
        description: 'Incident created (framework may return 200)',
    })
    @ApiResponse({
        status: 400,
        description: 'Validation error (e.g., missing title)',
    })
    @ApiResponse({ status: 401, description: 'Missing or invalid x-api-key' })
    create(@Body() body: CreateIncidentDto) {
        return this.incidents.create(body as any);
    }

    // -------- PATCH status (flag ALLOW_STATUS_PATCH) --------
    @Patch(':id')
    @ApiParam({ name: 'id', required: true })
    @ApiBody({ type: UpdateStatusDto })
    @ApiResponse({ status: 200, description: 'Status updated' })
    @ApiResponse({
        status: 403,
        description: 'Status patch disabled by server policy',
    })
    @ApiResponse({ status: 409, description: 'Illegal transition' })
    patchStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
        const allow =
            (process.env.ALLOW_STATUS_PATCH || 'false').toLowerCase() ===
            'true';
        if (!allow) {
            throw new ForbiddenException(
                'Status patch disabled by server policy',
            );
        }
        return this.incidents.updateStatus(id, body.status);
    }

    // -------- Suggest (via Python AI + heuristic) --------
    @Post('suggest')
    @ApiBody({
        schema: {
            properties: {
                title: { type: 'string' },
                description: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Suggestion computed' })
    async suggest(@Body() body: { title?: string; description?: string }) {
        return this.incidents.suggest(body?.title ?? '', body?.description ?? '');
    }

    // -------- Embedding per-incident --------
    @Post(':id/embedding')
    @ApiParam({ name: 'id', required: true })
    @ApiResponse({ status: 200, description: 'Embedding upserted' })
    @ApiResponse({ status: 404, description: 'Incident not found' })
    async buildEmbedding(@Param('id') id: string) {
        const res = await this.incidents.upsertEmbeddingForIncident(id);
        if (!res) throw new NotFoundException('Incident not found');
        return res;
    }

    // -------- Similar search --------
    @Get('similar')
    @ApiQuery({ name: 'q', required: true, description: 'Search text' })
    @ApiQuery({ name: 'k', required: false, description: 'Top-K', example: 5 })
    @ApiResponse({ status: 200, description: 'Top-K similar incidents' })
    async similar(@Query('q') q?: string, @Query('k') k?: string) {
        const kk = Math.min(20, Math.max(1, Number(k ?? 5) || 5));
        return this.incidents.similar(q ?? '', kk);
    }

    // -------- GET one incident by id --------
    @Get(':id')
    @ApiParam({ name: 'id', required: true })
    @ApiResponse({ status: 200, description: 'Single incident' })
    @ApiResponse({ status: 404, description: 'Incident not found' })
    async getOne(@Param('id') id: string) {
        return this.incidents.findOne(id);
    }

    // -------- Summary --------
    @Get(':id/summary')
    @ApiParam({ name: 'id', required: true })
    @ApiResponse({ status: 200, description: 'Summary object' })
    @ApiResponse({ status: 404, description: 'Incident not found' })
    async summary(@Param('id') id: string) {
        return this.incidents.summary(id);
    }

    // -------- Chat per incident --------
    @Post(':id/chat')
    @ApiParam({ name: 'id', required: true })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant'] },
                            content: { type: 'string' },
                        },
                        required: ['role', 'content'],
                    },
                },
            },
            required: ['messages'],
        },
    })
    @ApiResponse({ status: 200, description: 'Chat reply for this incident' })
    async chat(
        @Param('id') id: string,
        @Body() body: ChatRequestDto,
    ): Promise<ChatResponseDto> {
        return this.incidents.chat(id, body);
    }

    // -------- (optional) Bulk rebuild --------
    @Post('embeddings/rebuild')
    @ApiResponse({ status: 200, description: 'Re-embedded count' })
    async rebuildAll() {
        return this.incidents.rebuildAllEmbeddings();
    }
}
