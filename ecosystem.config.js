module.exports = {
  apps : [{
    name   : "fantastic_spoon",
    script : "./index.mjs",
    watch: true,
    watch_delay: 1000,
    ignore_watch : ["node_modules", "logs", ".git"],
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000
  }]
}
