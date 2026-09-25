#!/bin/bash

# Script de Deploy Automático do LANCam (Local Network Camera)
# Servidor de Produção Oracle Cloud — Diretório /var/www/html/lancam

set -e

SERVER_USER="ubuntu"
SERVER_IP="146.235.224.99"
SSH_KEY="$HOME/.ssh/oracle-2025"
REMOTE_APP_DIR="/var/www/html/lancam"
REPO_URL="git@github.com:filipeive/LANcam.git"

echo "==================================================================="
echo "   🚀 Deploy Automático — LANCam (/var/www/html/lancam)"
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

echo "📦 Executando rotina de deploy no servidor remoto..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
set -e

# Criar diretório em /var/www/html/lancam
sudo mkdir -p /var/www/html/lancam
sudo chown -R ubuntu:www-data /var/www/html/lancam

if [ ! -d "/var/www/html/lancam/.git" ]; then
    echo "📥 Clonando repositório LANCam em /var/www/html/lancam..."
    git clone git@github.com:filipeive/LANcam.git /var/www/html/lancam
else
    echo "🔄 Atualizando repositório LANCam..."
    cd /var/www/html/lancam
    git fetch origin
    git reset --hard origin/main
fi

cd /var/www/html/lancam
sudo chown -R ubuntu:www-data /var/www/html/lancam

# Instalando dependências npm e compilando
echo "📦 Instalando dependências npm..."
npm install

echo "🛠️ Compilando aplicação monorepo..."
npm run build

# Criar ficheiro .env de produção se não existir
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Gerenciar processo PM2 para o servidor de sinalização Node
echo "⚡ Gerenciando processo Node.js com PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

pm2 delete lancam-server 2>/dev/null || true
pm2 start apps/server/dist/index.js --name "lancam-server"
pm2 save

# Configurar Nginx em /etc/nginx/sites-available/default
echo "🌐 Atualizando /etc/nginx/sites-available/default para incluir LANCam..."

python3 - << 'PYEOF'
import re

config_path = "/etc/nginx/sites-available/default"
with open(config_path, "r") as f:
    content = f.read()

# Remover bloco antigo do lancam se existir para evitar duplicidade
content = re.sub(r'\n?\s*# === LANCAM LOCAL NETWORK CAMERA ===.*?(?=\n\s*(#|\}|$))', '', content, flags=re.DOTALL)

lancam_block = """
    # === LANCAM LOCAL NETWORK CAMERA ===
    location /lancam {
        alias /var/www/html/lancam/apps/web/dist;
        index index.html;
        try_files $uri $uri/ /lancam/index.html;
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
"""

# Inserir bloco antes do último fecha chaves do bloco server
last_brace = content.rfind("}")
if last_brace != -1:
    new_content = content[:last_brace] + lancam_block + "\n" + content[last_brace:]
    with open("/tmp/nginx_default_temp", "w") as f:
        f.write(new_content)
PYEOF

sudo cp /tmp/nginx_default_temp /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deploy do LANCam concluído com sucesso em /var/www/html/lancam!"
ENDSSH

echo ""
echo "==================================================================="
echo "   🎉 DEPLOY DO LANCAM CONCLUÍDO COM SUCESSO!"
echo "==================================================================="
echo "Aceda a: http://146.235.224.99/lancam/"
echo ""
