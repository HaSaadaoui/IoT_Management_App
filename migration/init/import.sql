-- Ce script permet d'importer les données CSV dans les tables MySQL.
-- Ces données ont été préalablement exportées depuis sqlite via le script import.sql
--
-- Data_emsdesk
-- Gateways
-- Signal
-- pending_users
-- Data_pirlight
-- Sensors
-- Users

SET foreign_key_checks = 0;

LOAD DATA INFILE '/var/lib/mysql-files/csv/Users.csv'
REPLACE
INTO TABLE `users`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA INFILE '/var/lib/mysql-files/csv/Sensors.csv'
REPLACE
INTO TABLE `sensors`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(
    id_sensor,
    device_type,
    @date_string,
    status,
    building_name,
    floor,
    location,
    id_gateway,
    dev_eui,
    join_eui,
    app_key,
    frequency_plan
)
SET commissioning_date = STR_TO_DATE(@date_string, '%Y-%m-%dT%H:%i:%s.%fZ');

LOAD DATA INFILE '/var/lib/mysql-files/csv/pending_users.csv'
REPLACE
INTO TABLE `pending_users`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA INFILE '/var/lib/mysql-files/csv/Signal.csv'
REPLACE
INTO TABLE `signal`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA INFILE '/var/lib/mysql-files/csv/Gateways.csv'
REPLACE
INTO TABLE `gateways`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(gateway_id, gateway_eui, ip_address, frequency_plan, created_at, building_name, 
 floor_number, location_description, @antenna_latitude, @antenna_longitude, @antenna_altitude)
SET 
    antenna_latitude = IF(@antenna_latitude = '', 0, @antenna_latitude),
    antenna_longitude = IF(@antenna_longitude = '', 0, @antenna_longitude),
    antenna_altitude = IF(@antenna_altitude = '', 0, @antenna_altitude);

LOAD DATA INFILE '/var/lib/mysql-files/csv/Data_emsdesk.csv'
REPLACE
INTO TABLE `data_emsdesk`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA INFILE '/var/lib/mysql-files/csv/Data_pirlight.csv'
REPLACE
INTO TABLE `data_pirlight`
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;