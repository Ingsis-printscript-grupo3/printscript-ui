import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const snippetService = env.SNIPPET_SERVICE_URL || 'http://localhost:8080';
  const permissionService = env.PERMISSION_SERVICE_URL || 'http://localhost:8081';
  // changeOrigin en false deja el Host del navegador: el servicio ve que el pedido es de su mismo origen
  // y no lo trata como CORS, en cualquier puerto en que corra la UI. Es lo mismo que hace nginx
  const to = (target: string) => ({ target, changeOrigin: false });
  return {
    define: {
      'process.env.FRONTEND_URL': JSON.stringify(env.FRONTEND_URL),
      'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL)
    },
    plugins: [react()],
    // en desarrollo (y en vite preview) Vite reparte las rutas de la API como lo hace nginx en las VMs,
    // que se configura en el repo snippet-searcher-infra. La UI siempre le pide a su propio origen
    server: {
      proxy: {
        '/users': to(permissionService),
        '/snippets': to(snippetService),
        '/file-types': to(snippetService),
        '/formattings': to(snippetService),
        // con la barra: /rules a secas es una pantalla de la UI
        '^/rules/': to(snippetService),
        // se va cuando los tests cuelguen de /snippets/{id}/tests
        '/test-cases': to(snippetService),
      },
    },
  }
})
