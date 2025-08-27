FROM denoland/deno:2.4.5

WORKDIR /app

# Copy Deno configuration
COPY deno.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY index.html ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Cache dependencies
RUN deno cache --lock-write src/main.tsx

# Expose port
EXPOSE 3000

# Start development server
CMD ["deno", "task", "dev"] 