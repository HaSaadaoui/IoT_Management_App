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

-- Création de la table data_emsdesk
CREATE TABLE data_emsdesk (
    id_sensor VARCHAR(50),
    timestamp DATE,
    humidity INTEGER,
    occupancy INTEGER,
    temperature REAL,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
);

-- Création de la table data_pirlight
CREATE TABLE data_pirlight (
    id_sensor VARCHAR(50),
    timestamp DATE,
    light_statut INT,
    pir_statut INT,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
);

-- Création de la table Signal
CREATE TABLE `signal` (
    id_sensor VARCHAR(50),
    timestamp DATE,
    value_battery FLOAT,
    rssi INT,
    fport INT,
    fcntup INT,
    snr FLOAT,
    fcntdown INT,
    sf INT,
    frequency_offset FLOAT,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
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