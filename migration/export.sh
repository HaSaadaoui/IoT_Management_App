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

database="old.db"

set -x

mkdir -p output || echo Directory already exists
#chown -R $USER:$GROUPS output
chmod -R ugo=rwx output


for table in "${tables[@]}"; do
    sqlite3 -header -csv $database "SELECT * FROM $table;" > "output/${table}.csv"
done