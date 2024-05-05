import winston from 'winston'

export const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.level}][${info.timestamp}] ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '../logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: '../logs/latest.log', level: 'info' }),
    ]
});