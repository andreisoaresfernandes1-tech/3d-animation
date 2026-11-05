"""Gera as falas da narração com edge-tts (voz neural pt-BR).
Uso: python tts.py <arquivo.json> <pasta_saida> [voz]"""
import asyncio, json, os, ssl, sys
import edge_tts, edge_tts.communicate as comm

ca = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
if ca:
    comm._SSL_CTX = ssl.create_default_context(cafile=ca)
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')

async def main(spec, out, voice):
    os.makedirs(out, exist_ok=True)
    for item in json.load(open(spec, encoding='utf-8')):
        path = os.path.join(out, f"{item['id']}.mp3")
        c = edge_tts.Communicate(item['text'], voice, rate=item.get('rate', '+0%'), pitch=item.get('pitch', '+0Hz'), proxy=proxy)
        await c.save(path)
        print('ok', path)

asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'pt-BR-AntonioNeural'))
