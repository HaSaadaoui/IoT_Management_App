#!/bin/bash

tables=(
"Data_emsdesk"
"Gateways"
"Signal"
"pending_users"
"Data_pirlight"
"Sensors"
"Users"
)

# L'ancienne BDD doit etre copié ici
# Example scp -r UTILISATEUR@ADRESSE_IP:/opt/app/mydatabase.db old.db

database="old.db"

set -x

sudo rm -rf output
mkdir -p output || echo Directory already exists
chown -R $USER:$GROUPS output
chmod -R ug=rwx output


for table in "${tables[@]}"; do
    sqlite3 -header -csv $database "SELECT * FROM $table;" > "output/${table}.csv"
done

docker compose down --remove-orphans -t 3 -v
docker compose up -d
docker compose logs -f