module.exports = {
  apps : [{
    name   : "fs",
    script : "./index.mjs",
    watch: true,
    watch_delay: 5000,
    ignore_watch : ["node_modules", "logs", ".git"],
  }]
}
