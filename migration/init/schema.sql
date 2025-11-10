-- Création de la table Gateways
CREATE TABLE gateways (
    gateway_id VARCHAR(50) PRIMARY KEY NOT NULL,
    gateway_eui VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    frequency_plan VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL,
    building_name VARCHAR(50) NOT NULL,
    floor_number INT NOT NULL,
    location_description VARCHAR(50) NULL,
    antenna_latitude FLOAT NULL,
    antenna_longitude FLOAT NULL,
    antenna_altitude FLOAT NULL
);

-- Création de la table Sensors
CREATE TABLE sensors (
    id_sensor VARCHAR(50) PRIMARY KEY NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    commissioning_date VARCHAR(32) NOT NULL,
    status BOOLEAN NOT NULL,
    building_name VARCHAR(100) NOT NULL,
    floor INTEGER NOT NULL,
    location VARCHAR(50) NULL,
    id_gateway VARCHAR(50) NULL,
    dev_eui TEXT NULL,
    join_eui TEXT NULL,
    app_key TEXT NULL,
    frequency_plan VARCHAR(50) NULL,
    FOREIGN KEY (id_gateway) REFERENCES Gateways(gateway_id) ON DELETE
    SET
        NULL
);

-- Création de la table Users
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    icon VARCHAR(100)
);

-- Création de la table pending_users
CREATE TABLE pending_users (
    email VARCHAR(100) PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    firstname TEXT,
    lastname TEXT,
    password TEXT NOT NULL,
    role TEXT,
    icon TEXT,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    resend_count INTEGER DEFAULT 0,
    last_resend_at TEXT
);

-- Création de la table des valeurs senseurs
CREATE TABLE sensor_data (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_sensor VARCHAR(50),
    received_at TIMESTAMP(6),
    string_value TEXT, -- TODO: ajouter une limit
    value_type ENUM(
        'UNKNOWN',
        'APPLICATION_ID',
        'BATTERY',
        'CHANNEL_INDEX',
        'CHANNEL_RSSI',
        'CO2',
        'CONFIRMED',
        'CONSUMED_AIRTIME',
        'DEV_ADDR',
        'DEV_EUI',
        'DEVICE_ID',
        'DISTANCE',
        'F_CNT',
        'F_PORT',
        'FREQUENCY_OFFSET',
        'FRM_PAYLOAD',
        'GATEWAY_EUI',
        'GATEWAY_ID',
        'GPS_TIME',
        'HUMIDITY',
        'ILLUMINANCE',
        'LAEQ',
        'LAI',
        'LAIMAX',
        'LAST_BATTERY_PERCENTAGE_F_CNT',
        'LAST_BATTERY_PERCENTAGE_RECEIVED_AT',
        'LAST_BATTERY_PERCENTAGE_VALUE',
        'LAST_BATTERY_PERCENTAGE',
        'LIGHT',
        'LOCATION_ALTITUDE',
        'LOCATION_LATITUDE',
        'LOCATION_LONGITUDE',
        'LOCATION_SOURCE',
        'LORA_BANDWIDTH',
        'LORA_CODING_RATE',
        'LORA_SPREADING_FACTOR',
        'MOTION',
        'NETWORK_CLUSTER_ADDRESS',
        'NETWORK_CLUSTER_ID',
        'NETWORK_NET_ID',
        'NETWORK_NS_ID',
        'NETWORK_TENANT_ID',
        'OCCUPANCY',
        'PACKET_ERROR_RATE',
        'PERIOD_IN',
        'PERIOD_OUT',
        'RECEIVED_AT',
        'RSSI',
        'SETTINGS_FREQUENCY',
        'SETTINGS_TIME',
        'SETTINGS_TIMESTAMP',
        'SNR',
        'TEMPERATURE',
        'TIME',
        'TIMESTAMP',
        'VDD'
    ) NOT NULL,
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE,
    CONSTRAINT unique_id_received_at UNIQUE (id_sensor, received_at, value_type)
);



