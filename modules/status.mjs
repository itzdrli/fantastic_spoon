
import os from 'os'
import { bot } from "../index.mjs";

export async function status() {
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  };

  const cpuUsage = () => {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return {
      usage: 100 - Math.floor((totalIdle / totalTick) * 100),
    };
  };

  const memoryUsage = () => {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usage: memoryUsagePercent.toFixed(2) + '%',
    };
  };

  bot.command('status', async (ctx) => {
    const resp = `
Fantastic Spoon
Running on ${systemInfo.platform} ${systemInfo.release} ${systemInfo.arch}
CPU Usage: ${cpuUsage().usage}%
Memory Usage: ${memoryUsage().usage}`
    ctx.reply(resp)
  })
}