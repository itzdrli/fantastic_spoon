import { consola } from 'consola'
import fs from 'fs'

const date = new Date()
const dateIso = date.toISOString().split('T')[0]
const logFilePath = `./logs/${dateIso}.log`

export const logger = consola.create({
  level: 4,
  reporters: [
    {
      log: (logObj) => {
        const { date, args } = logObj
        const formattedDate = date.toLocaleString('zh-CN', { 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })
        const logMessage = `[${logObj.type}][${formattedDate}] ${args.join(' ')}\n`
        
        console.log(logMessage)
        
        fs.appendFileSync(logFilePath, logMessage)
      }
    }
  ]
})