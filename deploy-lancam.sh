#!/bin/bash

# Script de Deploy Automático do LANCam (Local Network Camera)
# Servidor de Produção Oracle Cloud

set -e

SERVER_USER="ubuntu"
SERVER_IP="146.235.224.99"
SSH_KEY="$HOME/.ssh/oracle-2025"
REMOTE_APP_DIR="/var/www/lancam"
REPO_URL="git@github.com:filipeive/LANcam.git"

echo "==================================================================="
echo "   🚀 Deploy Automático — LANCam (Servidor Online)"
echo "==================================================================="
echo ""
echo "Servidor: $SERVER_USER@$SERVER_IP"
echo "Diretório Remoto: $REMOTE_APP_DIR"
echo "Repositório: $REPO_URL"
echo ""

# Verificar chave SSH
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ ERRO: Chave SSH não encontrada em $SSH_KEY"
    exit 1
fi

echo "🔐 Testando conexão SSH com o servidor..."
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo '✅ Conexão SSH bem-sucedida!'"

echo "📦 Executando rotina de deploy do LANCam no servidor remoto..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
set -e

# Criar diretório do app
sudo mkdir -p /var/www/lancam
sudo chown -R ubuntu:www-data /var/www/lancam

if [ ! -d "/var/www/lancam/.git" ]; then
    echo "📥 Clonando repositório LANCam..."
    git clone git@github.com:filipeive/LANcam.git /var/www/lancam
else
    echo "🔄 Atualizando repositório LANCam..."
    cd /var/www/lancam
    git fetch origin
    git reset --hard origin/main
fi

cd /var/www/lancam

# Garantir que o Node.js e PM2 estão disponíveis
echo "📦 Instalando dependências npm..."
npm install

echo "🛠️ Compilando aplicação..."
npm run build

# Criar ficheiro .env se não existir
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Garantir serviço PM2 ativo para o servidor de sinalização Node
echo "⚡ Gerenciando processo Node.js com PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

pm2 delete lancam-server 2>/dev/null || true
pm2 start npm --name "lancam-server" -- start

pm2 save

# Configurar Nginx para LANCam
echo "🌐 Configurando Nginx para LANCam..."
sudo bash -c 'cat > /etc/nginx/sites-available/lancam << "NGINXEOF"
server {
    listen 80;
    server_name _;

    location /lancam/ {
        alias /var/www/lancam/apps/web/dist/;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3478;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3478;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3478;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINXEOF'

sudo ln -sf /etc/nginx/sites-available/lancam /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deploy do LANCam no servidor remoto concluído com sucesso!"
ENDSSH

echo ""
echo "==================================================================="
echo "   🎉 DEPLOY DO LANCAM CONCLUÍDO COM SUCESSO!"
echo "==================================================================="
echo "Aceda a: http://146.235.224.99"
echo ""
