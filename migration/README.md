1. Copier l'ancienne base de données SQLite ici et rénommer-la `old.db`
2. Executer ./export.sh
3. Les fichiers CSV générés dans "output" et pret pour etre importés à l'aide de init/import.sql

Après cela, les scripts d'import sont prêts.
"schema.sql" permet d'initialiser le schema à partir d'une BDD vide.
"import.sql" permet d'importer les données CSV mentionnées ci-dessus vers la BDD.

4. Utiliser docker compose pour tester les scripts

```bash
docker compose up
```