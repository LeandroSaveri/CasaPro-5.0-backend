# ============================================
# CasaPro Backend - Dockerfile (Production SaaS)
# ============================================

FROM node:18-alpine AS builder

WORKDIR /app

# Instala dependências de build para bcrypt
RUN apk add --no-cache python3 make g++

# Copia arquivos de dependência
COPY package*.json ./

# Instala TODAS as dependências (npm install funciona sem package-lock.json)
RUN npm install

# Copia o código fonte
COPY . .

# Build do TypeScript
RUN npm run build

# ============================================
# Stage final - Imagem de produção
# ============================================

FROM node:18-alpine AS production

WORKDIR /app

# Instala dependências necessárias pro bcrypt funcionar
RUN apk add --no-cache libc6-compat

# Copia apenas o necessário do stage de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=8080

# Exposição da porta
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Comando de inicialização
CMD ["node", "dist/server.js"]
