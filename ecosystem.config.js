module.exports = {
  apps: [{
    name: 'bahikhata-api',
    script: './dist/index.js',
    cwd: '/var/www/bahikhata/backend',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    error_file: '/var/log/bahikhata/err.log',
    out_file: '/var/log/bahikhata/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    restart_delay: 3000,
    max_restarts: 10,
  }]
}
