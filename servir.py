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


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PUERTO), Manejador) as httpd:
    print(f'Sirviendo sin caché en http://localhost:{PUERTO}')
    httpd.serve_forever()
