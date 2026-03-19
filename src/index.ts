import { ENV } from './config/env.js';
import { logger } from './infra/logger.js';
import { createServer } from './server.js';

createServer()
  .then(({ httpServer }) => {
    httpServer.listen({ port: ENV.port }, () => {
      logger.info(`Pomofocus backend listening on port ${ENV.port}`);
    });
  })
  .catch((err) => {
    logger.error(`Server failed to start: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
