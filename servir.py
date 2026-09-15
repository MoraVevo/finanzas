"""Servidor de desarrollo sin caché: igual que `python -m http.server` pero
envía Cache-Control: no-cache, para que el navegador siempre revalide y los
cambios de JS/CSS se vean al recargar (sin pelear con la caché heurística).
Uso:  python servir.py [puerto]   (default 8642)
"""
import http.server
import socketserver
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8642


class Manejador(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()


# ThreadingHTTPServer: los navegadores abren conexiones de preconnect sin datos
# que con el servidor de un solo hilo lo dejan colgado.
socketserver.TCPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), Manejador) as httpd:
    print(f'Sirviendo sin caché en http://localhost:{PUERTO}')
    httpd.serve_forever()
