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

set -x

database="old.db"

mkdir output

for table in "${tables[@]}"; do
    sqlite3 -header -csv $database "SELECT * FROM $table;" > "output/${table}.csv"
done