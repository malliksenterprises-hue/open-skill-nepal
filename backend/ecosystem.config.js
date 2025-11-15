module.exports = {
  apps: [{
    name: 'open-skill-backend',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3001,
      JWT_SECRET: 'your-jwt-secret-dev'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      JWT_SECRET: 'your-jwt-secret-prod'
    },
    watch: true,
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '1G',
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    time: true
  }]
};
