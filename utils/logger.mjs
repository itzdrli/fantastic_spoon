import winston from 'winston'

const date = new Date()
const dateIso = date.toISOString().split('T')[0]
export const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.level}][${info.timestamp}] ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `./logs/${dateIso}.log` }),
    ]
});