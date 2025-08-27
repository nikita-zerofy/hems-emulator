FROM denoland/deno:2.4.5

# Create app directory and user
WORKDIR /app
RUN groupadd -g 1001 nodejs
RUN useradd -r -u 1001 -g nodejs nodejs

# Copy Deno configuration
COPY deno.json ./

# Cache dependencies
COPY src/ ./src/
RUN deno cache --lock-write src/server.ts

# Build the application
RUN deno task build

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port (can be overridden by Cloud Run)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno run --allow-net -e "fetch('http://localhost:' + (Deno.env.get('PORT') || '8080') + '/health').then(r => Deno.exit(r.ok ? 0 : 1))"

# Start the application
CMD ["deno", "task", "start"] 