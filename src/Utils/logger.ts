
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import * as path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import fs from 'fs';
import 'dotenv/config';

class Logger {
    private logger: WinstonLogger;
    private timezone: string;

    constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.timezone = process.env.BOT_TIMEZONE || 'UTC';
        const logsDir = path.join(__dirname, '..', '..', 'logs');
        const logFilePath = path.join(logsDir, 'bot.log');

        // *Create logs directory if it doesn't exist
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        this.logger = createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp({
                    format: () => moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')
                }),
                format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
            ),
            transports: [
                new transports.File({ filename: logFilePath }),
                new transports.Console()
            ],
        });
    }

    public log(message: string): void {
        this.logger.info(message);
    }

    public error(message: string): void {
        this.logger.error(message);
    }

    public warn(message: string): void {
        this.logger.warn(message);
    }

    public debug(message: string): void {
        this.logger.debug(message);
    }
}

export default Logger;
