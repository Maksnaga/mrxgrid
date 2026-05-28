# Déploiement sur Asustor / Portainer

Comment publier la demo app à `https://maksnaga.myasustor.com/mrxgrid/mrxgrid-app/`
en parallèle de Storybook à `https://maksnaga.myasustor.com/mrxgrid/`, le tout
via le NAS Asustor + Portainer (`http://192.168.1.10:19900`).

## Architecture

```
┌─ GitHub ─────┐                   ┌─ NAS Asustor ────────────────────────┐
│              │                   │                                       │
│   main push  ├──── webhook ─────►│  webhook-server (Node, port 9000)    │
│              │                   │  → clone repo                         │
└──────────────┘                   │  → npm run build:app  (VITE_BASE=     │
                                   │      /mrxgrid/mrxgrid-app/)           │
                                   │  → npm run build-storybook            │
                                   │  → écrit dans /output                 │
                                   │                                       │
                                   │  ┌─ volume partagé ────────────────┐ │
                                   │  │ /output/         (Storybook)    │ │
                                   │  │ /output/mrxgrid-app/ (Vite)     │ │
                                   │  │   = /volume1/Web/mrxgrid/       │ │
                                   │  └─────────────────────────────────┘ │
                                   │                                       │
                                   │  Web Center Asustor (port 443)        │
                                   │  → /volume1/Web/mrxgrid/ servi        │
                                   │    nativement à /mrxgrid/ via DDNS    │
                                   │                                       │
                                   │  → maksnaga.myasustor.com/mrxgrid/    │
                                   │  → maksnaga.myasustor.com/mrxgrid/    │
                                   │      mrxgrid-app/                     │
                                   └───────────────────────────────────────┘
```

**Pourquoi pas de reverse proxy ADM ?** Web Center occupe déjà les ports 80
et 443 sur Asustor, donc on ne peut pas y attacher de nouvelle rule sans
prendre un port custom (URL avec `:8443`). Comme Web Center sert
automatiquement `/volume1/Web/<dossier>/` à `https://<ddns>/<dossier>/`,
on profite directement de ce mécanisme — pas de container nginx
supplémentaire, pas de reverse proxy.

## Pré-requis

Un volume Portainer `mrxgrid-output` créé en **bind mount** sur
`/volume1/Web/mrxgrid/`. C'est ce dossier que Web Center expose à
`/mrxgrid/`. Le container `mrxgrid-webhook` monte ce volume en `/output`.

## Étape 1 — Volume partagé

Dans Portainer (`http://192.168.1.10:19900`) :

1. **Volumes** → **Add volume**
2. Nom : `mrxgrid-output`
3. Driver : `local`, Driver options :
   - `type=none`
   - `device=/volume1/Web/mrxgrid`
   - `o=bind`
4. Create

## Étape 2 — Container webhook-server

### 2.1 — Build l'image localement OU push sur Docker Hub

Sur ton poste, depuis `deploy/` :

```sh
cd mrxgrid/deploy
docker build -t mrxgrid-webhook:latest .
docker save mrxgrid-webhook:latest -o mrxgrid-webhook.tar
# Upload mrxgrid-webhook.tar sur le NAS (SMB ou web)
# Sur le NAS via Portainer : Images → Import → upload mrxgrid-webhook.tar
```

### 2.2 — Créer le container

Dans Portainer : **Containers** → **Add container**

| Champ | Valeur |
|---|---|
| Name | `mrxgrid-webhook` |
| Image | `mrxgrid-webhook:latest` |
| Network ports | `19902:9000` |
| Volumes | `mrxgrid-output` → `/output` (RW) |
| Env | `WEBHOOK_SECRET=<un secret aléatoire — note-le>` |
| Restart policy | `unless-stopped` |

Deploy → vérifier les logs : `[WEBHOOK] Server listening on port 9000`.

### 2.3 — Premier build manuel

Comme le webhook n'a pas encore tourné, lance un build à la main :

```sh
# Depuis Portainer → mrxgrid-webhook → Console → /bin/sh
sh /app/deploy.sh
```

Une fois le script terminé, vérifie le contenu du volume :

```sh
ls -la /output
# attendu : index.html (Storybook) + mrxgrid-app/
```

## Étape 3 — Vérification

Le Storybook et la demo doivent être accessibles immédiatement via Web
Center :

```sh
curl -I https://maksnaga.myasustor.com/mrxgrid/
# attendu : HTTP/2 200

curl -I https://maksnaga.myasustor.com/mrxgrid/mrxgrid-app/
# attendu : HTTP/2 200
```

Ouvre `https://maksnaga.myasustor.com/mrxgrid/mrxgrid-app/` dans ton
navigateur → tu vois le demo app avec ses 2 onglets (Démo + Tutoriel).

## Étape 4 — Webhook GitHub (build auto)

Pour que GitHub déclenche un build à chaque push sur `main`, il faut
exposer le port 19902 du webhook au monde extérieur.

Comme Web Center prend le 443, on ouvre une rule reverse proxy ADM sur
un port custom (ex. 8443) qui pointe vers `localhost:19902/webhook` :

1. **ADM** → **Services** → **Reverse Proxy** → **Ajouter**
2. Créer un nouveau domaine proxy : protocole HTTPS, port `8443`, chemin `/`
3. Pointer la rule vers `http://localhost:19902/webhook`

Puis sur ton repo GitHub : **Settings** → **Webhooks** → **Add webhook**

| Champ | Valeur |
|---|---|
| Payload URL | `https://maksnaga.myasustor.com:8443/webhook` |
| Content type | `application/json` |
| Secret | celui que tu as mis dans `WEBHOOK_SECRET` |
| Events | "Just the push event" |

## Workflow de déploiement après setup

Une fois tout en place :

1. Tu commit + push sur la branche `main`
2. GitHub envoie un POST à `https://maksnaga.myasustor.com:8443/webhook`
3. Le webhook-server clone, build le Storybook + la demo Vite, écrit dans
   le volume `mrxgrid-output` (= `/volume1/Web/mrxgrid/`)
4. Web Center sert les nouveaux assets immédiatement (les bundles ont un
   hash, donc pas de cache à invalider)

## Troubleshooting

- **404 sur `/mrxgrid/mrxgrid-app/assets/xxx.js`** : le build s'est fait
  sans `VITE_BASE=/mrxgrid/mrxgrid-app/`. Vérifie `deploy.sh`.

- **Routes Vue cassées (refresh = 404)** : Vite étant en SPA, il faut
  que Web Center renvoie `index.html` pour les routes inconnues. Si
  Web Center ne le fait pas par défaut, soit utiliser un mode hash, soit
  monter un nginx alpine en parallèle avec un `try_files`.

- **Webhook GitHub renvoie 401** : `WEBHOOK_SECRET` côté container ne
  matche pas celui côté GitHub. Re-set les deux à la même valeur.

- **Webhook timeout** : le build prend ~3-5 minutes côté NAS. GitHub a
  un timeout de 10s sur le webhook — c'est OK, le serveur répond
  `200 Deploy started` immédiatement et continue en async.

- **Storybook écrasé par la demo (ou inverse)** : si le `find` au début
  du build n'exclut pas `mrxgrid-app`, le `cp` Storybook va virer la
  demo. Vérifie le `find ... ! -name 'mrxgrid-app'` dans `deploy.sh`.
