# Bild zu STL Umwandler - Deployment

## Schnell-Anleitung (fertige Build-Dateien)

Der `dist/` Ordner enthaelt die fertigen Dateien. Einfach auf den Webserver kopieren:

```bash
# 1. Zip auf den Server hochladen (z.B. per scp)
scp bild-zu-stl.zip user@dein-server:/tmp/

# 2. Auf dem Server: entpacken und in den Webserver-Ordner kopieren
ssh user@dein-server
cd /tmp
unzip bild-zu-stl.zip

# Fuer Nginx (Standard-Pfad):
sudo cp -r dist/* /var/www/html/bild-zu-stl/

# ODER fuer Apache:
sudo cp -r dist/* /var/www/html/bild-zu-stl/
```

## Nginx Konfiguration

```nginx
server {
    listen 80;
    server_name dein-domain.de;  # oder IP-Adresse

    root /var/www/html/bild-zu-stl;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Caching fuer Assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Danach: `sudo nginx -t && sudo systemctl reload nginx`

## Apache Konfiguration

```apache
<VirtualHost *:80>
    ServerName dein-domain.de
    DocumentRoot /var/www/html/bild-zu-stl

    <Directory /var/www/html/bild-zu-stl>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Fallback auf index.html
    FallbackResource /index.html
</VirtualHost>
```

Danach: `sudo apachectl configtest && sudo systemctl reload apache2`

## Als Unterverzeichnis (z.B. dein-domain.de/stl-tool/)

Falls du es unter einem Unterpfad hosten willst:

1. In `vite.config.js` aendern:
   ```js
   export default defineConfig({
     base: '/stl-tool/',
     ...
   })
   ```
2. Neu bauen: `npm run build`
3. Den `dist/` Ordner nach `/var/www/html/stl-tool/` kopieren

## Selber bauen (optional)

Falls du Aenderungen machen willst:

```bash
# Node.js >= 18 muss installiert sein
npm install
npm run build        # Erzeugt dist/ Ordner
npm run dev          # Lokaler Dev-Server auf Port 5173
```

## HTTPS (empfohlen)

```bash
# Mit certbot (Let's Encrypt):
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dein-domain.de
```
