# Pomofocus Backend

Node.js / TypeScript service that exposes both GraphQL & REST entrypoints for Pomofocus (tasks, timer, settings, stats). The current codebase contains the Phase A scaffolding: Express server, Apollo GraphQL, health checks, Redis/BullMQ wiring, and request tracing middleware.

## Tech Stack
- Node.js 20 + TypeScript
- Express 4 + Apollo Server 4
- TypeORM (Postgres), BullMQ, Redis
- Winston logger, Helmet, CLS-based request context

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create `.env`** (sample values in `.env.example`). 主要变量包括 `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`AUTH_SERVICE_URL`（生产环境指向真实鉴权服务），以及 `TEST_AUTH`（dev/staging 可设为 true 简化鉴权）。
3. **Run in development**
   ```bash
   npm run dev
   ```
4. **Build / type-check / lint**
   ```bash
   npm run build
   npm run typecheck
   npm run lint
   ```

## API Surface（当前实现）
- **GraphQL** `/graphql`
  - `tasks(status)` / `createTask` / `updateTask` / `archiveTask`
  - `userSettings` / `updateSettings`
  - Timer：`activeTimer` / `timerEta` / `startTimer` / `pauseTimer` / `resumeTimer` / `completeTimer` / `cancelTimer`
  - Stats：`timerStats(rangeStart, rangeEnd)` / `timerStatsSeries(days)`
- **REST**
  - `GET/POST/PATCH /api/tasks`、`POST /api/tasks/:id/archive`
  - `GET/PUT /api/settings`
  - `POST /api/timer/start|:id/(pause|resume|complete|cancel)`、`GET /api/timer/eta`
  - `GET /api/stats/summary?rangeStart=YYYY-MM-DD&rangeEnd=YYYY-MM-DD`、`GET /api/stats/daily?days=7`
- 所有接口需 `Authorization: Bearer <jwt>`；响应恒带 `x-request-id`。

## Health & Observability
- `GET /api/healthz` verifies Postgres + Redis connectivity.
- All GraphQL/REST responses include `x-request-id`;日志会输出 `audit` 事件（Task/Settings 操作）与错误堆栈。

## Testing
- `npm run test`：Jest + supertest，使用 SQLite in-memory 与 Redis/BullMQ mock，覆盖 Task/Settings/Timer 测试用例。
- `npm run lint` / `npm run typecheck`：保持静态质量闸。

## Background Workers & Jobs
- `npm run worker:timer`：常驻消费 `timer_events` 队列，超时后自动调用 `completeTimer` 并写入审计日志。
- `npm run stats:drain`：按需/定时运行的脚本，会拉起临时 Worker 消耗 `statsQueue` 的 `timer_completed` 作业然后退出，可由 cron 调度。
- `npm run guardian:timer`：定期扫描 RUNNING 但缺少 Redis active flag 的会话，自动补偿 complete/cancel，防止僵尸计时器。

## Error Codes & Audit
- **REST**：统一响应 `{ requestId, error?: { message, details } }`，业务错误映射为 `HTTP_<status>`；Zod 校验失败返回 `400` + 字段错误数组。
- **GraphQL**：`errors[].extensions.code` 包含 `VALIDATION_ERROR`/`HTTP_4xx`，同时附带 `requestId` 与 `details`。
- **Audit**：Task/Settings 操作会以 `audit` 日志形式写入 action、userId、关键信息，便于后续汇总到 SIEM/DB。

## Project Layout
```
repo/
  src/
    config/env.ts          # env loader + validation
    infra/
      datasource.ts        # TypeORM datasource placeholder
      logger.ts            # Winston logger
      redis.ts             # Redis client + ping helper
      bullmq.ts            # Stats queue wiring
      requestContext.ts    # AsyncLocalStorage context
    middlewares/           # requestId, auth, error handling
    graphql/               # schema + stub resolvers
    routes/health.ts       # health check endpoint
    index.ts               # bootstrap entrypoint
```

## Next Steps
- Phase B：完善测试覆盖（Jest/supertest）、继续打磨 Task/Settings 体验。
- Phase C/D：计时器工作流 & Stats/ETA 管线。
- Phase E：限流、审计持久化、交付前验收。
